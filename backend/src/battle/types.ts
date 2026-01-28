/**
 * Battle Engine Type Definitions
 */

// Element types (no NEUTRAL)
export type ElementType =
    | 'FIRE'
    | 'WATER'
    | 'GRASS'
    | 'ELECTRIC'
    | 'ICE'
    | 'EARTH'
    | 'DARK'
    | 'LIGHT';

export const ELEMENT_TYPES: ElementType[] = [
    'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'EARTH', 'DARK', 'LIGHT'
];

// Move categories
export type MoveCategory = 'PHYSICAL' | 'SPECIAL' | 'STATUS';

// Status effects
export type StatusEffectType =
    | 'BURN'      // -10% HP/turn, 3 turns
    | 'FREEZE'    // Skip turn, 30% linger
    | 'POISON'    // -8% HP/turn, 4 turns
    | 'PARALYZE'  // 25% skip, -30% SPD, 3 turns
    | 'STUN'      // Skip next turn
    | 'BLIND'     // -30% accuracy, 2 turns
    | 'FEAR'      // -25% ATK, 2 turns
    | 'SLOW'      // -40% SPD, 2 turns
    | 'DRAIN';    // Steal 15% HP, 3 turns

// Temperaments
export type Temperament =
    | 'CALM'
    | 'FOCUSED'
    | 'NEUTRAL'
    | 'NERVOUS'
    | 'RECKLESS';

// Temperament modifiers (used in battle)
export const TEMPERAMENT_MODIFIERS: Record<Temperament, {
    accMult: number;
    critAdd: number;
    missFloor: number;
}> = {
    CALM: { accMult: 1.08, critAdd: -0.01, missFloor: 0.01 },
    FOCUSED: { accMult: 1.05, critAdd: -0.005, missFloor: 0.02 },
    NEUTRAL: { accMult: 1.00, critAdd: 0.00, missFloor: 0.02 },
    NERVOUS: { accMult: 0.94, critAdd: 0.03, missFloor: 0.04 },
    RECKLESS: { accMult: 0.92, critAdd: 0.03, missFloor: 0.05 },
};

// Creature attributes
export interface CreatureAttributes {
    STR: number;  // Physical attack
    AGI: number;  // Special attack / Dodge base
    SPD: number;  // Speed (turn order)
    REF: number;  // Evasion / Critical chance
    END: number;  // Defense
    VIT: number;  // HP base
    INT: number;  // Intelligence (dodge bonus, grows slowly forever)
    PRC: number;  // Precision (accuracy bonus)
    RGN: number;  // Regeneration (HP regen per turn)
}

// Move definition
export interface Move {
    moveId: string;
    name: string;
    type: ElementType;
    category: MoveCategory;
    power: number;
    accuracy: number;       // 0-100
    cooldownMax: number;    // 0 = always available
    priority: number;       // -2 to +2
    statusEffect?: StatusEffectType;
    statusChance: number;   // 0-1
    statusDuration?: number;
}

// Creature instance (in battle)
export interface BattleCreature {
    id: string;
    name: string;
    ownerId: string;
    elementType: ElementType;
    talent: number;
    temperament: Temperament;
    attributes: CreatureAttributes;
    moves: Move[];
    moveMastery: Record<string, number>;
    aptitudeVsType: Record<ElementType, number>;

    // Battle state
    currentHp: number;
    maxHp: number;
    cooldowns: Record<string, number>;
    statusEffects: ActiveStatusEffect[];
}

// Active status effect
export interface ActiveStatusEffect {
    type: StatusEffectType;
    turnsRemaining: number;
    sourceId: string;  // Who applied it
}

// Battle action (player's choice)
export interface BattleAction {
    creatureId: string;
    moveId: string;
    targetId: string;
}

// Turn result (what happened)
export interface TurnResult {
    turnNumber: number;
    actions: ActionResult[];
    statusTicks: StatusTickResult[];
    knockouts: string[];  // Creature IDs that were KO'd
}

// Individual action result
export interface ActionResult {
    attackerId: string;
    targetId: string;
    moveId: string;
    moveName: string;
    hit: boolean;
    critical: boolean;
    damage: number;
    statusApplied?: StatusEffectType;
    attackerHpAfter: number;
    targetHpAfter: number;
}

// Status effect tick result
export interface StatusTickResult {
    creatureId: string;
    effectType: StatusEffectType;
    damage?: number;
    healed?: number;
    expired: boolean;
}

// Full battle state
export interface BattleState {
    battleId: string;
    seed: string;
    playerA: string;
    playerB: string;
    creatureA: BattleCreature;
    creatureB: BattleCreature;
    turnNumber: number;
    currentTurnPlayer: string;  // Whose turn to choose move
    winner?: string;
    forfeit?: string;
    turnHistory: TurnResult[];
}

// Match stake info
export interface MatchStake {
    amount: string;       // In wei or token units
    token: 'ETH' | 'USDC';
    playerADeposited: boolean;
    playerBDeposited: boolean;
}
