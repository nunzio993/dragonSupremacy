/**
 * Battle Module Index
 * Re-exports all battle-related functionality
 */

// RNG
export { DeterministicRNG, createBattleSeed } from './rng.js';

// Types
export * from './types.js';

// Damage calculation
export {
    getTypeEffectiveness,
    calculateHit,
    calculateCritical,
    calculateDamage,
    calculateMaxHp,
    executeAttack
} from './damage.js';

// Status effects
export {
    processStatusEffects,
    checkCanAct,
    getEffectiveSpeed,
    tickCooldowns,
    getAvailableMoves,
    applyHeal,
    applyCleanse
} from './status.js';

// Engine
export {
    initializeBattle,
    executeTurn,
    getPlayerView,
    isBattleOver,
    getCreatureAvailableMoves,
    getTimeoutAction,
    forfeitBattle
} from './engine.js';
