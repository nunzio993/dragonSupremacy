/**
 * HP Service - Off-chain HP management
 * Tracks creature HP after battles with time-based regeneration
 */

import { query } from '../db/index.js';
import { ethers } from 'ethers';

// Config - should match GameConfig.sol defaults
const HP_REGEN_PERCENT_PER_HOUR = 5; // 5% of max HP per hour
const HEAL_COST_PER_HP = 0.1; // 0.1 DGNE per HP

interface CreatureHP {
    tokenId: bigint;
    currentHp: number;
    maxHp: number;
    lastDamageTime: Date | null;
}

/**
 * Get creature HP with regeneration calculated
 */
export async function getCreatureHp(tokenId: bigint): Promise<CreatureHP | null> {
    const result = await query(
        `SELECT token_id, current_hp, max_hp, last_damage_time 
         FROM creature_hp WHERE token_id = $1`,
        [tokenId.toString()]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    let currentHp = row.current_hp;
    const maxHp = row.max_hp;
    const lastDamageTime = row.last_damage_time;

    // Calculate regeneration if damaged
    if (lastDamageTime && currentHp < maxHp) {
        const elapsed = Date.now() - new Date(lastDamageTime).getTime();
        const hoursElapsed = elapsed / (1000 * 60 * 60);
        const regenAmount = Math.floor(maxHp * HP_REGEN_PERCENT_PER_HOUR * hoursElapsed / 100);
        currentHp = Math.min(maxHp, currentHp + regenAmount);
    }

    return {
        tokenId,
        currentHp,
        maxHp,
        lastDamageTime
    };
}

/**
 * Initialize HP for a new creature
 */
export async function initializeCreatureHp(tokenId: bigint, maxHp: number): Promise<void> {
    await query(
        `INSERT INTO creature_hp (token_id, current_hp, max_hp, last_damage_time)
         VALUES ($1, $2, $2, NULL)
         ON CONFLICT (token_id) DO UPDATE SET max_hp = $2, current_hp = $2`,
        [tokenId.toString(), maxHp]
    );
}

/**
 * Apply damage to creature (after battle)
 */
export async function applyDamage(tokenId: bigint, damage: number): Promise<number> {
    // First get current HP with regen
    const creature = await getCreatureHp(tokenId);
    if (!creature) {
        throw new Error(`Creature ${tokenId} not found in HP system`);
    }

    const newHp = Math.max(0, creature.currentHp - damage);

    await query(
        `UPDATE creature_hp 
         SET current_hp = $2, last_damage_time = NOW()
         WHERE token_id = $1`,
        [tokenId.toString(), newHp]
    );

    console.log(`[HP] Creature #${tokenId} took ${damage} damage. HP: ${creature.currentHp} -> ${newHp}`);

    return newHp;
}

/**
 * Heal creature instantly (requires token burn verification)
 * @param tokenId Creature to heal
 * @param txHash Transaction hash of the token burn
 * @returns New HP after healing
 */
export async function healInstant(tokenId: bigint, txHash: string): Promise<number> {
    // TODO: Verify transaction on-chain
    // For now, just heal to full
    const creature = await getCreatureHp(tokenId);
    if (!creature) {
        throw new Error(`Creature ${tokenId} not found in HP system`);
    }

    const hpToHeal = creature.maxHp - creature.currentHp;
    const requiredBurn = hpToHeal * HEAL_COST_PER_HP;

    // TODO: Verify txHash burned at least requiredBurn DGNE
    console.log(`[HP] Verifying tx ${txHash} burned ${requiredBurn} DGNE for ${hpToHeal} HP heal`);

    await query(
        `UPDATE creature_hp 
         SET current_hp = max_hp, last_damage_time = NULL
         WHERE token_id = $1`,
        [tokenId.toString()]
    );

    console.log(`[HP] Creature #${tokenId} healed to full HP (${creature.maxHp})`);

    return creature.maxHp;
}

/**
 * Get heal cost for a creature
 */
export async function getHealCost(tokenId: bigint): Promise<{ hpToHeal: number; costDGNE: number }> {
    const creature = await getCreatureHp(tokenId);
    if (!creature) {
        throw new Error(`Creature ${tokenId} not found`);
    }

    const hpToHeal = creature.maxHp - creature.currentHp;
    const costDGNE = hpToHeal * HEAL_COST_PER_HP;

    return { hpToHeal, costDGNE };
}

/**
 * Check if creature can battle (has HP > 0)
 */
export async function canBattle(tokenId: bigint): Promise<boolean> {
    const creature = await getCreatureHp(tokenId);
    if (!creature) {
        // Not in system = can battle (will be initialized)
        return true;
    }
    return creature.currentHp > 0;
}

// Export service singleton
export const hpService = {
    getCreatureHp,
    initializeCreatureHp,
    applyDamage,
    healInstant,
    getHealCost,
    canBattle
};
