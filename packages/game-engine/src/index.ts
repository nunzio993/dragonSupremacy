// Pokémon-style turn-based engine (NEW - use this for new code)
export {
    simulateTurn,
    createInitialBattleState,
    createCreatureInstance,
    getTypeEffectiveness,
} from './pokemonEngine.js';

// DEPRECATED: Old autobattler engine - kept for backward compatibility
export { simulateBattle } from './engine.js';

// RNG utilities
export { createRng, createMatchSeed, type Rng } from './rng.js';
