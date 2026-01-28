import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { simulateBattle, createMatchSeed } from '@nft-autobattler/game-engine';
import {
    UNIT_DEFINITIONS,
    EQUIPMENT_DEFINITIONS,
    UNIT_BY_ID,
    EQUIPMENT_BY_ID,
    MatchSetup,
    PlayerUnitInstance,
    EquipmentInstance,
} from '@nft-autobattler/shared-types';
import config from '../config.js';

/*
 * ============================================
 * LEGACY: AUTO-BATTLE ROUTES
 * ============================================
 *
 * These routes implement the original autobattler system where battles
 * are simulated instantly without player interaction.
 *
 * Routes:
 *   POST /api/v1/match/simulate     - Simulate a full battle instantly
 *   GET  /api/v1/match/history      - Get match history
 *   GET  /api/v1/match/:id/replay   - Get full match data for replay
 *
 * Database:
 *   Table: matches (stores completed auto-battle results)
 *
 * For the new interactive turn-based system, see:
 *   routes/turn-battle.ts
 *
 * ============================================
 */

const router = Router();

router.use(authMiddleware);

/**
 * LEGACY: POST /api/v1/match/simulate
 * 
 * Simulate a match against AI (instant, non-interactive).
 * Uses the player's current loadout vs an AI-generated team.
 */
router.post('/simulate', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;

        // Get player's loadout
        const loadoutResult = await query(
            `SELECT unit_ids FROM loadouts WHERE account_id = $1`,
            [accountId]
        );

        const loadoutUnitIds = loadoutResult.rows[0]?.unit_ids || [];
        if (loadoutUnitIds.length === 0) {
            res.status(400).json({ error: 'No units in loadout. Add units before battling.' });
            return;
        }

        // Get player units with equipment
        const unitsResult = await query(
            `SELECT pu.id, pu.unit_definition_id, pe.id as equip_id, pe.equipment_definition_id
       FROM player_units pu
       LEFT JOIN player_equipment pe ON pe.equipped_on_unit_id = pu.id
       WHERE pu.account_id = $1 AND pu.id = ANY($2)`,
            [accountId, loadoutUnitIds]
        );

        // Get account level for AI scaling
        const accountResult = await query(
            `SELECT level, xp FROM accounts WHERE id = $1`,
            [accountId]
        );
        const accountLevel = accountResult.rows[0]?.level || 1;

        // Build team A (player)
        const teamA: PlayerUnitInstance[] = [];
        const equipmentMap: Record<string, EquipmentInstance> = {};

        // Group by unit
        const unitMap = new Map<string, { unitDefId: string; equips: string[] }>();
        for (const row of unitsResult.rows) {
            if (!unitMap.has(row.id)) {
                unitMap.set(row.id, { unitDefId: row.unit_definition_id, equips: [] });
            }
            if (row.equip_id) {
                unitMap.get(row.id)!.equips.push(row.equip_id);
                equipmentMap[row.equip_id] = {
                    instanceId: row.equip_id,
                    equipmentDefinitionId: row.equipment_definition_id,
                };
            }
        }

        // Maintain loadout order
        for (const unitId of loadoutUnitIds) {
            const unitData = unitMap.get(unitId);
            if (unitData) {
                teamA.push({
                    instanceId: unitId,
                    unitDefinitionId: unitData.unitDefId,
                    equippedItems: unitData.equips,
                });
            }
        }

        // Generate AI team based on account level
        const { teamB, aiEquipmentMap } = generateAITeam(accountLevel, teamA.length);
        Object.assign(equipmentMap, aiEquipmentMap);

        // Create match setup
        const matchId = uuidv4();
        const seed = createMatchSeed(matchId, Date.now());

        const setup: MatchSetup = {
            matchId,
            seed,
            teamA,
            teamB,
            equipmentMap,
        };

        // Simulate the battle
        const result = simulateBattle(setup);

        // Calculate XP reward
        let xpGained = config.xpPerLoss;
        if (result.winner === 'teamA') {
            xpGained = config.xpPerWin;
        } else if (result.winner === 'draw') {
            xpGained = config.xpPerDraw;
        }

        // Update account XP
        await query(
            `UPDATE accounts SET xp = xp + $1 WHERE id = $2`,
            [xpGained, accountId]
        );

        // Check for level up (simple: 100 XP per level)
        const newXp = (accountResult.rows[0]?.xp || 0) + xpGained;
        const newLevel = Math.floor(newXp / 100) + 1;
        if (newLevel > accountLevel) {
            await query(
                `UPDATE accounts SET level = $1 WHERE id = $2`,
                [newLevel, accountId]
            );
        }

        // Save match to history
        await query(
            `INSERT INTO matches (id, account_id, seed, result, opponent_type, team_a, team_b, events, total_turns, xp_gained)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                matchId,
                accountId,
                seed,
                result.winner,
                'ai',
                JSON.stringify(teamA),
                JSON.stringify(teamB),
                JSON.stringify(result.events),
                result.totalTurns,
                xpGained,
            ]
        );

        res.json({
            success: true,
            data: {
                matchId,
                result: result.winner,
                events: result.events,
                totalTurns: result.totalTurns,
                finalState: result.finalState,
                xpGained,
                newLevel: newLevel > accountLevel ? newLevel : undefined,
            },
        });
    } catch (err) {
        console.error('[Match] Error simulating match:', err);
        res.status(500).json({ error: 'Failed to simulate match' });
    }
});

/**
 * GET /api/v1/match/history
 * 
 * Get recent match history
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

        const result = await query(
            `SELECT id, result, opponent_type, total_turns, xp_gained, created_at
       FROM matches WHERE account_id = $1
       ORDER BY created_at DESC LIMIT $2`,
            [accountId, limit]
        );

        res.json({
            success: true,
            data: result.rows.map((row) => ({
                matchId: row.id,
                result: row.result,
                opponentType: row.opponent_type,
                totalTurns: row.total_turns,
                xpGained: row.xp_gained,
                createdAt: row.created_at,
            })),
        });
    } catch (err) {
        console.error('[Match] Error fetching history:', err);
        res.status(500).json({ error: 'Failed to fetch match history' });
    }
});

/**
 * GET /api/v1/match/:matchId/replay
 * 
 * Get full match data for replay
 */
router.get('/:matchId/replay', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { matchId } = req.params;

        const result = await query(
            `SELECT * FROM matches WHERE id = $1 AND account_id = $2`,
            [matchId, accountId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        const match = result.rows[0];

        res.json({
            success: true,
            data: {
                matchId: match.id,
                seed: match.seed,
                result: match.result,
                teamA: match.team_a,
                teamB: match.team_b,
                events: match.events,
                totalTurns: match.total_turns,
                createdAt: match.created_at,
            },
        });
    } catch (err) {
        console.error('[Match] Error fetching replay:', err);
        res.status(500).json({ error: 'Failed to fetch match replay' });
    }
});

/**
 * Generate an AI team based on account level
 */
function generateAITeam(
    accountLevel: number,
    playerTeamSize: number
): { teamB: PlayerUnitInstance[]; aiEquipmentMap: Record<string, EquipmentInstance> } {
    const teamB: PlayerUnitInstance[] = [];
    const aiEquipmentMap: Record<string, EquipmentInstance> = {};

    // Pool of available units based on level
    // Higher level = more access to rare/epic/legendary units
    let unitPool = UNIT_DEFINITIONS.filter((u) => u.rarity === 'common');

    if (accountLevel >= 3) {
        unitPool = unitPool.concat(UNIT_DEFINITIONS.filter((u) => u.rarity === 'rare'));
    }
    if (accountLevel >= 5) {
        unitPool = unitPool.concat(UNIT_DEFINITIONS.filter((u) => u.rarity === 'epic'));
    }
    if (accountLevel >= 8) {
        unitPool = unitPool.concat(UNIT_DEFINITIONS.filter((u) => u.rarity === 'legendary'));
    }

    // Equipment pool
    let equipPool = EQUIPMENT_DEFINITIONS.slice(0, 4); // Basic equipment
    if (accountLevel >= 3) {
        equipPool = EQUIPMENT_DEFINITIONS.slice(0, 7);
    }
    if (accountLevel >= 5) {
        equipPool = EQUIPMENT_DEFINITIONS;
    }

    // Create AI team (same size as player)
    for (let i = 0; i < playerTeamSize; i++) {
        const unitDef = unitPool[Math.floor(Math.random() * unitPool.length)];
        const instanceId = `ai-unit-${i}`;

        // Maybe add equipment (chance increases with level)
        const equippedItems: string[] = [];
        const equipChance = Math.min(0.3 + accountLevel * 0.1, 0.8);

        for (let slot = 0; slot < 2; slot++) {
            if (Math.random() < equipChance) {
                const equipDef = equipPool[Math.floor(Math.random() * equipPool.length)];
                const equipInstanceId = `ai-equip-${i}-${slot}`;
                equippedItems.push(equipInstanceId);
                aiEquipmentMap[equipInstanceId] = {
                    instanceId: equipInstanceId,
                    equipmentDefinitionId: equipDef.id,
                };
            }
        }

        teamB.push({
            instanceId,
            unitDefinitionId: unitDef.id,
            equippedItems,
        });
    }

    return { teamB, aiEquipmentMap };
}

export default router;
