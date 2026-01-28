/**
 * Damage Calculation Module
 * All formulas are deterministic given the same RNG state
 */

import { DeterministicRNG } from './rng.js';
import {
    BattleCreature,
    Move,
    ElementType,
    TEMPERAMENT_MODIFIERS,
    ActionResult
} from './types.js';

// Type effectiveness matrix
// 1.5 = super effective, 0.67 = resisted, 1.0 = neutral
const TYPE_CHART: Record<ElementType, Partial<Record<ElementType, number>>> = {
    FIRE: {
        GRASS: 1.5,
        ICE: 1.5,
        WATER: 0.67,
        EARTH: 0.67,
    },
    WATER: {
        FIRE: 1.5,
        EARTH: 1.5,
        GRASS: 0.67,
        ELECTRIC: 0.67,
    },
    GRASS: {
        WATER: 1.5,
        EARTH: 1.5,
        FIRE: 0.67,
        ICE: 0.67,
    },
    ELECTRIC: {
        WATER: 1.5,
        LIGHT: 1.5,
        EARTH: 0.67,
        GRASS: 0.67,
    },
    ICE: {
        GRASS: 1.5,
        EARTH: 1.5,
        FIRE: 0.67,
        WATER: 0.67,
    },
    EARTH: {
        FIRE: 1.5,
        ELECTRIC: 1.5,
        WATER: 0.67,
        GRASS: 0.67,
    },
    DARK: {
        LIGHT: 1.5,
        GRASS: 1.5,
        DARK: 0.67,
        FIRE: 0.67,
    },
    LIGHT: {
        DARK: 1.5,
        ICE: 1.5,
        LIGHT: 0.67,
        ELECTRIC: 0.67,
    },
};

/**
 * Get type effectiveness multiplier
 */
export function getTypeEffectiveness(
    attackType: ElementType,
    defenderType: ElementType
): number {
    return TYPE_CHART[attackType]?.[defenderType] ?? 1.0;
}

/**
 * Calculate if attack hits
 */
export function calculateHit(
    rng: DeterministicRNG,
    attacker: BattleCreature,
    defender: BattleCreature,
    move: Move
): boolean {
    const tempMod = TEMPERAMENT_MODIFIERS[attacker.temperament];

    // Base accuracy from move
    let accuracy = move.accuracy / 100;

    // Apply temperament modifier
    accuracy *= tempMod.accMult;

    // Apply defender's REF (special defense evasion)
    const refEvasion = (defender.attributes.REF - 50) / 200; // -0.25 to +0.25

    // Apply defender's AGI (agility dodge)
    // AGI 80 = +10% dodge, AGI 30 = -6.7% dodge
    const agiEvasion = (defender.attributes.AGI - 50) / 300;

    accuracy -= refEvasion + agiEvasion;

    // Apply attacker's SPD (fast but less precise)
    // SPD 80 = -5% accuracy, SPD 30 = +2.5% accuracy
    const spdPenalty = (attacker.attributes.SPD - 50) / 600;
    accuracy -= spdPenalty;

    // Apply blind status
    const blindEffect = attacker.statusEffects.find(s => s.type === 'BLIND');
    if (blindEffect) {
        accuracy *= 0.70; // -30% accuracy
    }

    // Clamp and apply miss floor
    accuracy = Math.max(tempMod.missFloor, Math.min(0.99, accuracy));

    return rng.chance(accuracy);
}

/**
 * Calculate if attack is critical
 */
export function calculateCritical(
    rng: DeterministicRNG,
    attacker: BattleCreature
): boolean {
    const tempMod = TEMPERAMENT_MODIFIERS[attacker.temperament];

    // Base crit rate
    let critChance = 0.05; // 5% base

    // Apply PRC stat: (PRC - 50) / 400 = -0.125 to +0.125
    const prcBonus = (attacker.attributes.PRC - 50) / 400;
    critChance += prcBonus;

    // Apply temperament modifier
    critChance += tempMod.critAdd;

    // Clamp
    critChance = Math.max(0.01, Math.min(0.30, critChance));

    return rng.chance(critChance);
}

/**
 * Calculate damage dealt - BALANCED FORMULA
 * Uses sqrt for stat ratio to prevent explosive damage
 */
export function calculateDamage(
    rng: DeterministicRNG,
    attacker: BattleCreature,
    defender: BattleCreature,
    move: Move,
    isCritical: boolean
): number {
    // STATUS moves deal no damage
    if (move.category === 'STATUS' || move.power === 0) {
        return 0;
    }

    // Attack stat based on category: STR for PHYSICAL, INT for SPECIAL
    const attackStat = move.category === 'PHYSICAL'
        ? attacker.attributes.STR
        : attacker.attributes.INT;

    // Defense stat: END for PHYSICAL, REF for SPECIAL
    const defenseStat = move.category === 'PHYSICAL'
        ? defender.attributes.END
        : defender.attributes.REF;

    // BALANCED: Use sqrt of ratio to prevent explosive damage
    // ATK 80 vs DEF 40 = sqrt(2) = 1.41x instead of 2.0x
    const statRatio = Math.sqrt(Math.max(0.25, attackStat / Math.max(1, defenseStat)));

    // Type effectiveness - REDUCED from 1.5/0.67 to 1.25/0.8
    const rawTypeMultiplier = getTypeEffectiveness(move.type, defender.elementType);
    const typeMultiplier = rawTypeMultiplier > 1 ? 1.25 : (rawTypeMultiplier < 1 ? 0.8 : 1.0);

    // Aptitude vs type - REDUCED range
    const rawAptitude = attacker.aptitudeVsType[defender.elementType] ?? 1.0;
    const aptitude = 0.9 + (rawAptitude - 0.8) * 0.5; // Compress to [0.9, 1.1]

    // Move mastery - REDUCED range
    const rawMastery = attacker.moveMastery[move.moveId] ?? 1.0;
    const mastery = 0.95 + (rawMastery - 1.0) * 0.5; // Compress to [0.95, 1.05]

    // Talent modifier: REDUCED from [0.8, 1.2] to [0.9, 1.1]
    const talentMod = 0.9 + (attacker.talent / 100) * 0.2;

    // Random variance - REDUCED from [0.85, 1.15] to [0.9, 1.1]
    const variance = rng.range(0.9, 1.1);

    // Critical multiplier - REDUCED from 1.5 to 1.25
    const critMod = isCritical ? 1.25 : 1.0;

    // Fear debuff on attacker - REDUCED from 0.75 to 0.85
    let fearMod = 1.0;
    const fearEffect = attacker.statusEffects.find(s => s.type === 'FEAR');
    if (fearEffect) {
        fearMod = 0.85; // -15% ATK instead of -25%
    }

    // SPD bonus - REDUCED from ±30% to ±10%
    const spdMod = 1.0 + (attacker.attributes.SPD - 50) / 500;

    // Base damage formula with balanced multipliers
    let damage = move.power
        * statRatio
        * typeMultiplier
        * aptitude
        * mastery
        * talentMod
        * variance
        * critMod
        * fearMod
        * spdMod;

    // Minimum 1 damage
    return Math.max(1, Math.round(damage));
}

/**
 * Estimate damage for UI display (no RNG, average values)
 * Returns expected damage against a specific defender
 */
export function estimateDamage(
    attacker: BattleCreature,
    defender: BattleCreature,
    move: Move
): number {
    if (move.category === 'STATUS' || move.power === 0) {
        return 0;
    }

    const attackStat = move.category === 'PHYSICAL'
        ? attacker.attributes.STR
        : attacker.attributes.INT;

    const defenseStat = move.category === 'PHYSICAL'
        ? defender.attributes.END
        : defender.attributes.REF;

    const statRatio = Math.sqrt(Math.max(0.25, attackStat / Math.max(1, defenseStat)));

    const rawTypeMultiplier = getTypeEffectiveness(move.type, defender.elementType);
    const typeMultiplier = rawTypeMultiplier > 1 ? 1.25 : (rawTypeMultiplier < 1 ? 0.8 : 1.0);

    const rawAptitude = attacker.aptitudeVsType[defender.elementType] ?? 1.0;
    const aptitude = 0.9 + (rawAptitude - 0.8) * 0.5;

    const rawMastery = attacker.moveMastery[move.moveId] ?? 1.0;
    const mastery = 0.95 + (rawMastery - 1.0) * 0.5;

    const talentMod = 0.9 + (attacker.talent / 100) * 0.2;
    const spdMod = 1.0 + (attacker.attributes.SPD - 50) / 500;

    // Average damage (no variance, no crit)
    const damage = move.power * statRatio * typeMultiplier * aptitude * mastery * talentMod * spdMod;

    return Math.max(1, Math.round(damage));
}

/**
 * Calculate HP from VIT
 */
export function calculateMaxHp(creature: BattleCreature): number {
    // Base HP = VIT * 20 (doubled for longer battles)
    return creature.attributes.VIT * 20;
}

/**
 * Calculate HP regeneration per turn from RGN
 * Returns amount to heal at end of each turn
 */
export function calculateRegeneration(creature: BattleCreature): number {
    // RGN determines % of max HP to regenerate
    // Base: 0% at RGN 30, 5% at RGN 80
    const regenPercent = Math.max(0, (creature.attributes.RGN - 30) / 1000);
    const maxHp = calculateMaxHp(creature);
    return Math.floor(maxHp * regenPercent);
}

/**
 * Calculate effective speed for turn order
 * Higher SPD means you act first when stats are equal
 */
export function calculateSpeed(creature: BattleCreature): number {
    // SPD directly affects initiative
    // AGI adds a small bonus for dodgy creatures
    return creature.attributes.SPD + (creature.attributes.AGI * 0.2);
}

/**
 * Execute a single attack action
 */
export function executeAttack(
    rng: DeterministicRNG,
    attacker: BattleCreature,
    defender: BattleCreature,
    move: Move
): ActionResult {
    // Check hit
    const hit = calculateHit(rng, attacker, defender, move);

    let damage = 0;
    let critical = false;
    let statusApplied: ActionResult['statusApplied'] = undefined;

    if (hit) {
        // Check crit
        critical = calculateCritical(rng, attacker);

        // Calculate damage
        damage = calculateDamage(rng, attacker, defender, move, critical);

        // Apply damage
        defender.currentHp = Math.max(0, defender.currentHp - damage);

        // Check for status effect application
        if (move.statusEffect && move.statusChance > 0) {
            if (rng.chance(move.statusChance)) {
                // Apply status
                const duration = move.statusDuration ?? getDefaultStatusDuration(move.statusEffect);

                // Remove existing same-type status
                defender.statusEffects = defender.statusEffects.filter(
                    s => s.type !== move.statusEffect
                );

                // Add new status
                defender.statusEffects.push({
                    type: move.statusEffect,
                    turnsRemaining: duration,
                    sourceId: attacker.id
                });

                statusApplied = move.statusEffect;
            }
        }
    }

    // Set move on cooldown
    if (move.cooldownMax > 0) {
        attacker.cooldowns[move.moveId] = move.cooldownMax;
    }

    return {
        attackerId: attacker.id,
        targetId: defender.id,
        moveId: move.moveId,
        moveName: move.name,
        hit,
        critical,
        damage,
        statusApplied,
        attackerHpAfter: attacker.currentHp,
        targetHpAfter: defender.currentHp
    };
}

function getDefaultStatusDuration(status: string): number {
    switch (status) {
        case 'BURN': return 3;
        case 'FREEZE': return 1;
        case 'POISON': return 4;
        case 'PARALYZE': return 3;
        case 'STUN': return 1;
        case 'BLIND': return 2;
        case 'FEAR': return 2;
        case 'SLOW': return 2;
        case 'DRAIN': return 3;
        default: return 2;
    }
}
