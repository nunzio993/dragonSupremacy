/**
 * Shop API Service
 *
 * Handles shop-related API calls.
 */

import { PlayerEconomyState, CreatureDefinition, MoveDefinition, CreatureRarity } from '@nft-autobattler/shared-types';

// ============================================
// TYPES
// ============================================

export interface PackInfo {
    id: string;
    name: string;
    description: string;
    type: 'CREATURE' | 'MOVE';
    costCoins: number;
}

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

export interface OpenPackResponse {
    newEconomyState: PlayerEconomyState;
    reward: PackReward;
}

// ============================================
// API FUNCTIONS
// ============================================

const API_BASE = '/api/v1';

function getToken(): string {
    return localStorage.getItem('autobattler_token') || '';
}

/**
 * Get list of available packs.
 */
export async function getPacks(): Promise<PackInfo[]> {
    const response = await fetch(`${API_BASE}/shop/packs`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch packs');
    }

    return data.data.packs;
}

/**
 * Open a pack and receive reward.
 */
export async function openPack(packId: string): Promise<OpenPackResponse> {
    const response = await fetch(`${API_BASE}/shop/open`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ packId }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to open pack');
    }

    return data.data;
}

export default {
    getPacks,
    openPack,
};
