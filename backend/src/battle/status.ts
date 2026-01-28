/**
 * Status Effects Processing Module
 */

import { DeterministicRNG } from './rng.js';
import { BattleCreature, StatusEffectType, StatusTickResult } from './types.js';

/**
 * Process all status effects at end of turn
 */
export function processStatusEffects(
    rng: DeterministicRNG,
    creature: BattleCreature
): StatusTickResult[] {
    const results: StatusTickResult[] = [];

    for (const effect of creature.statusEffects) {
        const result = processStatusEffect(rng, creature, effect.type);
        result.expired = effect.turnsRemaining <= 1;
        results.push(result);

        // Decrement duration
        effect.turnsRemaining--;
    }

    // Remove expired effects
    creature.statusEffects = creature.statusEffects.filter(
        e => e.turnsRemaining > 0
    );

    return results;
}

/**
 * Process individual status effect
 */
function processStatusEffect(
    rng: DeterministicRNG,
    creature: BattleCreature,
    effectType: StatusEffectType
): StatusTickResult {
    const result: StatusTickResult = {
        creatureId: creature.id,
        effectType,
        expired: false
    };

    switch (effectType) {
        case 'BURN':
            // -10% HP per turn
            const burnDamage = Math.ceil(creature.maxHp * 0.10);
            creature.currentHp = Math.max(0, creature.currentHp - burnDamage);
            result.damage = burnDamage;
            break;

        case 'POISON':
            // -8% HP per turn
            const poisonDamage = Math.ceil(creature.maxHp * 0.08);
            creature.currentHp = Math.max(0, creature.currentHp - poisonDamage);
            result.damage = poisonDamage;
            break;

        case 'DRAIN':
            // Handled in the drain source's turn (heals attacker)
            // Here we just tick the duration
            break;

        // FREEZE, PARALYZE, STUN, BLIND, FEAR, SLOW
        // These are handled during action phase, not end of turn
        default:
            break;
    }

    return result;
}

/**
 * Check if creature can act this turn
 * Returns: { canAct: boolean, reason?: string }
 */
export function checkCanAct(
    rng: DeterministicRNG,
    creature: BattleCreature
): { canAct: boolean; reason?: string } {
    // Check FREEZE
    const freezeEffect = creature.statusEffects.find(s => s.type === 'FREEZE');
    if (freezeEffect) {
        // First turn always skips, then 30% chance to stay frozen
        if (freezeEffect.turnsRemaining > 0) {
            return { canAct: false, reason: 'FROZEN' };
        }
    }

    // Check STUN
    const stunEffect = creature.statusEffects.find(s => s.type === 'STUN');
    if (stunEffect) {
        return { canAct: false, reason: 'STUNNED' };
    }

    // Check PARALYZE (25% chance to skip)
    const paralyzeEffect = creature.statusEffects.find(s => s.type === 'PARALYZE');
    if (paralyzeEffect) {
        if (rng.chance(0.25)) {
            return { canAct: false, reason: 'PARALYZED' };
        }
    }

    return { canAct: true };
}

/**
 * Get effective SPD (for turn order)
 */
export function getEffectiveSpeed(creature: BattleCreature): number {
    let speed = creature.attributes.SPD;

    // PARALYZE: -30% SPD
    if (creature.statusEffects.find(s => s.type === 'PARALYZE')) {
        speed *= 0.70;
    }

    // SLOW: -40% SPD
    if (creature.statusEffects.find(s => s.type === 'SLOW')) {
        speed *= 0.60;
    }

    return Math.round(speed);
}

/**
 * Decrement all cooldowns by 1
 */
export function tickCooldowns(creature: BattleCreature): void {
    for (const moveId of Object.keys(creature.cooldowns)) {
        if (creature.cooldowns[moveId] > 0) {
            creature.cooldowns[moveId]--;
        }
    }
}

/**
 * Get available moves (not on cooldown)
 * IMPORTANT: Always returns at least one move - if all on cooldown, returns the one with lowest cooldown
 */
export function getAvailableMoves(creature: BattleCreature): typeof creature.moves {
    const available = creature.moves.filter(move => {
        const cd = creature.cooldowns[move.moveId] ?? 0;
        return cd === 0;
    });

    // If all moves are on cooldown, return the one with the lowest remaining cooldown
    // This ensures the player always has at least one option (a "Struggle" fallback)
    if (available.length === 0 && creature.moves.length > 0) {
        // Sort by cooldown and return the one that will be available soonest
        const sortedByCooldown = [...creature.moves].sort((a, b) => {
            const cdA = creature.cooldowns[a.moveId] ?? 0;
            const cdB = creature.cooldowns[b.moveId] ?? 0;
            return cdA - cdB;
        });
        // Return the first move (lowest cooldown) - it will be usable anyway as a last resort
        return [sortedByCooldown[0]];
    }

    return available;
}

/**
 * Apply HEAL status (instant effect)
 */
export function applyHeal(creature: BattleCreature, percentage: number = 0.30): number {
    const healAmount = Math.ceil(creature.maxHp * percentage);
    const oldHp = creature.currentHp;
    creature.currentHp = Math.min(creature.maxHp, creature.currentHp + healAmount);
    return creature.currentHp - oldHp;
}

/**
 * Apply CLEANSE (remove all negative status + small heal)
 */
export function applyCleanse(creature: BattleCreature): string[] {
    const removedEffects = creature.statusEffects
        .filter(e => isNegativeStatus(e.type))
        .map(e => e.type);

    creature.statusEffects = creature.statusEffects.filter(
        e => !isNegativeStatus(e.type)
    );

    // Small heal (15%)
    applyHeal(creature, 0.15);

    return removedEffects;
}

function isNegativeStatus(type: StatusEffectType): boolean {
    return ['BURN', 'FREEZE', 'POISON', 'PARALYZE', 'STUN', 'BLIND', 'FEAR', 'SLOW'].includes(type);
}
