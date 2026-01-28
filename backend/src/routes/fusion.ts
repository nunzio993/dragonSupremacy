/**
 * Fusion Routes
 *
 * Endpoints for fusing creatures and moves.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { fuseCreatures, fuseMoves } from '../services/fusion.js';
import { getCreatureFusionRule, getMoveFusionRule } from '../config/fusion.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/fusion/rules
 *
 * Get fusion rules information.
 */
router.get('/rules', async (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            creatures: {
                COMMON: getCreatureFusionRule('COMMON'),
                RARE: getCreatureFusionRule('RARE'),
                EPIC: getCreatureFusionRule('EPIC'),
                LEGENDARY: getCreatureFusionRule('LEGENDARY'),
            },
            moves: {
                COMMON: getMoveFusionRule('COMMON'),
                RARE: getMoveFusionRule('RARE'),
                EPIC: getMoveFusionRule('EPIC'),
                LEGENDARY: getMoveFusionRule('LEGENDARY'),
            },
            requirements: {
                sameElement: true,
                sameRarity: true,
                count: 3,
            },
        },
    });
});

/**
 * POST /api/v1/fusion/creatures
 *
 * Fuse 3 creatures into 1 higher-rarity creature.
 */
router.post('/creatures', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { creatureIds } = req.body;

        // Validate input
        if (!Array.isArray(creatureIds)) {
            res.status(400).json({ error: 'creatureIds must be an array' });
            return;
        }

        if (creatureIds.length !== 3) {
            res.status(400).json({ error: 'Exactly 3 creature IDs are required' });
            return;
        }

        // Check for duplicates
        const uniqueIds = new Set(creatureIds);
        if (uniqueIds.size !== 3) {
            res.status(400).json({ error: 'Creature IDs must be unique' });
            return;
        }

        const result = await fuseCreatures(accountId, creatureIds);

        res.json({
            success: true,
            data: {
                burnedCreatureIds: result.burnedCreatureIds,
                newCreature: {
                    id: result.newCreature.dbId,
                    nftId: result.newCreature.nftId,
                    creatureDefinitionId: result.newCreature.creatureDefinitionId,
                    name: result.newCreature.definition.name,
                    elementType: result.newCreature.definition.elementType,
                    rarity: result.newCreature.rarity,
                    stats: result.newCreature.stats,
                },
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fuse creatures';

        // Determine appropriate status code
        const isValidationError =
            message.includes('not found') ||
            message.includes('not owned') ||
            message.includes('same rarity') ||
            message.includes('same element') ||
            message.includes('Cannot fuse');

        res.status(isValidationError ? 400 : 500).json({ error: message });
    }
});

/**
 * POST /api/v1/fusion/moves
 *
 * Fuse 3 moves into 1 higher-rarity move.
 */
router.post('/moves', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { moveIds } = req.body;

        // Validate input
        if (!Array.isArray(moveIds)) {
            res.status(400).json({ error: 'moveIds must be an array' });
            return;
        }

        if (moveIds.length !== 3) {
            res.status(400).json({ error: 'Exactly 3 move IDs are required' });
            return;
        }

        // Check for duplicates
        const uniqueIds = new Set(moveIds);
        if (uniqueIds.size !== 3) {
            res.status(400).json({ error: 'Move IDs must be unique' });
            return;
        }

        const result = await fuseMoves(accountId, moveIds);

        res.json({
            success: true,
            data: {
                burnedMoveIds: result.burnedMoveIds,
                newMove: {
                    id: result.newMove.dbId,
                    nftId: result.newMove.nftId,
                    moveDefinitionId: result.newMove.moveDefinitionId,
                    name: result.newMove.definition.name,
                    elementType: result.newMove.definition.elementType,
                    rarity: result.newMove.rarity,
                    basePower: result.newMove.definition.basePower,
                    accuracy: result.newMove.definition.accuracy,
                },
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fuse moves';

        const isValidationError =
            message.includes('not found') ||
            message.includes('not owned') ||
            message.includes('same rarity') ||
            message.includes('same element') ||
            message.includes('Cannot fuse');

        res.status(isValidationError ? 400 : 500).json({ error: message });
    }
});

export default router;
