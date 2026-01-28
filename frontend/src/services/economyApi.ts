/**
 * Economy API Service
 *
 * Handles economy-related API calls (XP, level, coins).
 */

import { PlayerEconomyState, EconomyConfig } from '@nft-autobattler/shared-types';

const API_BASE = '/api/v1';

/**
 * Get current player economy state.
 */
export async function getEconomyState(): Promise<PlayerEconomyState> {
    const token = localStorage.getItem('autobattler_token');

    const response = await fetch(`${API_BASE}/economy/state`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch economy state');
    }

    return data.data;
}

/**
 * Get economy configuration (reward amounts).
 */
export async function getEconomyConfig(): Promise<EconomyConfig> {
    const token = localStorage.getItem('autobattler_token');

    const response = await fetch(`${API_BASE}/economy/config`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch economy config');
    }

    return data.data;
}

/**
 * Get level progression table.
 */
export async function getLevelTable(): Promise<Array<{
    level: number;
    xpRequired: number;
    xpToNext: number;
}>> {
    const token = localStorage.getItem('autobattler_token');

    const response = await fetch(`${API_BASE}/economy/level-table`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch level table');
    }

    return data.data;
}

export default {
    getEconomyState,
    getEconomyConfig,
    getLevelTable,
};
