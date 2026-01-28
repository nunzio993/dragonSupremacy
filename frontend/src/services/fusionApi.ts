/**
 * Fusion API Service
 *
 * Handles fusion-related API calls.
 */

import { CreatureRarity, ElementType } from '@nft-autobattler/shared-types';

// ============================================
// TYPES
// ============================================

export interface CreatureFusionResponse {
    burnedCreatureIds: string[];
    newCreature: {
        id: string;
        nftId: string;
        creatureDefinitionId: string;
        name: string;
        elementType: ElementType;
        rarity: CreatureRarity;
        stats: {
            hp: number;
            atk: number;
            def: number;
            spd: number;
        };
    };
}

export interface MoveFusionResponse {
    burnedMoveIds: string[];
    newMove: {
        id: string;
        nftId: string;
        moveDefinitionId: string;
        name: string;
        elementType: ElementType;
        rarity: CreatureRarity;
        basePower: number;
        accuracy: number;
    };
}

export interface FusionRule {
    inputCount: number;
    inputRarity: CreatureRarity;
    outputRarity: CreatureRarity;
}

export interface FusionRulesResponse {
    creatures: Record<CreatureRarity, FusionRule | null>;
    moves: Record<CreatureRarity, FusionRule | null>;
    requirements: {
        sameElement: boolean;
        sameRarity: boolean;
        count: number;
    };
}

// ============================================
// API FUNCTIONS
// ============================================

const API_BASE = '/api/v1';

function getToken(): string {
    return localStorage.getItem('autobattler_token') || '';
}

/**
 * Get fusion rules.
 */
export async function getFusionRules(): Promise<FusionRulesResponse> {
    const response = await fetch(`${API_BASE}/fusion/rules`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch fusion rules');
    }

    return data.data;
}

/**
 * Fuse 3 creatures into 1 higher-rarity creature.
 */
export async function fuseCreatures(creatureIds: string[]): Promise<CreatureFusionResponse> {
    const response = await fetch(`${API_BASE}/fusion/creatures`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ creatureIds }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fuse creatures');
    }

    return data.data;
}

/**
 * Fuse 3 moves into 1 higher-rarity move.
 */
export async function fuseMoves(moveIds: string[]): Promise<MoveFusionResponse> {
    const response = await fetch(`${API_BASE}/fusion/moves`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ moveIds }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fuse moves');
    }

    return data.data;
}

export default {
    getFusionRules,
    fuseCreatures,
    fuseMoves,
};
