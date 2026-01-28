/**
 * Fusion Service
 *
 * Handles fusion logic for creatures and moves.
 * Burns input NFTs and mints upgraded output.
 */

import { query, getClient } from '../db/index.js';
import {
    CreatureDefinition,
    MoveDefinition,
    CREATURE_DEFINITIONS,
    MOVE_DEFINITIONS,
    CreatureRarity,
    ElementType,
} from '@nft-autobattler/shared-types';
import {
    mockRmrkService,
    CreatureNftMetadata,
    MoveNftMetadata,
} from '@nft-autobattler/rmrk-module';
import {
    getCreatureFusionRule,
    getMoveFusionRule,
    validateSameElement,
} from '../config/fusion.js';

// ============================================
// TYPES
// ============================================

export interface CreatureFusionResult {
    burnedCreatureIds: string[];
    newCreature: {
        dbId: string;
        nftId: string;
        creatureDefinitionId: string;
        definition: CreatureDefinition;
        rarity: CreatureRarity;
        stats: { hp: number; atk: number; def: number; spd: number };
    };
}

export interface MoveFusionResult {
    burnedMoveIds: string[];
    newMove: {
        dbId: string;
        nftId: string;
        moveDefinitionId: string;
        definition: MoveDefinition;
        rarity: CreatureRarity;
    };
}

// ============================================
// CREATURE FUSION
// ============================================

/**
 * Fuse 3 creatures of same element and rarity into 1 higher-rarity creature.
 */
export async function fuseCreatures(
    accountId: string,
    creatureDbIds: string[]
): Promise<CreatureFusionResult> {
    // Validate input count
    if (creatureDbIds.length !== 3) {
        throw new Error('Exactly 3 creatures are required for fusion');
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Load creatures and validate ownership
        const creaturesResult = await client.query(
            `SELECT id, account_id, unit_definition_id, rmrk_nft_id
             FROM player_units
             WHERE id = ANY($1)
             FOR UPDATE`,
            [creatureDbIds]
        );

        if (creaturesResult.rows.length !== 3) {
            throw new Error('One or more creatures not found');
        }

        // Validate all are owned by player
        for (const row of creaturesResult.rows) {
            if (row.account_id !== accountId) {
                throw new Error('One or more creatures not owned by you');
            }
        }

        // Get creature definitions and validate rarity/element
        const creatures = creaturesResult.rows.map((row) => {
            const def = CREATURE_DEFINITIONS.find(
                (c) => c.id === row.unit_definition_id
            );
            if (!def) {
                throw new Error(`Unknown creature definition: ${row.unit_definition_id}`);
            }
            return {
                dbId: row.id,
                nftId: row.rmrk_nft_id,
                definition: def,
            };
        });

        // Validate same rarity
        const rarities = creatures.map((c) => c.definition.rarity);
        const firstRarity = rarities[0];
        if (!rarities.every((r) => r === firstRarity)) {
            throw new Error('All creatures must have the same rarity');
        }

        // Validate same element
        const elements = creatures.map((c) => c.definition.elementType);
        if (!validateSameElement(elements)) {
            throw new Error('All creatures must have the same element type');
        }

        // Get fusion rule
        const rule = getCreatureFusionRule(firstRarity);
        if (!rule) {
            throw new Error(`Cannot fuse ${firstRarity} creatures`);
        }

        // Burn creatures from DB
        const burnedIds = creatures.map((c) => c.dbId);
        await client.query(
            `DELETE FROM player_units WHERE id = ANY($1)`,
            [burnedIds]
        );

        // Burn NFTs in RMRK mock
        for (const creature of creatures) {
            if (creature.nftId) {
                await mockRmrkService.burnCreatureNft(creature.nftId);
            }
        }

        // Select new creature of target rarity and same element
        const targetElement = elements[0];
        const targetRarity = rule.outputRarity;
        const candidateCreatures = CREATURE_DEFINITIONS.filter(
            (c) => c.rarity === targetRarity && c.elementType === targetElement
        );

        // Fallback: any creature of target rarity if none match element
        const pool =
            candidateCreatures.length > 0
                ? candidateCreatures
                : CREATURE_DEFINITIONS.filter((c) => c.rarity === targetRarity);

        if (pool.length === 0) {
            throw new Error(`No ${targetRarity} creatures available`);
        }

        const newCreatureDef = pool[Math.floor(Math.random() * pool.length)];

        // Generate IVs
        const ivs = {
            hp: Math.floor(Math.random() * 32),
            atk: Math.floor(Math.random() * 32),
            def: Math.floor(Math.random() * 32),
            spd: Math.floor(Math.random() * 32),
        };

        const stats = {
            hp: newCreatureDef.baseHp + ivs.hp,
            atk: newCreatureDef.baseAtk + ivs.atk,
            def: newCreatureDef.baseDef + ivs.def,
            spd: newCreatureDef.baseSpd + ivs.spd,
        };

        // Mint new creature NFT
        const metadata: CreatureNftMetadata = {
            creatureDefinitionId: newCreatureDef.id,
            level: 1,
            ivHp: ivs.hp,
            ivAtk: ivs.atk,
            ivDef: ivs.def,
            ivSpd: ivs.spd,
            elementType: newCreatureDef.elementType,
            rarity: newCreatureDef.rarity,
            movePoolIds: newCreatureDef.movePoolIds,
        };

        const newNftId = await mockRmrkService.mintCreatureNft(accountId, metadata);

        // Insert into roster
        const insertResult = await client.query(
            `INSERT INTO player_units (account_id, unit_definition_id, rmrk_nft_id)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [accountId, newCreatureDef.id, newNftId]
        );

        await client.query('COMMIT');

        console.log(
            `[Fusion] ${accountId} fused 3 ${firstRarity} ${targetElement} creatures ` +
            `→ 1 ${targetRarity} ${newCreatureDef.name}`
        );

        return {
            burnedCreatureIds: burnedIds,
            newCreature: {
                dbId: insertResult.rows[0].id,
                nftId: newNftId,
                creatureDefinitionId: newCreatureDef.id,
                definition: newCreatureDef,
                rarity: newCreatureDef.rarity,
                stats,
            },
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ============================================
// MOVE FUSION
// ============================================

/**
 * Get move rarity based on power (same logic as shop).
 */
function getMoveRarity(move: MoveDefinition): CreatureRarity {
    if (move.basePower >= 120) return 'LEGENDARY';
    if (move.basePower >= 90) return 'EPIC';
    if (move.basePower >= 60) return 'RARE';
    return 'COMMON';
}

/**
 * Fuse 3 moves of same element and rarity into 1 higher-rarity move.
 */
export async function fuseMoves(
    accountId: string,
    moveDbIds: string[]
): Promise<MoveFusionResult> {
    // Validate input count
    if (moveDbIds.length !== 3) {
        throw new Error('Exactly 3 moves are required for fusion');
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Load moves and validate ownership
        const movesResult = await client.query(
            `SELECT id, account_id, move_definition_id, rmrk_nft_id
             FROM player_moves
             WHERE id = ANY($1)
             FOR UPDATE`,
            [moveDbIds]
        );

        if (movesResult.rows.length !== 3) {
            throw new Error('One or more moves not found');
        }

        // Validate ownership
        for (const row of movesResult.rows) {
            if (row.account_id !== accountId) {
                throw new Error('One or more moves not owned by you');
            }
        }

        // Get move definitions
        const moves = movesResult.rows.map((row) => {
            const def = MOVE_DEFINITIONS.find((m) => m.id === row.move_definition_id);
            if (!def) {
                throw new Error(`Unknown move definition: ${row.move_definition_id}`);
            }
            return {
                dbId: row.id,
                nftId: row.rmrk_nft_id,
                definition: def,
                rarity: getMoveRarity(def),
            };
        });

        // Validate same rarity
        const rarities = moves.map((m) => m.rarity);
        const firstRarity = rarities[0];
        if (!rarities.every((r) => r === firstRarity)) {
            throw new Error('All moves must have the same rarity');
        }

        // Validate same element
        const elements = moves.map((m) => m.definition.elementType);
        if (!validateSameElement(elements)) {
            throw new Error('All moves must have the same element type');
        }

        // Get fusion rule
        const rule = getMoveFusionRule(firstRarity);
        if (!rule) {
            throw new Error(`Cannot fuse ${firstRarity} moves`);
        }

        // Burn moves from DB
        const burnedIds = moves.map((m) => m.dbId);
        await client.query(
            `DELETE FROM player_moves WHERE id = ANY($1)`,
            [burnedIds]
        );

        // Burn NFTs in RMRK mock
        for (const move of moves) {
            if (move.nftId) {
                await mockRmrkService.burnMoveNft(move.nftId);
            }
        }

        // Select new move of target rarity and same element
        const targetElement = elements[0];
        const targetRarity = rule.outputRarity;

        // Find moves that match target rarity and element
        const candidateMoves = MOVE_DEFINITIONS.filter(
            (m) => getMoveRarity(m) === targetRarity && m.elementType === targetElement
        );

        // Fallback: any move of target rarity
        const pool =
            candidateMoves.length > 0
                ? candidateMoves
                : MOVE_DEFINITIONS.filter((m) => getMoveRarity(m) === targetRarity);

        if (pool.length === 0) {
            throw new Error(`No ${targetRarity} moves available`);
        }

        const newMoveDef = pool[Math.floor(Math.random() * pool.length)];
        const newMoveRarity = getMoveRarity(newMoveDef);

        // Mint new move NFT
        const metadata: MoveNftMetadata = {
            moveDefinitionId: newMoveDef.id,
            rarity: newMoveRarity,
        };

        const newNftId = await mockRmrkService.mintMoveNft(accountId, metadata);

        // Insert into roster
        const insertResult = await client.query(
            `INSERT INTO player_moves (account_id, move_definition_id, rmrk_nft_id)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [accountId, newMoveDef.id, newNftId]
        );

        await client.query('COMMIT');

        console.log(
            `[Fusion] ${accountId} fused 3 ${firstRarity} ${targetElement} moves ` +
            `→ 1 ${targetRarity} ${newMoveDef.name}`
        );

        return {
            burnedMoveIds: burnedIds,
            newMove: {
                dbId: insertResult.rows[0].id,
                nftId: newNftId,
                moveDefinitionId: newMoveDef.id,
                definition: newMoveDef,
                rarity: newMoveRarity,
            },
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
