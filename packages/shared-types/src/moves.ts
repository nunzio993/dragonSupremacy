/**
 * Sample Move Definitions for Pokémon-like Battle System
 */
import { MoveDefinition } from './types.js';

export const MOVE_DEFINITIONS: MoveDefinition[] = [
    // ============================================
    // NEUTRAL MOVES
    // ============================================
    {
        id: 'tackle',
        name: 'Tackle',
        elementType: 'NEUTRAL',
        category: 'PHYSICAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        description: 'A basic physical attack.',
    },
    {
        id: 'quick_strike',
        name: 'Quick Strike',
        elementType: 'NEUTRAL',
        category: 'PHYSICAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 1,
        description: 'A swift attack that always goes first.',
    },
    {
        id: 'slam',
        name: 'Slam',
        elementType: 'NEUTRAL',
        category: 'PHYSICAL',
        basePower: 80,
        accuracy: 75,
        cooldown: 0,
        priority: 0,
        description: 'A powerful but inaccurate attack.',
    },

    // ============================================
    // FIRE MOVES
    // ============================================
    {
        id: 'ember',
        name: 'Ember',
        elementType: 'FIRE',
        category: 'SPECIAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        statusEffect: 'BURN',
        statusChance: 0.1,
        description: 'A small flame attack. May cause burn.',
    },
    {
        id: 'flamethrower',
        name: 'Flamethrower',
        elementType: 'FIRE',
        category: 'SPECIAL',
        basePower: 90,
        accuracy: 80,
        cooldown: 1,
        priority: 0,
        statusEffect: 'BURN',
        statusChance: 0.1,
        description: 'A powerful fire attack. May cause burn.',
    },
    {
        id: 'inferno',
        name: 'Inferno',
        elementType: 'FIRE',
        category: 'SPECIAL',
        basePower: 110,
        accuracy: 70,
        cooldown: 2,
        priority: 0,
        statusEffect: 'BURN',
        statusChance: 0.3,
        description: 'An intense fire attack. May cause burn.',
    },

    // ============================================
    // WATER MOVES
    // ============================================
    {
        id: 'water_gun',
        name: 'Water Gun',
        elementType: 'WATER',
        category: 'SPECIAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        description: 'A basic water attack.',
    },
    {
        id: 'aqua_jet',
        name: 'Aqua Jet',
        elementType: 'WATER',
        category: 'PHYSICAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 1,
        description: 'A swift water attack that always goes first.',
    },
    {
        id: 'hydro_pump',
        name: 'Hydro Pump',
        elementType: 'WATER',
        category: 'SPECIAL',
        basePower: 110,
        accuracy: 65,
        cooldown: 2,
        priority: 0,
        description: 'A devastating water blast.',
    },

    // ============================================
    // GRASS MOVES
    // ============================================
    {
        id: 'vine_whip',
        name: 'Vine Whip',
        elementType: 'GRASS',
        category: 'PHYSICAL',
        basePower: 45,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        description: 'Strikes with slender vines.',
    },
    {
        id: 'razor_leaf',
        name: 'Razor Leaf',
        elementType: 'GRASS',
        category: 'PHYSICAL',
        basePower: 55,
        accuracy: 95,
        cooldown: 0,
        priority: 0,
        description: 'Sharp-edged leaves attack.',
    },
    {
        id: 'solar_beam',
        name: 'Solar Beam',
        elementType: 'GRASS',
        category: 'SPECIAL',
        basePower: 120,
        accuracy: 60,
        cooldown: 2,
        priority: 0,
        description: 'A powerful beam of sunlight.',
    },
    {
        id: 'leaf_storm',
        name: 'Leaf Storm',
        elementType: 'GRASS',
        category: 'SPECIAL',
        basePower: 130,
        accuracy: 55,
        cooldown: 3,
        priority: 0,
        description: 'A devastating leaf attack. Very inaccurate.',
    },

    // ============================================
    // ELECTRIC MOVES
    // ============================================
    {
        id: 'thunder_shock',
        name: 'Thunder Shock',
        elementType: 'ELECTRIC',
        category: 'SPECIAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        statusEffect: 'PARALYSIS',
        statusChance: 0.1,
        description: 'An electric jolt. May cause paralysis.',
    },
    {
        id: 'thunderbolt',
        name: 'Thunderbolt',
        elementType: 'ELECTRIC',
        category: 'SPECIAL',
        basePower: 90,
        accuracy: 80,
        cooldown: 1,
        priority: 0,
        statusEffect: 'PARALYSIS',
        statusChance: 0.1,
        description: 'A strong electric attack. May cause paralysis.',
    },
    {
        id: 'thunder',
        name: 'Thunder',
        elementType: 'ELECTRIC',
        category: 'SPECIAL',
        basePower: 130,
        accuracy: 55,
        cooldown: 3,
        priority: 0,
        statusEffect: 'PARALYSIS',
        statusChance: 0.3,
        description: 'A devastating lightning strike. Very inaccurate.',
    },

    // ============================================
    // ICE MOVES
    // ============================================
    {
        id: 'ice_shard',
        name: 'Ice Shard',
        elementType: 'ICE',
        category: 'PHYSICAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 1,
        description: 'A swift ice attack that always goes first.',
    },
    {
        id: 'ice_beam',
        name: 'Ice Beam',
        elementType: 'ICE',
        category: 'SPECIAL',
        basePower: 90,
        accuracy: 80,
        cooldown: 1,
        priority: 0,
        statusEffect: 'FREEZE',
        statusChance: 0.1,
        description: 'An icy beam. May freeze the target.',
    },
    {
        id: 'blizzard',
        name: 'Blizzard',
        elementType: 'ICE',
        category: 'SPECIAL',
        basePower: 110,
        accuracy: 65,
        cooldown: 2,
        priority: 0,
        statusEffect: 'FREEZE',
        statusChance: 0.3,
        description: 'A howling blizzard. May freeze the target.',
    },

    // ============================================
    // EARTH MOVES
    // ============================================
    {
        id: 'mud_slap',
        name: 'Mud Slap',
        elementType: 'EARTH',
        category: 'SPECIAL',
        basePower: 20,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        description: 'Hurls mud at the target.',
    },
    {
        id: 'earthquake',
        name: 'Earthquake',
        elementType: 'EARTH',
        category: 'PHYSICAL',
        basePower: 100,
        accuracy: 100,
        cooldown: 2,
        priority: 0,
        description: 'A powerful seismic attack.',
    },
    {
        id: 'rock_slide',
        name: 'Rock Slide',
        elementType: 'EARTH',
        category: 'PHYSICAL',
        basePower: 75,
        accuracy: 90,
        cooldown: 1,
        priority: 0,
        description: 'Large rocks are hurled at the target.',
    },

    // ============================================
    // DARK MOVES
    // ============================================
    {
        id: 'shadow_sneak',
        name: 'Shadow Sneak',
        elementType: 'DARK',
        category: 'PHYSICAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 1,
        description: 'A sneaky attack that always goes first.',
    },
    {
        id: 'dark_pulse',
        name: 'Dark Pulse',
        elementType: 'DARK',
        category: 'SPECIAL',
        basePower: 80,
        accuracy: 100,
        cooldown: 1,
        priority: 0,
        description: 'A wave of darkness.',
    },
    {
        id: 'toxic',
        name: 'Toxic',
        elementType: 'DARK',
        category: 'STATUS',
        basePower: 0,
        accuracy: 90,
        cooldown: 1,
        priority: 0,
        statusEffect: 'POISON',
        statusChance: 1.0,
        description: 'Badly poisons the target.',
    },

    // ============================================
    // LIGHT MOVES
    // ============================================
    {
        id: 'flash',
        name: 'Flash',
        elementType: 'LIGHT',
        category: 'SPECIAL',
        basePower: 40,
        accuracy: 100,
        cooldown: 0,
        priority: 0,
        description: 'A flash of light damages the target.',
    },
    {
        id: 'holy_beam',
        name: 'Holy Beam',
        elementType: 'LIGHT',
        category: 'SPECIAL',
        basePower: 90,
        accuracy: 100,
        cooldown: 1,
        priority: 0,
        description: 'A beam of holy light.',
    },
    {
        id: 'barrier',
        name: 'Barrier',
        elementType: 'LIGHT',
        category: 'STATUS',
        basePower: 0,
        accuracy: 0,
        cooldown: 2,
        priority: 0,
        statusEffect: 'SHIELD',
        statusChance: 1.0,
        description: 'Creates a protective barrier.',
    },
];

// Helper for quick lookup
export const MOVE_BY_ID: Record<string, MoveDefinition> = Object.fromEntries(
    MOVE_DEFINITIONS.map((m) => [m.id, m])
);
