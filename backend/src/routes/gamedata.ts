import { Router, Request, Response } from 'express';
import { UNIT_DEFINITIONS, EQUIPMENT_DEFINITIONS } from '@nft-autobattler/shared-types';

const router = Router();

/**
 * GET /api/v1/gamedata/units
 * 
 * Get all unit definitions (public, no auth required)
 */
router.get('/units', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: UNIT_DEFINITIONS,
    });
});

/**
 * GET /api/v1/gamedata/equipment
 * 
 * Get all equipment definitions (public, no auth required)
 */
router.get('/equipment', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: EQUIPMENT_DEFINITIONS,
    });
});

/**
 * GET /api/v1/gamedata/all
 * 
 * Get all game data in one request
 */
router.get('/all', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            units: UNIT_DEFINITIONS,
            equipment: EQUIPMENT_DEFINITIONS,
        },
    });
});

export default router;
