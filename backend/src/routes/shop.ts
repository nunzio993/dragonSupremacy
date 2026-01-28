/**
 * Shop Routes
 *
 * Endpoints for viewing and purchasing packs.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { PACK_DEFINITIONS, PACK_BY_ID } from '../config/shop.js';
import { openPack } from '../services/shop.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/shop/packs
 *
 * Get list of available packs.
 */
router.get('/packs', async (_req: Request, res: Response) => {
    const packs = PACK_DEFINITIONS.map((pack) => ({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        type: pack.type,
        costCoins: pack.costCoins,
    }));

    res.json({
        success: true,
        data: { packs },
    });
});

/**
 * GET /api/v1/shop/packs/:packId
 *
 * Get details for a specific pack.
 */
router.get('/packs/:packId', async (req: Request, res: Response) => {
    const { packId } = req.params;
    const pack = PACK_BY_ID[packId];

    if (!pack) {
        res.status(404).json({ error: 'Pack not found' });
        return;
    }

    res.json({
        success: true,
        data: {
            id: pack.id,
            name: pack.name,
            description: pack.description,
            type: pack.type,
            costCoins: pack.costCoins,
            rarityChances: {
                common: pack.rarityWeights.COMMON,
                rare: pack.rarityWeights.RARE,
                epic: pack.rarityWeights.EPIC,
                legendary: pack.rarityWeights.LEGENDARY,
            },
        },
    });
});

/**
 * POST /api/v1/shop/open
 *
 * Open a pack and receive rewards.
 */
router.post('/open', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const { packId } = req.body;

        if (!packId || typeof packId !== 'string') {
            res.status(400).json({ error: 'packId is required' });
            return;
        }

        if (!PACK_BY_ID[packId]) {
            res.status(404).json({ error: 'Pack not found' });
            return;
        }

        const result = await openPack(accountId, packId);

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open pack';

        if (message.includes('Insufficient coins')) {
            res.status(400).json({ error: message });
            return;
        }

        console.error('[Shop] Error opening pack:', err);
        res.status(500).json({ error: message });
    }
});

export default router;
