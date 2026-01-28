/**
 * Economy Service
 *
 * Handles XP, levels, and soft currency (coins).
 */

import { query } from '../db/index.js';
import {
    PlayerEconomyState,
    BattleRewardPayload,
    EconomyConfig,
    BattleResult,
} from '@nft-autobattler/shared-types';

// ============================================
// CONFIGURATION
// ============================================

export const ECONOMY_CONFIG: EconomyConfig = {
    XP_WIN: 50,
    XP_LOSS: 20,
    XP_DRAW: 30,
    COINS_WIN: 30,
    COINS_LOSS: 10,
    COINS_DRAW: 15,
};

// ============================================
// LEVEL CALCULATION
// ============================================

/**
 * XP thresholds for each level.
 * Uses exponential formula: Level N requires sum of (100 * (N-1)) XP total.
 * Level 1: 0 XP
 * Level 2: 100 XP
 * Level 3: 300 XP (100 + 200)
 * Level 4: 600 XP (100 + 200 + 300)
 * etc.
 */
export function xpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    // Sum of 100 + 200 + 300 + ... + (level-1)*100
    // = 100 * (1 + 2 + ... + (level-1))
    // = 100 * (level-1) * level / 2
    // = 50 * level * (level - 1)
    return 50 * level * (level - 1);
}

/**
 * Calculate level from total XP.
 */
export function levelFromXp(xp: number): number {
    // Solve: 50 * level * (level - 1) <= xp
    // Quadratic: 50*level^2 - 50*level - xp <= 0
    // Using quadratic formula: level = (50 + sqrt(2500 + 200*xp)) / 100
    if (xp < 0) return 1;
    const level = Math.floor((50 + Math.sqrt(2500 + 200 * xp)) / 100);
    return Math.max(1, level);
}

/**
 * Get XP needed to reach next level.
 */
export function xpToNextLevel(currentXp: number): number {
    const currentLevel = levelFromXp(currentXp);
    const nextLevelXp = xpRequiredForLevel(currentLevel + 1);
    return Math.max(0, nextLevelXp - currentXp);
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Get player's current economy state.
 */
export async function getPlayerEconomy(accountId: string): Promise<PlayerEconomyState> {
    const result = await query(
        `SELECT xp, coins FROM accounts WHERE id = $1`,
        [accountId]
    );

    if (result.rows.length === 0) {
        throw new Error(`Account not found: ${accountId}`);
    }

    const { xp, coins } = result.rows[0];
    const level = levelFromXp(xp);

    return {
        xp,
        level,
        coins,
        xpToNextLevel: xpToNextLevel(xp),
    };
}

/**
 * Add XP and coins to player's account.
 */
export async function addRewards(
    accountId: string,
    xpGained: number,
    coinsGained: number
): Promise<BattleRewardPayload> {
    // Get current state
    const currentResult = await query(
        `SELECT xp, coins FROM accounts WHERE id = $1`,
        [accountId]
    );

    if (currentResult.rows.length === 0) {
        throw new Error(`Account not found: ${accountId}`);
    }

    const currentXp = currentResult.rows[0].xp;
    const currentCoins = currentResult.rows[0].coins;
    const currentLevel = levelFromXp(currentXp);

    // Calculate new values
    const newXp = currentXp + xpGained;
    const newCoins = currentCoins + coinsGained;
    const newLevel = levelFromXp(newXp);
    const leveledUp = newLevel > currentLevel;

    // Update database
    await query(
        `UPDATE accounts SET xp = $1, coins = $2 WHERE id = $3`,
        [newXp, newCoins, accountId]
    );

    return {
        xpGained,
        coinsGained,
        newXp,
        newLevel,
        newCoins,
        leveledUp,
    };
}

/**
 * Calculate and apply rewards based on battle result.
 */
export async function applyBattleRewards(
    accountId: string,
    result: BattleResult,
    isPlayer1: boolean
): Promise<BattleRewardPayload> {
    let xpGained: number;
    let coinsGained: number;

    // Determine if player won
    const playerWon =
        (isPlayer1 && result === 'PLAYER1_WIN') ||
        (!isPlayer1 && result === 'PLAYER2_WIN');
    const playerLost =
        (isPlayer1 && result === 'PLAYER2_WIN') ||
        (!isPlayer1 && result === 'PLAYER1_WIN');

    if (playerWon) {
        xpGained = ECONOMY_CONFIG.XP_WIN;
        coinsGained = ECONOMY_CONFIG.COINS_WIN;
    } else if (playerLost) {
        xpGained = ECONOMY_CONFIG.XP_LOSS;
        coinsGained = ECONOMY_CONFIG.COINS_LOSS;
    } else {
        // Draw
        xpGained = ECONOMY_CONFIG.XP_DRAW;
        coinsGained = ECONOMY_CONFIG.COINS_DRAW;
    }

    return addRewards(accountId, xpGained, coinsGained);
}

/**
 * Debug function to add XP/coins directly.
 * Only for development/testing.
 */
export async function debugAddRewards(
    accountId: string,
    xp: number = 0,
    coins: number = 0
): Promise<PlayerEconomyState> {
    await query(
        `UPDATE accounts SET xp = xp + $1, coins = coins + $2 WHERE id = $3`,
        [xp, coins, accountId]
    );

    return getPlayerEconomy(accountId);
}
