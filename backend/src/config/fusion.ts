/**
 * Fusion Configuration
 *
 * Defines fusion rules, ratios, and resulting rarities.
 */

import { CreatureRarity, ElementType } from '@nft-autobattler/shared-types';

// ============================================
// FUSION RULES
// ============================================

export interface FusionRule {
    /** Number of items required for fusion */
    inputCount: number;
    /** Required rarity of input items */
    inputRarity: CreatureRarity;
    /** Resulting rarity after fusion */
    outputRarity: CreatureRarity;
}

/**
 * Creature fusion rules.
 * Key: input rarity -> output rarity + count
 */
export const CREATURE_FUSION_RULES: Record<CreatureRarity, FusionRule | null> = {
    COMMON: {
        inputCount: 3,
        inputRarity: 'COMMON',
        outputRarity: 'RARE',
    },
    RARE: {
        inputCount: 3,
        inputRarity: 'RARE',
        outputRarity: 'EPIC',
    },
    EPIC: {
        inputCount: 3,
        inputRarity: 'EPIC',
        outputRarity: 'LEGENDARY',
    },
    LEGENDARY: null, // Cannot fuse legendary creatures
};

/**
 * Move fusion rules.
 */
export const MOVE_FUSION_RULES: Record<CreatureRarity, FusionRule | null> = {
    COMMON: {
        inputCount: 3,
        inputRarity: 'COMMON',
        outputRarity: 'RARE',
    },
    RARE: {
        inputCount: 3,
        inputRarity: 'RARE',
        outputRarity: 'EPIC',
    },
    EPIC: {
        inputCount: 3,
        inputRarity: 'EPIC',
        outputRarity: 'LEGENDARY',
    },
    LEGENDARY: null,
};

/**
 * Get fusion rule for creatures.
 */
export function getCreatureFusionRule(inputRarity: CreatureRarity): FusionRule | null {
    return CREATURE_FUSION_RULES[inputRarity];
}

/**
 * Get fusion rule for moves.
 */
export function getMoveFusionRule(inputRarity: CreatureRarity): FusionRule | null {
    return MOVE_FUSION_RULES[inputRarity];
}

/**
 * Validate that all items have same element type.
 */
export function validateSameElement(elements: ElementType[]): boolean {
    if (elements.length === 0) return false;
    const first = elements[0];
    return elements.every((e) => e === first);
}
