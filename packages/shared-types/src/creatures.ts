/**
 * Sample Creature Definitions for Pokémon-like Battle System
 */
import { CreatureDefinition } from './types.js';

export const CREATURE_DEFINITIONS: CreatureDefinition[] = [
    // ============================================
    // FIRE CREATURES
    // ============================================
    {
        id: 'flame_lizard',
        name: 'Flame Lizard',
        elementType: 'FIRE',
        baseHp: 78,
        baseAtk: 84,
        baseDef: 78,
        baseSpd: 100,
        rarity: 'RARE',
        passiveAbilityId: 'blaze',
        movePoolIds: ['ember', 'flamethrower', 'inferno', 'tackle', 'quick_strike'],
        spriteKey: 'creature_flame_lizard',
    },
    {
        id: 'fire_hound',
        name: 'Fire Hound',
        elementType: 'FIRE',
        baseHp: 75,
        baseAtk: 110,
        baseDef: 70,
        baseSpd: 95,
        rarity: 'EPIC',
        passiveAbilityId: 'intimidate',
        movePoolIds: ['ember', 'flamethrower', 'inferno', 'quick_strike', 'dark_pulse'],
        spriteKey: 'creature_fire_hound',
    },

    // ============================================
    // WATER CREATURES
    // ============================================
    {
        id: 'aqua_turtle',
        name: 'Aqua Turtle',
        elementType: 'WATER',
        baseHp: 79,
        baseAtk: 83,
        baseDef: 100,
        baseSpd: 78,
        rarity: 'RARE',
        passiveAbilityId: 'shell_armor',
        movePoolIds: ['water_gun', 'aqua_jet', 'hydro_pump', 'ice_beam', 'tackle'],
        spriteKey: 'creature_aqua_turtle',
    },
    {
        id: 'storm_serpent',
        name: 'Storm Serpent',
        elementType: 'WATER',
        baseHp: 95,
        baseAtk: 75,
        baseDef: 80,
        baseSpd: 81,
        rarity: 'EPIC',
        passiveAbilityId: 'swift_swim',
        movePoolIds: ['water_gun', 'hydro_pump', 'thunderbolt', 'ice_beam', 'aqua_jet'],
        spriteKey: 'creature_storm_serpent',
    },

    // ============================================
    // GRASS CREATURES
    // ============================================
    {
        id: 'forest_dino',
        name: 'Forest Dino',
        elementType: 'GRASS',
        baseHp: 80,
        baseAtk: 82,
        baseDef: 83,
        baseSpd: 80,
        rarity: 'RARE',
        passiveAbilityId: 'overgrow',
        movePoolIds: ['vine_whip', 'razor_leaf', 'solar_beam', 'sleep_powder', 'tackle'],
        spriteKey: 'creature_forest_dino',
    },
    {
        id: 'thorn_beast',
        name: 'Thorn Beast',
        elementType: 'GRASS',
        baseHp: 100,
        baseAtk: 100,
        baseDef: 90,
        baseSpd: 50,
        rarity: 'EPIC',
        passiveAbilityId: 'thick_fat',
        movePoolIds: ['vine_whip', 'razor_leaf', 'solar_beam', 'earthquake', 'slam'],
        spriteKey: 'creature_thorn_beast',
    },

    // ============================================
    // ELECTRIC CREATURES
    // ============================================
    {
        id: 'spark_mouse',
        name: 'Spark Mouse',
        elementType: 'ELECTRIC',
        baseHp: 35,
        baseAtk: 55,
        baseDef: 40,
        baseSpd: 90,
        rarity: 'COMMON',
        passiveAbilityId: 'static',
        movePoolIds: ['thunder_shock', 'thunderbolt', 'thunder_wave', 'quick_strike'],
        spriteKey: 'creature_spark_mouse',
    },
    {
        id: 'thunder_bird',
        name: 'Thunder Bird',
        elementType: 'ELECTRIC',
        baseHp: 90,
        baseAtk: 90,
        baseDef: 85,
        baseSpd: 100,
        rarity: 'LEGENDARY',
        passiveAbilityId: 'pressure',
        movePoolIds: ['thunder_shock', 'thunderbolt', 'thunder_wave', 'ice_beam', 'quick_strike'],
        spriteKey: 'creature_thunder_bird',
    },

    // ============================================
    // ICE CREATURES
    // ============================================
    {
        id: 'frost_wolf',
        name: 'Frost Wolf',
        elementType: 'ICE',
        baseHp: 75,
        baseAtk: 90,
        baseDef: 80,
        baseSpd: 115,
        rarity: 'RARE',
        passiveAbilityId: 'snow_cloak',
        movePoolIds: ['ice_shard', 'ice_beam', 'blizzard', 'quick_strike', 'dark_pulse'],
        spriteKey: 'creature_frost_wolf',
    },
    {
        id: 'glacier_golem',
        name: 'Glacier Golem',
        elementType: 'ICE',
        baseHp: 130,
        baseAtk: 70,
        baseDef: 130,
        baseSpd: 30,
        rarity: 'EPIC',
        passiveAbilityId: 'sturdy',
        movePoolIds: ['ice_shard', 'ice_beam', 'blizzard', 'earthquake', 'rock_slide'],
        spriteKey: 'creature_glacier_golem',
    },

    // ============================================
    // EARTH CREATURES
    // ============================================
    {
        id: 'stone_guardian',
        name: 'Stone Guardian',
        elementType: 'EARTH',
        baseHp: 110,
        baseAtk: 100,
        baseDef: 120,
        baseSpd: 45,
        rarity: 'RARE',
        passiveAbilityId: 'rock_head',
        movePoolIds: ['mud_slap', 'earthquake', 'rock_slide', 'tackle', 'slam'],
        spriteKey: 'creature_stone_guardian',
    },
    {
        id: 'sand_dragon',
        name: 'Sand Dragon',
        elementType: 'EARTH',
        baseHp: 108,
        baseAtk: 130,
        baseDef: 95,
        baseSpd: 102,
        rarity: 'LEGENDARY',
        passiveAbilityId: 'sand_veil',
        movePoolIds: ['earthquake', 'rock_slide', 'flamethrower', 'dark_pulse', 'quick_strike'],
        spriteKey: 'creature_sand_dragon',
    },

    // ============================================
    // DARK CREATURES
    // ============================================
    {
        id: 'shadow_cat',
        name: 'Shadow Cat',
        elementType: 'DARK',
        baseHp: 65,
        baseAtk: 65,
        baseDef: 60,
        baseSpd: 130,
        rarity: 'RARE',
        passiveAbilityId: 'prankster',
        movePoolIds: ['shadow_sneak', 'dark_pulse', 'toxic', 'thunder_wave', 'quick_strike'],
        spriteKey: 'creature_shadow_cat',
    },
    {
        id: 'nightmare_demon',
        name: 'Nightmare Demon',
        elementType: 'DARK',
        baseHp: 105,
        baseAtk: 120,
        baseDef: 70,
        baseSpd: 80,
        rarity: 'EPIC',
        passiveAbilityId: 'moxie',
        movePoolIds: ['shadow_sneak', 'dark_pulse', 'toxic', 'earthquake', 'inferno'],
        spriteKey: 'creature_nightmare_demon',
    },

    // ============================================
    // LIGHT CREATURES
    // ============================================
    {
        id: 'holy_knight',
        name: 'Holy Knight',
        elementType: 'LIGHT',
        baseHp: 90,
        baseAtk: 85,
        baseDef: 95,
        baseSpd: 70,
        rarity: 'RARE',
        passiveAbilityId: 'guardian',
        movePoolIds: ['flash', 'holy_beam', 'barrier', 'thunder_wave', 'quick_strike'],
        spriteKey: 'creature_holy_knight',
    },
    {
        id: 'celestial_dragon',
        name: 'Celestial Dragon',
        elementType: 'LIGHT',
        baseHp: 100,
        baseAtk: 100,
        baseDef: 90,
        baseSpd: 90,
        rarity: 'LEGENDARY',
        passiveAbilityId: 'multiscale',
        movePoolIds: ['holy_beam', 'barrier', 'flamethrower', 'ice_beam', 'thunderbolt'],
        spriteKey: 'creature_celestial_dragon',
    },

    // ============================================
    // NEUTRAL CREATURES
    // ============================================
    {
        id: 'common_slime',
        name: 'Common Slime',
        elementType: 'NEUTRAL',
        baseHp: 70,
        baseAtk: 50,
        baseDef: 50,
        baseSpd: 40,
        rarity: 'COMMON',
        passiveAbilityId: 'regenerator',
        movePoolIds: ['tackle', 'slam', 'toxic'],
        spriteKey: 'creature_common_slime',
    },
    {
        id: 'warrior_bear',
        name: 'Warrior Bear',
        elementType: 'NEUTRAL',
        baseHp: 110,
        baseAtk: 130,
        baseDef: 75,
        baseSpd: 55,
        rarity: 'RARE',
        passiveAbilityId: 'guts',
        movePoolIds: ['tackle', 'slam', 'earthquake', 'ice_beam', 'quick_strike'],
        spriteKey: 'creature_warrior_bear',
    },
];

// Helper for quick lookup
export const CREATURE_BY_ID: Record<string, CreatureDefinition> = Object.fromEntries(
    CREATURE_DEFINITIONS.map((c) => [c.id, c])
);
