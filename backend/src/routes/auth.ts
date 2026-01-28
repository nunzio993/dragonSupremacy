import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { query } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import config from '../config.js';
import { mockRmrkService } from '@nft-autobattler/rmrk-module';
import { UNIT_DEFINITIONS, EQUIPMENT_DEFINITIONS } from '@nft-autobattler/shared-types';

const router = Router();

// SECURITY: Rate limit guest account creation to prevent abuse
const guestAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 accounts per IP per window
    message: { error: 'Too many accounts created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * POST /api/v1/auth/guest
 * 
 * Create a new guest account with starter units and equipment.
 * Returns a JWT token for authentication.
 */
router.post('/guest', guestAccountLimiter, async (req: Request, res: Response) => {
    try {
        // Create account in DB
        const accountId = uuidv4();
        await query(
            `INSERT INTO accounts (id, xp, level, soft_currency) VALUES ($1, $2, $3, $4)`,
            [accountId, 0, 1, config.startingSoftCurrency]
        );

        // Give starter units (first 4 common units)
        const starterUnits = UNIT_DEFINITIONS.filter((u) => u.rarity === 'common').slice(0, 4);
        for (const unitDef of starterUnits) {
            // Mint RMRK NFT
            const nftId = await mockRmrkService.mintUnitNFT(accountId, unitDef.id);

            // Save to DB
            await query(
                `INSERT INTO player_units (account_id, unit_definition_id, rmrk_nft_id) VALUES ($1, $2, $3)`,
                [accountId, unitDef.id, nftId]
            );
        }

        // Give starter equipment (first 4 equipment)
        const starterEquip = EQUIPMENT_DEFINITIONS.slice(0, 4);
        for (const equipDef of starterEquip) {
            // Mint RMRK NFT
            const nftId = await mockRmrkService.mintEquipNFT(accountId, equipDef.id);

            // Save to DB
            await query(
                `INSERT INTO player_equipment (account_id, equipment_definition_id, rmrk_nft_id) VALUES ($1, $2, $3)`,
                [accountId, equipDef.id, nftId]
            );
        }

        // Create empty loadout
        await query(
            `INSERT INTO loadouts (account_id, unit_ids) VALUES ($1, $2)`,
            [accountId, []]
        );

        // Generate token
        const token = generateToken(accountId);

        res.status(201).json({
            success: true,
            data: {
                accountId,
                token,
                starterUnits: starterUnits.map((u) => u.id),
                starterEquipment: starterEquip.map((e) => e.id),
            },
        });
    } catch (err) {
        console.error('[Auth] Error creating guest account:', err);
        res.status(500).json({ error: 'Failed to create guest account' });
    }
});

export default router;
