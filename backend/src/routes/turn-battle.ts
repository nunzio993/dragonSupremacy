/**
 * Turn-Based Battle Routes
 * 
 * PvE turn-based battles using the Pokémon-style engine.
 * 
 * Routes:
 * - POST /api/v1/turn-battle/start   - Start a new battle
 * - POST /api/v1/turn-battle/action  - Submit an action
 * - GET  /api/v1/turn-battle/state/:matchId - Get battle state
 */

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    BattleState,
    PlayerAction,
    CreatureInstance,
    BattleRewardPayload,
    CREATURE_BY_ID,
    MOVE_BY_ID,
} from '@nft-autobattler/shared-types';
import {
    simulateTurn,
    createInitialBattleState,
    createCreatureInstance,
    createRng,
} from '@nft-autobattler/game-engine';
import { generateAITeam, generateAIAction, AI_PLAYER_ID } from '../services/ai.js';
import { applyBattleRewards } from '../services/economy.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ============================================
// POST /start - Start a new battle
// ============================================

interface StartBattleBody {
    creatureInstanceIds: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
}

router.post('/start', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const body = req.body as StartBattleBody;
        const { creatureInstanceIds, difficulty = 'easy' } = body;

        // Validate input
        if (!Array.isArray(creatureInstanceIds) || creatureInstanceIds.length !== 3) {
            res.status(400).json({ error: 'Must provide exactly 3 creatureInstanceIds' });
            return;
        }

        // Load player's creatures from roster
        // For MVP, we'll create creatures on the fly based on unit definitions
        const unitsResult = await query(
            `SELECT id, unit_definition_id FROM player_units 
             WHERE account_id = $1 AND id = ANY($2)`,
            [accountId, creatureInstanceIds]
        );

        if (unitsResult.rows.length !== 3) {
            res.status(400).json({ error: 'One or more creatures not found in your roster' });
            return;
        }

        // Build player's team
        const playerTeam: CreatureInstance[] = unitsResult.rows.map((row, index) => {
            // For MVP: use creature definitions if available, otherwise use unit definitions
            const creatureDef = CREATURE_BY_ID[row.unit_definition_id];

            if (creatureDef) {
                return createCreatureInstance(
                    row.id, // Use actual instance ID from DB
                    creatureDef.id,
                    {
                        hp: creatureDef.baseHp,
                        atk: creatureDef.baseAtk,
                        def: creatureDef.baseDef,
                        spd: creatureDef.baseSpd,
                    },
                    creatureDef.movePoolIds.slice(0, 4) // Max 4 moves
                );
            }

            // Fallback: create a basic creature
            return createCreatureInstance(
                row.id,
                row.unit_definition_id,
                { hp: 100, atk: 50, def: 50, spd: 50 },
                ['tackle', 'slam']
            );
        });

        // Generate AI team
        const aiTeam = generateAITeam(difficulty);

        // Generate battle ID and seed
        const seed = Date.now();

        // Create initial battle state
        const battleState = createInitialBattleState(
            crypto.randomUUID(),
            seed,
            accountId,
            AI_PLAYER_ID,
            playerTeam,
            aiTeam
        );

        // Persist to database
        const insertResult = await query(
            `INSERT INTO turn_battles (player_id, state_json) 
             VALUES ($1, $2) 
             RETURNING id`,
            [accountId, JSON.stringify(battleState)]
        );

        const matchId = insertResult.rows[0].id;

        // Update battle state with the actual DB ID
        battleState.id = matchId;
        await query(
            `UPDATE turn_battles SET state_json = $1 WHERE id = $2`,
            [JSON.stringify(battleState), matchId]
        );

        res.json({
            success: true,
            data: {
                matchId,
                state: battleState,
            },
        });
    } catch (err) {
        console.error('[TurnBattle] Error starting battle:', err);
        res.status(500).json({ error: 'Failed to start battle' });
    }
});

// ============================================
// POST /action - Submit an action
// ============================================

interface ActionBody {
    matchId: string;
    action: PlayerAction;
}

interface ActionResponse {
    state: BattleState;
    rewards?: BattleRewardPayload;
}

router.post('/action', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const body = req.body as ActionBody;
        const { matchId, action } = body;

        // Validate input
        if (!matchId || !action) {
            res.status(400).json({ error: 'matchId and action are required' });
            return;
        }

        // Load battle from database
        const battleResult = await query(
            `SELECT id, player_id, state_json FROM turn_battles 
             WHERE id = $1`,
            [matchId]
        );

        if (battleResult.rows.length === 0) {
            res.status(404).json({ error: 'Battle not found' });
            return;
        }

        const battleRow = battleResult.rows[0];

        // Verify ownership
        if (battleRow.player_id !== accountId) {
            res.status(403).json({ error: 'Not authorized to access this battle' });
            return;
        }

        const state: BattleState = battleRow.state_json;
        const previousResult = state.result;

        // Check if battle is still ongoing
        if (state.result !== 'ONGOING') {
            res.status(400).json({
                error: 'Battle has already ended',
                result: state.result,
            });
            return;
        }

        // Validate player action
        const validationError = validatePlayerAction(state, action);
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }

        // Fix the playerId in the action
        action.playerId = accountId;

        // Generate AI action
        const aiAction = generateAIAction(state);

        // Get a seed for this turn
        const turnSeed = state.seed + state.turnNumber;

        // Simulate the turn
        const newState = simulateTurn(state, action, aiAction, turnSeed);

        // Update database
        await query(
            `UPDATE turn_battles 
             SET state_json = $1, updated_at = NOW() 
             WHERE id = $2`,
            [JSON.stringify(newState), matchId]
        );

        // Prepare response
        const responseData: ActionResponse = {
            state: newState,
        };

        // Check if battle just ended (was ONGOING, now has a result)
        if (previousResult === 'ONGOING' && newState.result !== 'ONGOING') {
            try {
                // Apply rewards
                const rewards = await applyBattleRewards(
                    accountId,
                    newState.result,
                    true // isPlayer1
                );
                responseData.rewards = rewards;

                console.log(
                    `[TurnBattle] Battle ${matchId} ended: ${newState.result}. ` +
                    `Rewards: +${rewards.xpGained} XP, +${rewards.coinsGained} coins`
                );
            } catch (rewardErr) {
                console.error('[TurnBattle] Error applying rewards:', rewardErr);
                // Continue without rewards rather than failing the whole request
            }
        }

        res.json({
            success: true,
            data: responseData,
        });
    } catch (err) {
        console.error('[TurnBattle] Error processing action:', err);
        res.status(500).json({ error: 'Failed to process action' });
    }
});

// ============================================
// GET /state/:matchId - Get battle state
// ============================================

router.get('/state/:matchId', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { matchId } = req.params;

        // Load battle from database
        const battleResult = await query(
            `SELECT id, player_id, state_json, created_at, updated_at 
             FROM turn_battles 
             WHERE id = $1`,
            [matchId]
        );

        if (battleResult.rows.length === 0) {
            res.status(404).json({ error: 'Battle not found' });
            return;
        }

        const battleRow = battleResult.rows[0];

        // Verify ownership
        if (battleRow.player_id !== accountId) {
            res.status(403).json({ error: 'Not authorized to access this battle' });
            return;
        }

        res.json({
            success: true,
            data: {
                matchId: battleRow.id,
                state: battleRow.state_json,
                createdAt: battleRow.created_at,
                updatedAt: battleRow.updated_at,
            },
        });
    } catch (err) {
        console.error('[TurnBattle] Error fetching state:', err);
        res.status(500).json({ error: 'Failed to fetch battle state' });
    }
});

// ============================================
// GET /active - Get active battles for player
// ============================================

router.get('/active', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;

        const result = await query(
            `SELECT id, state_json, created_at, updated_at 
             FROM turn_battles 
             WHERE player_id = $1 
               AND (state_json->>'result') = 'ONGOING'
             ORDER BY updated_at DESC
             LIMIT 10`,
            [accountId]
        );

        const battles = result.rows.map(row => ({
            matchId: row.id,
            turnNumber: row.state_json.turnNumber,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));

        res.json({
            success: true,
            data: { battles },
        });
    } catch (err) {
        console.error('[TurnBattle] Error fetching active battles:', err);
        res.status(500).json({ error: 'Failed to fetch active battles' });
    }
});

// ============================================
// VALIDATION HELPERS
// ============================================

function validatePlayerAction(state: BattleState, action: PlayerAction): string | null {
    const playerSide = state.player1;
    const active = playerSide.active;

    if (!active || active.isFainted) {
        return 'No active creature to perform action';
    }

    if (action.type === 'USE_MOVE') {
        if (!action.moveId) {
            return 'moveId is required for USE_MOVE action';
        }

        // Check if move is in creature's known moves
        if (!active.knownMoveIds.includes(action.moveId)) {
            return `Creature does not know move: ${action.moveId}`;
        }

        // Check cooldown
        const cooldown = active.moveCooldowns[action.moveId] || 0;
        if (cooldown > 0) {
            return `Move ${action.moveId} is on cooldown (${cooldown} turns remaining)`;
        }

        // Validate move exists
        if (!MOVE_BY_ID[action.moveId]) {
            return `Unknown move: ${action.moveId}`;
        }
    } else if (action.type === 'SWITCH') {
        if (!action.switchToInstanceId) {
            return 'switchToInstanceId is required for SWITCH action';
        }

        // Check if target is on bench and alive
        const targetBench = playerSide.bench.find(
            c => c.instanceId === action.switchToInstanceId && !c.isFainted
        );

        if (!targetBench) {
            return 'Cannot switch to that creature (not on bench or fainted)';
        }
    } else {
        return `Invalid action type: ${action.type}`;
    }

    return null;
}

export default router;
