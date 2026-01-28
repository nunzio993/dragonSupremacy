import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { mockRmrkService } from '@nft-autobattler/rmrk-module';
import {
    UNIT_BY_ID,
    EQUIPMENT_BY_ID,
    PlayerUnitInstance,
    EquipmentInstance,
} from '@nft-autobattler/shared-types';
import config from '../config.js';

/*
 * ============================================
 * RMRK INTEGRATION NOTES
 * ============================================
 *
 * This roster system currently uses PostgreSQL for ownership tracking.
 * For full RMRK integration, replace DB queries with IRmrkCreatureService calls.
 *
 * Example: Minting a creature NFT on account creation:
 *
 * import { mockRmrkService, CreatureNftMetadata } from '@nft-autobattler/rmrk-module';
 *
 * const metadata: CreatureNftMetadata = {
 *     creatureDefinitionId: 'flame_lizard',
 *     level: 1,
 *     ivHp: Math.floor(Math.random() * 32),
 *     ivAtk: Math.floor(Math.random() * 32),
 *     ivDef: Math.floor(Math.random() * 32),
 *     ivSpd: Math.floor(Math.random() * 32),
 *     elementType: 'FIRE',
 *     rarity: 'COMMON',
 *     movePoolIds: ['ember', 'flamethrower', 'quick_strike'],
 * };
 *
 * const nftId = await mockRmrkService.mintCreatureNft(accountId, metadata);
 *
 * Example: Getting player's creatures:
 *
 * const creatureIds = await mockRmrkService.getPlayerCreatures(accountId);
 * const creatures = await Promise.all(
 *     creatureIds.map(id => mockRmrkService.getCreatureNft(id))
 * );
 *
 * ============================================
 */

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/roster
 * 
 * Get all units and equipment owned by the player
 * 
 * TODO: Replace DB queries with RMRK-based ownership:
 * - Use mockRmrkService.getPlayerCreatures(accountId) for creatures
 * - Use mockRmrkService.getPlayerMoves(accountId) for moves
 * - Use mockRmrkService.getCreatureMoves(creatureId) for attached moves
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;

        // TODO: Replace with RMRK:
        // const creatureIds = await mockRmrkService.getPlayerCreatures(accountId);
        // const creatures = await Promise.all(creatureIds.map(id => mockRmrkService.getCreatureNft(id)));

        // Get units (legacy DB-based ownership)
        const unitsResult = await query(
            `SELECT id, unit_definition_id, rmrk_nft_id FROM player_units WHERE account_id = $1`,
            [accountId]
        );

        // Get equipment (legacy DB-based ownership)
        const equipResult = await query(
            `SELECT id, equipment_definition_id, equipped_on_unit_id, rmrk_nft_id 
       FROM player_equipment WHERE account_id = $1`,
            [accountId]
        );

        // Get loadout
        const loadoutResult = await query(
            `SELECT unit_ids FROM loadouts WHERE account_id = $1`,
            [accountId]
        );

        // Transform units
        const units: PlayerUnitInstance[] = unitsResult.rows.map((row) => {
            const equippedItems = equipResult.rows
                .filter((e) => e.equipped_on_unit_id === row.id)
                .map((e) => e.id);

            return {
                instanceId: row.id,
                unitDefinitionId: row.unit_definition_id,
                equippedItems,
            };
        });

        // Transform equipment
        const equipment: EquipmentInstance[] = equipResult.rows.map((row) => ({
            instanceId: row.id,
            equipmentDefinitionId: row.equipment_definition_id,
        }));

        // Get current loadout
        const loadout = loadoutResult.rows[0]?.unit_ids || [];

        res.json({
            success: true,
            data: {
                units,
                equipment,
                loadout,
            },
        });
    } catch (err) {
        console.error('[Roster] Error fetching roster:', err);
        res.status(500).json({ error: 'Failed to fetch roster' });
    }
});

/**
 * POST /api/v1/roster/loadout
 * 
 * Save the active loadout (which units to use in battle)
 */
router.post('/loadout', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { unitInstanceIds } = req.body;

        // Validate
        if (!Array.isArray(unitInstanceIds)) {
            res.status(400).json({ error: 'unitInstanceIds must be an array' });
            return;
        }

        if (unitInstanceIds.length > config.maxLoadoutSize) {
            res.status(400).json({
                error: `Loadout cannot exceed ${config.maxLoadoutSize} units`,
            });
            return;
        }

        // Verify all units belong to player
        if (unitInstanceIds.length > 0) {
            const result = await query(
                `SELECT id FROM player_units WHERE account_id = $1 AND id = ANY($2)`,
                [accountId, unitInstanceIds]
            );

            if (result.rows.length !== unitInstanceIds.length) {
                res.status(400).json({ error: 'One or more units not found in roster' });
                return;
            }
        }

        // Update loadout
        await query(
            `UPDATE loadouts SET unit_ids = $1, updated_at = NOW() WHERE account_id = $2`,
            [unitInstanceIds, accountId]
        );

        res.json({
            success: true,
            data: { loadout: unitInstanceIds },
        });
    } catch (err) {
        console.error('[Roster] Error saving loadout:', err);
        res.status(500).json({ error: 'Failed to save loadout' });
    }
});

/**
 * POST /api/v1/roster/equip
 * 
 * Equip an item to a unit
 */
router.post('/equip', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { unitInstanceId, equipmentInstanceId } = req.body;

        // Validate inputs
        if (!unitInstanceId || !equipmentInstanceId) {
            res.status(400).json({ error: 'unitInstanceId and equipmentInstanceId required' });
            return;
        }

        // Verify unit belongs to player
        const unitResult = await query(
            `SELECT id, rmrk_nft_id FROM player_units WHERE account_id = $1 AND id = $2`,
            [accountId, unitInstanceId]
        );
        if (unitResult.rows.length === 0) {
            res.status(404).json({ error: 'Unit not found' });
            return;
        }

        // Verify equipment belongs to player and is not equipped elsewhere
        const equipResult = await query(
            `SELECT id, rmrk_nft_id, equipped_on_unit_id FROM player_equipment 
       WHERE account_id = $1 AND id = $2`,
            [accountId, equipmentInstanceId]
        );
        if (equipResult.rows.length === 0) {
            res.status(404).json({ error: 'Equipment not found' });
            return;
        }

        // Check if unit already has max equipment
        const currentEquipResult = await query(
            `SELECT COUNT(*) as count FROM player_equipment 
       WHERE equipped_on_unit_id = $1`,
            [unitInstanceId]
        );
        if (parseInt(currentEquipResult.rows[0].count) >= config.maxEquipPerUnit) {
            res.status(400).json({
                error: `Unit already has ${config.maxEquipPerUnit} equipment`,
            });
            return;
        }

        // Update RMRK nesting
        const unitNftId = unitResult.rows[0].rmrk_nft_id;
        const equipNftId = equipResult.rows[0].rmrk_nft_id;

        // Detach from previous unit if needed
        if (equipResult.rows[0].equipped_on_unit_id) {
            const prevUnitResult = await query(
                `SELECT rmrk_nft_id FROM player_units WHERE id = $1`,
                [equipResult.rows[0].equipped_on_unit_id]
            );
            if (prevUnitResult.rows.length > 0) {
                await mockRmrkService.detachEquipFromUnit(
                    prevUnitResult.rows[0].rmrk_nft_id,
                    equipNftId
                );
            }
        }

        // Attach to new unit
        await mockRmrkService.attachEquipToUnit(unitNftId, equipNftId);

        // Update DB
        await query(
            `UPDATE player_equipment SET equipped_on_unit_id = $1 WHERE id = $2`,
            [unitInstanceId, equipmentInstanceId]
        );

        res.json({
            success: true,
            data: { unitInstanceId, equipmentInstanceId },
        });
    } catch (err) {
        console.error('[Roster] Error equipping item:', err);
        res.status(500).json({ error: 'Failed to equip item' });
    }
});

/**
 * POST /api/v1/roster/unequip
 * 
 * Unequip an item from a unit
 */
router.post('/unequip', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { equipmentInstanceId } = req.body;

        if (!equipmentInstanceId) {
            res.status(400).json({ error: 'equipmentInstanceId required' });
            return;
        }

        // Verify equipment belongs to player
        const equipResult = await query(
            `SELECT id, rmrk_nft_id, equipped_on_unit_id FROM player_equipment 
       WHERE account_id = $1 AND id = $2`,
            [accountId, equipmentInstanceId]
        );
        if (equipResult.rows.length === 0) {
            res.status(404).json({ error: 'Equipment not found' });
            return;
        }

        const equip = equipResult.rows[0];
        if (!equip.equipped_on_unit_id) {
            res.status(400).json({ error: 'Equipment is not equipped' });
            return;
        }

        // Get unit NFT ID
        const unitResult = await query(
            `SELECT rmrk_nft_id FROM player_units WHERE id = $1`,
            [equip.equipped_on_unit_id]
        );

        // Update RMRK nesting
        if (unitResult.rows.length > 0) {
            await mockRmrkService.detachEquipFromUnit(
                unitResult.rows[0].rmrk_nft_id,
                equip.rmrk_nft_id
            );
        }

        // Update DB
        await query(
            `UPDATE player_equipment SET equipped_on_unit_id = NULL WHERE id = $1`,
            [equipmentInstanceId]
        );

        res.json({
            success: true,
            data: { equipmentInstanceId },
        });
    } catch (err) {
        console.error('[Roster] Error unequipping item:', err);
        res.status(500).json({ error: 'Failed to unequip item' });
    }
});

export default router;
