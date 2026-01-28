// ============================================
// POKÉMON-LIKE BATTLE SYSTEM - NEW TYPES
// ============================================

/**
 * Element types for creatures and moves.
 * Similar to Pokémon types but simplified for this game.
 */
export type ElementType =
    | 'FIRE'
    | 'WATER'
    | 'GRASS'
    | 'ELECTRIC'
    | 'ICE'
    | 'EARTH'
    | 'DARK'
    | 'LIGHT'
    | 'NEUTRAL';

/**
 * Rarity tiers for creatures.
 */
export type CreatureRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/**
 * Move categories determine which stats are used for damage calculation.
 * - PHYSICAL: uses ATK vs DEF
 * - SPECIAL: uses special attack stats (for future expansion)
 * - STATUS: no damage, applies effects
 */
export type MoveCategory = 'PHYSICAL' | 'SPECIAL' | 'STATUS';

/**
 * Status effects that can be applied to creatures.
 */
export type StatusEffectType =
    | 'POISON'       // Damage over time (1/8 max HP)
    | 'BURN'         // Damage over time + halves ATK
    | 'SLEEP'        // Cannot act for 1-3 turns
    | 'PARALYSIS'    // 25% chance to skip turn, halves SPD
    | 'FREEZE'       // Cannot act until thawed (20% per turn)
    | 'SHIELD'       // Temporary damage reduction
    | 'NONE';        // No status effect

/**
 * The 9 core creature stats.
 */
export type StatName =
    | 'STR'   // Strength - Physical damage
    | 'AGI'   // Agility - Dodge base
    | 'SPD'   // Speed - Turn order
    | 'REF'   // Reflex - Critical chance
    | 'END'   // Endurance - Physical resistance
    | 'VIT'   // Vitality - Max HP
    | 'INT'   // Intelligence - Dodge bonus (grows slowly forever)
    | 'PRC'   // Precision - Move accuracy
    | 'RGN'; // Regeneration - HP regen per turn

/**
 * Personality IDs that affect stats.
 */
export type PersonalityId =
    | 'BRAVE'    // +STR, -SPD
    | 'TIMID'    // +SPD, -STR
    | 'HARDY'    // +END, -AGI
    | 'HASTY'    // +SPD, -END
    | 'CALM'     // +INT, -STR
    | 'QUIRKY'   // +RGN, -PRC
    | 'ADAMANT'  // +STR, -INT
    | 'JOLLY'    // +SPD, -REF
    | 'MODEST'   // +INT, -STR
    | 'CAREFUL'  // +END, -SPD
    | 'NEUTRAL'; // No change

/**
 * Creature personality affecting two stats.
 */
export interface Personality {
    id: PersonalityId;
    /** Stat that gets +10% bonus, null for NEUTRAL */
    statUp: StatName | null;
    /** Stat that gets -10% penalty, null for NEUTRAL */
    statDown: StatName | null;
}

/**
 * The 9 core creature attributes.
 */
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

/**
 * Per-stat growth rates. Each stat grows independently.
 * Range: 0.3 (slow) to 1.8 (fast), INT is always 0.15.
 */
export interface GrowthRates {
    STR: number;
    AGI: number;
    SPD: number;
    REF: number;
    END: number;
    VIT: number;
    /** Always 0.15 - grows slowly throughout entire life */
    INT: number;
    PRC: number;
    RGN: number;
}

// ============================================
// CREATURE AND MOVE DEFINITIONS (Static Data)
// ============================================

/**
 * Static definition of a creature type.
 * Players own instances of these definitions.
 */
export interface CreatureDefinition {
    /** Unique identifier for this creature type */
    id: string;
    /** Display name */
    name: string;
    /** Elemental type - determines type effectiveness */
    elementType: ElementType;
    /** Base HP stat */
    baseHp: number;
    /** Base Attack stat */
    baseAtk: number;
    /** Base Defense stat */
    baseDef: number;
    /** Base Speed stat  */
    baseSpd: number;
    /** Rarity tier */
    rarity: CreatureRarity;
    /** ID of the passive ability this creature has */
    passiveAbilityId: string;
    /** Array of MoveDefinition IDs this creature can learn */
    movePoolIds: string[];
    /** Sprite key for rendering */
    spriteKey: string;
}

/**
 * Static definition of a move.
 */
export interface MoveDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Elemental type - for STAB bonus and effectiveness */
    elementType: ElementType;
    /** Category determines damage calculation method */
    category: MoveCategory;
    /** Base power for damage calculation (0 for pure status moves) */
    basePower: number;
    /** Accuracy percentage (0-100, 0 means always hits) */
    accuracy: number;
    /** Cooldown in turns before this move can be used again */
    cooldown: number;
    /** Optional status effect this move can apply */
    statusEffect?: StatusEffectType;
    /** Chance to apply status effect (0-1, e.g., 0.3 = 30%) */
    statusChance?: number;
    /** Priority modifier (default 0, higher = acts first at same speed) */
    priority?: number;
    /** Description for UI display */
    description?: string;
}

// ============================================
// CREATURE INSTANCES (Player-Owned State)
// ============================================

/**
 * A specific instance of a creature owned by a player.
 * Contains current battle state.
 */
export interface CreatureInstance {
    /** Unique instance ID */
    instanceId: string;
    /** Reference to CreatureDefinition.id */
    creatureDefinitionId: string;
    /** Current HP (can be damaged) */
    currentHp: number;
    /** Maximum HP (from base + bonuses) */
    maxHp: number;
    /** Current Attack stat */
    atk: number;
    /** Current Defense stat */
    def: number;
    /** Current Speed stat */
    spd: number;
    /** Current status effect */
    status: StatusEffectType;
    /** Turns remaining for status (for SLEEP, etc.) */
    statusTurnsRemaining?: number;
    /** Status counter for scaling effects (e.g., badly poisoned) */
    statusCounter?: number;
    /** Whether this creature has fainted */
    isFainted: boolean;
    /** Cooldowns by move ID: moveId -> turns remaining */
    moveCooldowns: Record<string, number>;
    /** Move IDs this instance knows (subset of movePoolIds) */
    knownMoveIds: string[];
}

/**
 * Aptitude multipliers vs each element type.
 * Range: 0.90 to 1.10
 */
export interface AptitudeVsType {
    FIRE: number;
    WATER: number;
    GRASS: number;
    ELECTRIC: number;
    ICE: number;
    EARTH: number;
    DARK: number;
    LIGHT: number;
}

/**
 * Persistent creature data stored on-chain (NFT metadata).
 * This is the "birth certificate" of a creature - immutable stats.
 */
export interface CreatureNFTData {
    /** Schema version */
    version: string;
    /** Unique creature ID */
    creatureId: string;
    /** Owner player ID */
    ownerPlayerId: string;
    /** Reference to CreatureDefinition.id */
    creatureDefinitionId: string;
    /** Species display name */
    speciesName: string;
    /** Elemental type */
    elementType: ElementType;
    /** Rarity tier */
    rarity: CreatureRarity;
    /** ISO timestamp of creature birth */
    bornAt: string;
    /** Current XP (mutable on-chain) */
    xp: number;
    /** Talent score 1-100, affects overall growth potential */
    talent: number;
    /** Temperament string (for flavor) */
    temperament: string;
    /** Personality affecting stats */
    personality: Personality;
    /** Base attributes (before level/age modifiers) */
    attributes: CreatureAttributes;
    /** Per-stat growth rate multipliers */
    growthRates: GrowthRates;
    /** Known move IDs (2-4 moves) */
    moves: string[];
    /** Move mastery multipliers (0.85-1.15) */
    moveMastery: Record<string, number>;
    /** Aptitude vs each element type (0.90-1.10) */
    aptitudeVsType: AptitudeVsType;
    /** Seed for deterministic generation */
    genSeed: string;
}

// ============================================
// BATTLE STATE
// ============================================

/**
 * Represents one player's side of the battlefield.
 */
export interface PlayerSide {
    /** Player identifier */
    playerId: string;
    /** Currently active creature (null if all fainted) */
    active: CreatureInstance | null;
    /** Creatures on bench (alive but not active) */
    bench: CreatureInstance[];
    /** Fainted creatures */
    fallen: CreatureInstance[];
    /** The 3 creature definition IDs brought into this match from roster */
    lineupDefinitionIds: string[];
}

/**
 * Battle phases determine what actions are valid.
 */
export type BattlePhase =
    | 'WAITING_FOR_ACTIONS'  // Waiting for both players to submit actions
    | 'RESOLVING_TURN'       // Processing the turn
    | 'FINISHED';            // Battle has ended

/**
 * Battle result indicates the current outcome.
 */
export type BattleResult =
    | 'ONGOING'       // Battle still in progress
    | 'PLAYER1_WIN'   // Player 1 won
    | 'PLAYER2_WIN'   // Player 2 won
    | 'DRAW';         // Draw (timeout or simultaneous KO)

/**
 * Complete battle state.
 * Immutable - simulateTurn returns a new state.
 */
export interface BattleState {
    /** Unique battle identifier */
    id: string;
    /** RNG seed for deterministic replay */
    seed: number;
    /** Current turn number (starts at 0) */
    turnNumber: number;
    /** Current battle phase */
    phase: BattlePhase;
    /** Current result */
    result: BattleResult;
    /** Player 1's side */
    player1: PlayerSide;
    /** Player 2's side */
    player2: PlayerSide;
    /** Events from the last resolved turn (for frontend replay) */
    lastTurnEvents: BattleEvent[];
}

// ============================================
// BATTLE EVENTS (for logging and replay)
// ============================================

/**
 * Types of events that can occur during battle.
 */
export type BattleEventType =
    | 'MOVE_USED'       // A creature used a move
    | 'DAMAGE'          // Damage was dealt
    | 'HEAL'            // HP was restored
    | 'STATUS_APPLIED'  // A status effect was applied
    | 'STATUS_EXPIRED'  // A status effect ended
    | 'STATUS_DAMAGE'   // Damage from status (burn, poison)
    | 'SWITCH'          // A creature was switched
    | 'FAINT'           // A creature fainted
    | 'SUPER_EFFECTIVE' // Type advantage
    | 'NOT_EFFECTIVE'   // Type disadvantage
    | 'NO_EFFECT'       // Type immunity
    | 'CRITICAL'        // Critical hit
    | 'MISS'            // Move missed
    | 'TURN_START'      // Turn began
    | 'TURN_END';       // Turn ended

/**
 * A single event that occurred during battle.
 */
export interface BattleEvent {
    /** Turn number when this event occurred */
    turn: number;
    /** Which player triggered this event (1 or 2) */
    sourcePlayer: 1 | 2;
    /** Target player if applicable */
    targetPlayer?: 1 | 2;
    /** Source creature instance ID */
    sourceInstanceId?: string;
    /** Target creature instance ID */
    targetInstanceId?: string;
    /** Type of event */
    type: BattleEventType;
    /** Event-specific data */
    payload?: Record<string, unknown>;
    /** Human-readable description */
    description?: string;
}

// ============================================
// PLAYER ACTIONS
// ============================================

/**
 * Types of actions a player can take on their turn.
 */
export type PlayerActionType = 'USE_MOVE' | 'SWITCH';

/**
 * Action submitted by a player for their turn.
 */
export interface PlayerAction {
    /** Player submitting this action */
    playerId: string;
    /** Type of action */
    type: PlayerActionType;
    /** Move ID to use (required if type === 'USE_MOVE') */
    moveId?: string;
    /** Target player for the move (typically opponent, player 1 or 2) */
    targetPlayer?: 1 | 2;
    /** Target creature instance ID (for single-target moves) */
    targetInstanceId?: string;
    /** Instance ID of creature to switch to (required if type === 'SWITCH') */
    switchToInstanceId?: string;
}

// ============================================
// BATTLE SETUP
// ============================================

/**
 * Configuration for starting a new battle.
 */
export interface BattleSetup {
    /** Unique battle ID */
    battleId: string;
    /** RNG seed for determinism */
    seed: number;
    /** Player 1's ID */
    player1Id: string;
    /** Player 2's ID */
    player2Id: string;
    /** Player 1's team (3 creatures) */
    player1Team: CreatureInstance[];
    /** Player 2's team (3 creatures) */
    player2Team: CreatureInstance[];
}

// ============================================
// PASSIVE ABILITIES (for creature passives)
// ============================================

/**
 * Definition of a passive ability.
 */
export interface PassiveAbilityDefinition {
    id: string;
    name: string;
    description: string;
    /** Effect type for engine logic */
    effectType: string;
    /** Parameters for the effect */
    effectParams: Record<string, number>;
}

// ============================================
// ECONOMY AND PROGRESSION
// ============================================

/**
 * Player's current economy state.
 */
export interface PlayerEconomyState {
    /** Current experience points */
    xp: number;
    /** Current level (computed from XP) */
    level: number;
    /** Current soft currency balance */
    coins: number;
    /** XP needed to reach next level */
    xpToNextLevel: number;
}

/**
 * Rewards given after a battle ends.
 */
export interface BattleRewardPayload {
    /** XP gained from this battle */
    xpGained: number;
    /** Coins gained from this battle */
    coinsGained: number;
    /** Player's new total XP */
    newXp: number;
    /** Player's new level (may have leveled up) */
    newLevel: number;
    /** Player's new coin balance */
    newCoins: number;
    /** Whether the player leveled up */
    leveledUp: boolean;
}

/**
 * Economy configuration constants.
 */
export interface EconomyConfig {
    XP_WIN: number;
    XP_LOSS: number;
    XP_DRAW: number;
    COINS_WIN: number;
    COINS_LOSS: number;
    COINS_DRAW: number;
}

// ============================================
// DEPRECATED: OLD AUTOBATTLER TYPES
// These are kept for backward compatibility with existing code.
// New code should use the Pokémon-like types above.
// ============================================

// DEPRECATED: old autobattler type - use CreatureRarity instead
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// DEPRECATED: old autobattler type
export type UnitRole = 'frontline' | 'backline';

// DEPRECATED: old autobattler type
export type EquipmentType = 'weapon' | 'armor' | 'trinket';

// DEPRECATED: old autobattler type
export type PassiveType =
    | 'hp_boost_when_equipped'
    | 'speed_boost_first_turn'
    | 'damage_vs_low_hp'
    | 'block_chance'
    | 'damage_boost_low_hp'
    | 'heal_on_kill'
    | 'atk_per_turn'
    | 'slow_target'
    | 'lifesteal'
    | 'aoe_splash'
    | 'double_action_chance'
    | 'immune_first_hit'
    | 'none';

// DEPRECATED: old autobattler type
export type EffectType =
    | 'none'
    | 'lifesteal'
    | 'block_chance'
    | 'dodge_chance'
    | 'first_hit_bonus'
    | 'team_atk_buff'
    | 'revive';

// DEPRECATED: old autobattler type
export type MatchEventType =
    | 'turn_start'
    | 'attack'
    | 'damage'
    | 'block'
    | 'dodge'
    | 'death'
    | 'passive_trigger'
    | 'effect_trigger'
    | 'heal'
    | 'revive'
    | 'match_end';

// DEPRECATED: old autobattler type - use CreatureDefinition instead
export interface UnitDefinition {
    id: string;
    name: string;
    rarity: Rarity;
    baseHp: number;
    baseAtk: number;
    baseSpd: number;
    role: UnitRole;
    passiveType: PassiveType;
    passiveParams: Record<string, number>;
    spriteKey: string;
}

// DEPRECATED: old autobattler type
export interface EquipmentDefinition {
    id: string;
    name: string;
    type: EquipmentType;
    bonusHp: number;
    bonusAtk: number;
    bonusSpd: number;
    effectType: EffectType;
    effectParams: Record<string, number>;
    iconKey: string;
}

// DEPRECATED: old autobattler type - use CreatureInstance instead
export interface PlayerUnitInstance {
    instanceId: string;
    unitDefinitionId: string;
    equippedItems: string[];
}

// DEPRECATED: old autobattler type
export interface EquipmentInstance {
    instanceId: string;
    equipmentDefinitionId: string;
}

// DEPRECATED: old autobattler type - use BattleSetup instead
export interface MatchSetup {
    matchId: string;
    seed: number;
    teamA: PlayerUnitInstance[];
    teamB: PlayerUnitInstance[];
    equipmentMap: Record<string, EquipmentInstance>;
}

// DEPRECATED: old autobattler type - use BattleEvent instead
export interface MatchEvent {
    turnIndex: number;
    actorInstanceId: string | null;
    targetInstanceId: string | null;
    eventType: MatchEventType;
    value: number;
    description: string;
}

// DEPRECATED: old autobattler type - use BattleResult instead
export type MatchWinner = 'teamA' | 'teamB' | 'draw';

// DEPRECATED: old autobattler type - use CreatureInstance instead
export interface UnitState {
    instanceId: string;
    unitDefinitionId: string;
    currentHp: number;
    maxHp: number;
    atk: number;
    spd: number;
    isAlive: boolean;
    team: 'teamA' | 'teamB';
    slotIndex: number;
    effects: ActiveEffect[];
}

// DEPRECATED: old autobattler type
export interface ActiveEffect {
    type: string;
    value: number;
    duration: number;
}

// DEPRECATED: old autobattler type
export interface MatchResult {
    matchId: string;
    winner: MatchWinner;
    events: MatchEvent[];
    totalTurns: number;
    finalState: {
        teamA: UnitState[];
        teamB: UnitState[];
    };
}

// ============================================
// API TYPES (still used)
// ============================================

export interface Account {
    id: string;
    createdAt: string;
    xp: number;
    level: number;
    softCurrency: number;
}

export interface Loadout {
    unitInstanceIds: string[];
}

export interface MatchHistoryEntry {
    matchId: string;
    result: MatchWinner;
    opponentType: 'ai' | 'player';
    createdAt: string;
    xpGained: number;
}

// ============================================
// RMRK NFT TYPES (still used)
// ============================================

export interface UnitNftMetadata {
    unitDefinitionId: string;
    level: number;
    cosmeticSkinId: string | null;
    powerScore: number;
}

export interface EquipNftMetadata {
    equipmentDefinitionId: string;
    rollSeed: number | null;
}

export interface RmrkNft {
    id: string;
    ownerId: string;
    metadata: UnitNftMetadata | EquipNftMetadata;
    children: string[];
    parentId: string | null;
}

