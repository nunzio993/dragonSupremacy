/**
 * Creature Generator Service
 * Implements deterministic creature generation from seed
 * Based on creature-generator-prompt.md
 */

import { ElementType } from '../data/moves.js';

// Constants from prompt
const PERSONALITIES = [
    { id: 'BRAVE', statUp: 'STR', statDown: 'SPD' },
    { id: 'CALM', statUp: 'INT', statDown: 'STR' },
    { id: 'BOLD', statUp: 'END', statDown: 'REF' },
    { id: 'TIMID', statUp: 'SPD', statDown: 'STR' },
    { id: 'MODEST', statUp: 'AGI', statDown: 'STR' },
    { id: 'ADAMANT', statUp: 'STR', statDown: 'AGI' },
    { id: 'IMPISH', statUp: 'END', statDown: 'AGI' },
    { id: 'JOLLY', statUp: 'SPD', statDown: 'AGI' },
    { id: 'NAIVE', statUp: 'SPD', statDown: 'END' },
    { id: 'CAREFUL', statUp: 'END', statDown: 'INT' },
    { id: 'NEUTRAL', statUp: null, statDown: null },
] as const;

const TEMPERAMENTS = ['CALM', 'FOCUSED', 'NEUTRAL', 'NERVOUS', 'RECKLESS'] as const;

const ELEMENT_TYPES: ElementType[] = [
    'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'EARTH', 'DARK', 'LIGHT'
];

const STAT_NAMES = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT', 'INT', 'PRC', 'RGN'] as const;
type StatName = typeof STAT_NAMES[number];

export interface CreatureAttributes {
    STR: number;
    AGI: number;
    SPD: number;
    REF: number;
    END: number;
    VIT: number;
    INT: number;
    PRC: number;
    RGN: number;
}

export interface GrowthRates {
    STR: number;
    AGI: number;
    SPD: number;
    REF: number;
    END: number;
    VIT: number;
    INT: number;
    PRC: number;
    RGN: number;
}

export interface Personality {
    id: string;
    statUp: StatName | null;
    statDown: StatName | null;
}

// Move category type for generated moves
export type MoveCategory = 'PHYSICAL' | 'SPECIAL' | 'STATUS';

// Full move data as generated for the creature
export interface GeneratedMove {
    moveId: number;         // 0 = empty slot
    name: string;
    type: ElementType;
    category: MoveCategory;
    power: number;
    accuracy: number;
    cooldownMax: number;
    priority: number;
    statusEffect?: string;
    statusChance: number;
}

export interface GeneratedCreature {
    genSeed: string;
    talent: number;
    temperament: string;
    personality: Personality;
    elementType: ElementType;
    attributes: CreatureAttributes;
    growthRates: GrowthRates;
    moves: GeneratedMove[];      // Full move data
    moveCount: number;           // 2, 3, or 4
    moveMastery: number[];       // [0-30] for each move slot
    aptitudeVsType: Record<ElementType, number>;
}

/**
 * Deterministic RNG using xorshift32
 */
class SeededRNG {
    private state: number;

    constructor(seed: string) {
        // Convert hex string to number
        this.state = parseInt(seed.slice(2, 10), 16) || 1;
    }

    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return (x >>> 0) / 0xFFFFFFFF;
    }

    /** Random int in [min, max] inclusive */
    int(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /** Random float in [min, max] */
    float(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }

    /** Pick random element from array */
    pick<T>(arr: readonly T[]): T {
        return arr[Math.floor(this.next() * arr.length)];
    }

    /** Shuffle array in place */
    shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

/**
 * Generate creature from seed
 * All outputs are deterministic given the same seed
 */
export function generateCreature(genSeed: string, elementType: ElementType): GeneratedCreature {
    const rng = new SeededRNG(genSeed);

    // 1. Talent (1-100, normal distribution centered at 50)
    const u1 = rng.next();
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const talent = Math.max(1, Math.min(100, Math.round(50 + z * 15)));

    // 2. Temperament
    const temperament = rng.pick(TEMPERAMENTS);

    // 3. Personality
    const personality = rng.pick(PERSONALITIES);

    // 4. Base attributes (30-80 range, modified by talent)
    const b = (talent - 50) / 50; // -1 to +1
    const sigmaAttr = 0.15;

    const attributes: CreatureAttributes = {
        STR: 0, AGI: 0, SPD: 0, REF: 0, END: 0, VIT: 0, INT: 0, PRC: 0, RGN: 0
    };

    for (const stat of STAT_NAMES) {
        const Z = rng.float(-1, 1);
        let value = 50 + 15 * b + 20 * sigmaAttr * Z;
        value = Math.max(30, Math.min(80, Math.round(value)));
        attributes[stat] = value;
    }

    // Apply personality modifiers (+10% / -10%)
    if (personality.statUp && personality.statDown) {
        attributes[personality.statUp] = Math.round(attributes[personality.statUp] * 1.1);
        attributes[personality.statDown] = Math.round(attributes[personality.statDown] * 0.9);
    }

    // 5. Growth rates (0.3 - 1.8, based on talent)
    const baseGrowthRate = 0.7 + 0.6 * ((talent - 50) / 50);
    const growthRates: GrowthRates = {
        STR: 0, AGI: 0, SPD: 0, REF: 0, END: 0, VIT: 0, INT: 0.15, PRC: 0, RGN: 0
    };

    for (const stat of STAT_NAMES) {
        if (stat === 'INT') continue; // INT always 0.15
        const Z = rng.float(-0.5, 0.5);
        const rate = Math.max(0.3, Math.min(1.8, baseGrowthRate + Z));
        growthRates[stat] = Math.round(rate * 1000) / 1000;
    }

    // 6. Move selection (2-4 moves from element pool based on talent)
    // Higher talent = more likely to have 4 moves
    const movePoolNames = getMovePoolForElement(elementType);
    rng.shuffle(movePoolNames);

    // Determine number of moves (2-4) based on talent
    let moveCount: number;
    const moveRoll = rng.next();
    if (talent >= 80) {
        moveCount = 4; // High talent always gets 4 moves
    } else if (talent >= 50) {
        moveCount = moveRoll < 0.3 ? 4 : (moveRoll < 0.7 ? 3 : 2);
    } else {
        moveCount = moveRoll < 0.1 ? 4 : (moveRoll < 0.4 ? 3 : 2);
    }

    const selectedMoveNames = movePoolNames.slice(0, moveCount);

    // Get full move data from database
    const moves: GeneratedMove[] = selectedMoveNames.map(name => {
        const moveDef = getMoveByName(name);
        if (!moveDef) {
            throw new Error(`Move not found in database: ${name}`);
        }
        return {
            moveId: moveDef.moveId,
            name: moveDef.name,
            type: moveDef.type,
            category: moveDef.category,
            power: moveDef.power,
            accuracy: moveDef.accuracy,
            cooldownMax: moveDef.cooldownMax,
            priority: moveDef.priority,
            statusEffect: moveDef.statusEffect,
            statusChance: moveDef.statusChance,
        };
    });

    // Pad to 4 moves with empty slots if needed
    while (moves.length < 4) {
        moves.push({
            moveId: 0, // Empty slot
            name: '',
            type: elementType,
            category: 'PHYSICAL',
            power: 0,
            accuracy: 0,
            cooldownMax: 0,
            priority: 0,
            statusChance: 0,
        });
    }

    // 7. Move mastery (85-115, stored as 0-30)
    const moveMastery: number[] = [];
    for (let i = 0; i < 4; i++) {
        if (i < moveCount) {
            const Z = rng.float(-1, 1);
            const mastery = Math.max(0, Math.min(30, Math.round(15 + 5 * b + 10 * Z)));
            moveMastery.push(mastery);
        } else {
            moveMastery.push(0); // Empty slot
        }
    }

    // 8. Aptitude vs type (0.90 - 1.10)
    const aptitudeVsType: Record<ElementType, number> = {} as Record<ElementType, number>;
    for (const type of ELEMENT_TYPES) {
        const Z = rng.float(-1, 1);
        const apt = Math.max(0.9, Math.min(1.1, 1 + 0.03 * b + 0.05 * Z));
        aptitudeVsType[type] = Math.round(apt * 1000) / 1000;
    }

    return {
        genSeed,
        talent,
        temperament,
        personality: {
            id: personality.id,
            statUp: personality.statUp ?? null,
            statDown: personality.statDown ?? null,
        },
        elementType,
        attributes,
        growthRates,
        moves,
        moveCount,
        moveMastery,
        aptitudeVsType,
    };
}

// Import from move database
import { getMoveByName, getMovePoolForElement } from '../data/moves.js';

/**
 * Generate a random seed (bytes32 hex string)
 */
export function generateRandomSeed(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate current stat value based on level and age
 */
export function calculateStat(
    baseStat: number,
    level: number,
    ageDays: number,
    growthRate: number,
    statName: StatName
): number {
    const PEAK_LEVEL = 50;
    const PEAK_AGE_DAYS = 365;
    const DECAY_START_DAYS = 730;
    const STARTING_MULTIPLIER = 0.5;

    // 1. Level multiplier (50% at L1, 150-200% at L50, stable after L50)
    let levelMultiplier: number;
    if (level <= PEAK_LEVEL) {
        // Stats grow from 50% to peak (150-200%) based on growthRate
        levelMultiplier = STARTING_MULTIPLIER + (level / PEAK_LEVEL) * growthRate;
    } else {
        // After L50: stats stay at peak (no level decay, only age decay)
        levelMultiplier = STARTING_MULTIPLIER + growthRate;
    }

    // 2. Age multiplier (50% at birth, grows to 100% at peak age, then decays)
    let ageMultiplier: number;
    if (ageDays <= PEAK_AGE_DAYS) {
        // Stats grow from 50% at birth to 100% at peak age (1 year)
        ageMultiplier = 0.5 + (ageDays / PEAK_AGE_DAYS) * 0.5;
    } else if (ageDays <= DECAY_START_DAYS) {
        ageMultiplier = 1.0;
    } else {
        const decayProgress = (ageDays - DECAY_START_DAYS) / 365;
        ageMultiplier = Math.max(0.5, 1.0 - decayProgress * 0.10);
    }

    // 3. Special case: INT grows forever
    if (statName === 'INT') {
        const intGrowth = 1 + (ageDays / 1825) * 0.3;
        return Math.round(baseStat * levelMultiplier * intGrowth);
    }

    return Math.round(baseStat * levelMultiplier * ageMultiplier);
}

/**
 * Calculate all current stats for a creature
 */
export function calculateAllStats(
    baseAttributes: CreatureAttributes,
    growthRates: GrowthRates,
    level: number,
    ageDays: number
): CreatureAttributes {
    const result: CreatureAttributes = {
        STR: 0, AGI: 0, SPD: 0, REF: 0, END: 0, VIT: 0, INT: 0, PRC: 0, RGN: 0
    };

    for (const stat of STAT_NAMES) {
        result[stat] = calculateStat(
            baseAttributes[stat],
            level,
            ageDays,
            growthRates[stat],
            stat
        );
    }

    return result;
}
