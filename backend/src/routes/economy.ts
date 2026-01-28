/**
 * Economy Routes
 *
 * Endpoints for XP, level, and coins management.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getPlayerEconomy,
    debugAddRewards,
    ECONOMY_CONFIG,
    levelFromXp,
    xpRequiredForLevel,
} from '../services/economy.js';
import config from '../config.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/economy/state
 *
 * Get current player economy state (XP, level, coins).
 */
router.get('/state', async (req: Request, res: Response) => {
    try {
        const accountId = req.auth!.accountId;
        const economyState = await getPlayerEconomy(accountId);

        res.json({
            success: true,
            data: economyState,
        });
    } catch (err) {
        console.error('[Economy] Error fetching state:', err);
        res.status(500).json({ error: 'Failed to fetch economy state' });
    }
});

/**
 * GET /api/v1/economy/config
 *
 * Get economy configuration (reward amounts).
 */
router.get('/config', async (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: ECONOMY_CONFIG,
    });
});

/**
 * GET /api/v1/economy/level-table
 *
 * Get XP requirements for levels 1-20.
 */
router.get('/level-table', async (_req: Request, res: Response) => {
    const table = [];
    for (let level = 1; level <= 20; level++) {
        table.push({
            level,
            xpRequired: xpRequiredForLevel(level),
            xpToNext: xpRequiredForLevel(level + 1) - xpRequiredForLevel(level),
        });
    }

    res.json({
        success: true,
        data: table,
    });
});

/**
 * POST /api/v1/economy/debug/add
 *
 * Debug endpoint to add XP/coins directly.
 * Only available in development mode.
 */
router.post('/debug/add', async (req: Request, res: Response) => {
    // Guard: only in dev mode
    if (config.nodeEnv !== 'development') {
        res.status(403).json({ error: 'Debug endpoint only available in development mode' });
        return;
    }

    try {
        const accountId = req.auth!.accountId;
        const { xp = 0, coins = 0 } = req.body;

        if (typeof xp !== 'number' || typeof coins !== 'number') {
            res.status(400).json({ error: 'xp and coins must be numbers' });
            return;
        }

        const newState = await debugAddRewards(accountId, xp, coins);

        console.log(`[Economy] Debug: Added ${xp} XP and ${coins} coins to ${accountId}`);

        res.json({
            success: true,
            data: newState,
        });
    } catch (err) {
        console.error('[Economy] Error in debug add:', err);
        res.status(500).json({ error: 'Failed to add rewards' });
    }
});

export default router;
