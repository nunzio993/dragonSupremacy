/**
 * Shop Configuration
 *
 * Defines pack types, costs, and reward distributions.
 */

import { CreatureRarity } from '@nft-autobattler/shared-types';

// ============================================
// PACK DEFINITIONS
// ============================================

export type PackType = 'CREATURE' | 'MOVE';

export interface PackDefinition {
    id: string;
    name: string;
    description: string;
    type: PackType;
    costCoins: number;
    /** Rarity weights (must sum to 100) */
    rarityWeights: {
        COMMON: number;
        RARE: number;
        EPIC: number;
        LEGENDARY: number;
    };
}

export const PACK_DEFINITIONS: PackDefinition[] = [
    {
        id: 'CREATURE_BASIC_PACK',
        name: 'Basic Creature Pack',
        description: 'Contains 1 random creature. Higher chance for Common creatures.',
        type: 'CREATURE',
        costCoins: 100,
        rarityWeights: {
            COMMON: 70,
            RARE: 25,
            EPIC: 5,
            LEGENDARY: 0,
        },
    },
    {
        id: 'CREATURE_RARE_PACK',
        name: 'Rare Creature Pack',
        description: 'Contains 1 random creature. Guaranteed Rare or better!',
        type: 'CREATURE',
        costCoins: 300,
        rarityWeights: {
            COMMON: 0,
            RARE: 60,
            EPIC: 35,
            LEGENDARY: 5,
        },
    },
    {
        id: 'MOVE_BASIC_PACK',
        name: 'Basic Move Pack',
        description: 'Contains 1 random move NFT.',
        type: 'MOVE',
        costCoins: 80,
        rarityWeights: {
            COMMON: 70,
            RARE: 25,
            EPIC: 5,
            LEGENDARY: 0,
        },
    },
    {
        id: 'MOVE_RARE_PACK',
        name: 'Rare Move Pack',
        description: 'Contains 1 random move. Guaranteed Rare or better!',
        type: 'MOVE',
        costCoins: 250,
        rarityWeights: {
            COMMON: 0,
            RARE: 55,
            EPIC: 40,
            LEGENDARY: 5,
        },
    },
];

export const PACK_BY_ID: Record<string, PackDefinition> = Object.fromEntries(
    PACK_DEFINITIONS.map((p) => [p.id, p])
);

// ============================================
// RARITY SELECTION HELPERS
// ============================================

/**
 * Select a rarity based on weighted probabilities.
 * @param weights Rarity weights (should sum to 100)
 * @returns Selected rarity
 */
export function selectRarity(weights: PackDefinition['rarityWeights']): CreatureRarity {
    const roll = Math.random() * 100;
    let cumulative = 0;

    cumulative += weights.COMMON;
    if (roll < cumulative) return 'COMMON';

    cumulative += weights.RARE;
    if (roll < cumulative) return 'RARE';

    cumulative += weights.EPIC;
    if (roll < cumulative) return 'EPIC';

    return 'LEGENDARY';
}
