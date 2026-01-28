/**
 * Shop Service
 *
 * Handles pack opening logic with RMRK minting and roster integration.
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
import { PACK_BY_ID, selectRarity, PackDefinition } from '../config/shop.js';
import { getPlayerEconomy } from './economy.js';
import { PlayerEconomyState } from '@nft-autobattler/shared-types';

// ============================================
// TYPES
// ============================================

export interface CreatureReward {
    type: 'CREATURE';
    nftId: string;
    creatureDefinitionId: string;
    definition: CreatureDefinition;
    stats: {
        hp: number;
        atk: number;
        def: number;
        spd: number;
    };
    rarity: CreatureRarity;
}

export interface MoveReward {
    type: 'MOVE';
    nftId: string;
    moveDefinitionId: string;
    definition: MoveDefinition;
    rarity: CreatureRarity;
}

export type PackReward = CreatureReward | MoveReward;

export interface OpenPackResult {
    newEconomyState: PlayerEconomyState;
    reward: PackReward;
}

// ============================================
// CREATURE SELECTION
// ============================================

/**
 * Get creatures by rarity.
 */
function getCreaturesByRarity(rarity: CreatureRarity): CreatureDefinition[] {
    return CREATURE_DEFINITIONS.filter((c) => c.rarity === rarity);
}

/**
 * Select a random creature of the given rarity.
 * Falls back to lower rarity if none exist.
 */
function selectCreature(targetRarity: CreatureRarity): CreatureDefinition {
    const rarityOrder: CreatureRarity[] = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    const startIdx = rarityOrder.indexOf(targetRarity);

    for (let i = startIdx; i < rarityOrder.length; i++) {
        const pool = getCreaturesByRarity(rarityOrder[i]);
        if (pool.length > 0) {
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    // Fallback to first creature
    return CREATURE_DEFINITIONS[0];
}

/**
 * Generate random IVs (0-31) for creature stats.
 */
function generateIVs(): { hp: number; atk: number; def: number; spd: number } {
    return {
        hp: Math.floor(Math.random() * 32),
        atk: Math.floor(Math.random() * 32),
        def: Math.floor(Math.random() * 32),
        spd: Math.floor(Math.random() * 32),
    };
}

// ============================================
// MOVE SELECTION
// ============================================

/**
 * Assign rarity to moves based on power (since MoveDefinition doesn't have rarity).
 */
function getMoveRarity(move: MoveDefinition): CreatureRarity {
    if (move.basePower >= 120) return 'LEGENDARY';
    if (move.basePower >= 90) return 'EPIC';
    if (move.basePower >= 60) return 'RARE';
    return 'COMMON';
}

/**
 * Get moves by effective rarity.
 */
function getMovesByRarity(rarity: CreatureRarity): MoveDefinition[] {
    return MOVE_DEFINITIONS.filter((m) => getMoveRarity(m) === rarity);
}

/**
 * Select a random move of the given rarity.
 */
function selectMove(targetRarity: CreatureRarity): MoveDefinition {
    const rarityOrder: CreatureRarity[] = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    const startIdx = rarityOrder.indexOf(targetRarity);

    for (let i = startIdx; i < rarityOrder.length; i++) {
        const pool = getMovesByRarity(rarityOrder[i]);
        if (pool.length > 0) {
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    // Fallback to first move
    return MOVE_DEFINITIONS[0];
}

// ============================================
// PACK OPENING
// ============================================

/**
 * Open a pack for a player.
 * Uses a transaction to ensure atomicity.
 */
export async function openPack(
    accountId: string,
    packId: string
): Promise<OpenPackResult> {
    const pack = PACK_BY_ID[packId];
    if (!pack) {
        throw new Error(`Unknown pack: ${packId}`);
    }

    // Get a database client for transaction
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Check player coins
        const accountResult = await client.query(
            `SELECT coins FROM accounts WHERE id = $1 FOR UPDATE`,
            [accountId]
        );

        if (accountResult.rows.length === 0) {
            throw new Error('Account not found');
        }

        const currentCoins = accountResult.rows[0].coins;
        if (currentCoins < pack.costCoins) {
            throw new Error(`Insufficient coins. Need ${pack.costCoins}, have ${currentCoins}`);
        }

        // Deduct coins
        await client.query(
            `UPDATE accounts SET coins = coins - $1 WHERE id = $2`,
            [pack.costCoins, accountId]
        );

        // Select rarity and reward
        const selectedRarity = selectRarity(pack.rarityWeights);
        let reward: PackReward;

        if (pack.type === 'CREATURE') {
            reward = await mintCreatureReward(accountId, selectedRarity, client);
        } else {
            reward = await mintMoveReward(accountId, selectedRarity, client);
        }

        await client.query('COMMIT');

        // Get updated economy state
        const newEconomyState = await getPlayerEconomy(accountId);

        console.log(
            `[Shop] ${accountId} opened ${packId}: got ${reward.type} ` +
            `(${reward.type === 'CREATURE' ? reward.creatureDefinitionId : reward.moveDefinitionId}) ` +
            `[${selectedRarity}]`
        );

        return { newEconomyState, reward };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Mint a creature NFT and add to roster.
 */
async function mintCreatureReward(
    accountId: string,
    rarity: CreatureRarity,
    client: any
): Promise<CreatureReward> {
    const creature = selectCreature(rarity);
    const ivs = generateIVs();

    // Calculate actual stats with IVs
    const stats = {
        hp: creature.baseHp + ivs.hp,
        atk: creature.baseAtk + ivs.atk,
        def: creature.baseDef + ivs.def,
        spd: creature.baseSpd + ivs.spd,
    };

    // Prepare NFT metadata
    const metadata: CreatureNftMetadata = {
        creatureDefinitionId: creature.id,
        level: 1,
        ivHp: ivs.hp,
        ivAtk: ivs.atk,
        ivDef: ivs.def,
        ivSpd: ivs.spd,
        elementType: creature.elementType,
        rarity: creature.rarity,
        movePoolIds: creature.movePoolIds,
    };

    // Mint NFT via RMRK mock
    const nftId = await mockRmrkService.mintCreatureNft(accountId, metadata);

    // Insert into roster DB (using player_units table for now)
    await client.query(
        `INSERT INTO player_units (account_id, unit_definition_id, rmrk_nft_id)
         VALUES ($1, $2, $3)`,
        [accountId, creature.id, nftId]
    );

    return {
        type: 'CREATURE',
        nftId,
        creatureDefinitionId: creature.id,
        definition: creature,
        stats,
        rarity: creature.rarity,
    };
}

/**
 * Mint a move NFT and add to roster.
 */
async function mintMoveReward(
    accountId: string,
    rarity: CreatureRarity,
    client: any
): Promise<MoveReward> {
    const move = selectMove(rarity);
    const actualRarity = getMoveRarity(move);

    // Prepare NFT metadata
    const metadata: MoveNftMetadata = {
        moveDefinitionId: move.id,
        rarity: actualRarity,
    };

    // Mint NFT via RMRK mock
    const nftId = await mockRmrkService.mintMoveNft(accountId, metadata);

    // Insert into player_moves table
    await client.query(
        `INSERT INTO player_moves (account_id, move_definition_id, rmrk_nft_id)
         VALUES ($1, $2, $3)`,
        [accountId, move.id, nftId]
    );

    return {
        type: 'MOVE',
        nftId,
        moveDefinitionId: move.id,
        definition: move,
        rarity: actualRarity,
    };
}
