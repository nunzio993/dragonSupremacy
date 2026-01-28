import { UnitDefinition } from './types.js';

/**
 * 12 Base Units for v1
 * Balanced for variety: tanks, glass cannons, supports
 */
export const UNIT_DEFINITIONS: UnitDefinition[] = [
    // === COMMON (4 units) ===
    {
        id: 'u01',
        name: 'Iron Guard',
        rarity: 'common',
        baseHp: 120,
        baseAtk: 8,
        baseSpd: 3,
        role: 'frontline',
        passiveType: 'hp_boost_when_equipped',
        passiveParams: { percentBoost: 10 },
        spriteKey: 'unit_iron_guard',
    },
    {
        id: 'u02',
        name: 'Swift Scout',
        rarity: 'common',
        baseHp: 60,
        baseAtk: 10,
        baseSpd: 8,
        role: 'backline',
        passiveType: 'speed_boost_first_turn',
        passiveParams: { percentBoost: 15 },
        spriteKey: 'unit_swift_scout',
    },
    {
        id: 'u03',
        name: 'Battle Mage',
        rarity: 'common',
        baseHp: 80,
        baseAtk: 12,
        baseSpd: 5,
        role: 'backline',
        passiveType: 'damage_vs_low_hp',
        passiveParams: { bonusAtk: 2, thresholdPercent: 50 },
        spriteKey: 'unit_battle_mage',
    },
    {
        id: 'u04',
        name: 'Militia Soldier',
        rarity: 'common',
        baseHp: 90,
        baseAtk: 9,
        baseSpd: 5,
        role: 'frontline',
        passiveType: 'none',
        passiveParams: {},
        spriteKey: 'unit_militia_soldier',
    },

    // === RARE (4 units) ===
    {
        id: 'u05',
        name: 'Stone Titan',
        rarity: 'rare',
        baseHp: 150,
        baseAtk: 6,
        baseSpd: 2,
        role: 'frontline',
        passiveType: 'block_chance',
        passiveParams: { chancePercent: 20, blockAmount: 1 },
        spriteKey: 'unit_stone_titan',
    },
    {
        id: 'u06',
        name: 'Shadow Blade',
        rarity: 'rare',
        baseHp: 70,
        baseAtk: 14,
        baseSpd: 7,
        role: 'backline',
        passiveType: 'damage_boost_low_hp',
        passiveParams: { percentBoost: 25, thresholdPercent: 50 },
        spriteKey: 'unit_shadow_blade',
    },
    {
        id: 'u07',
        name: 'Holy Knight',
        rarity: 'rare',
        baseHp: 100,
        baseAtk: 10,
        baseSpd: 4,
        role: 'frontline',
        passiveType: 'heal_on_kill',
        passiveParams: { healAmount: 5 },
        spriteKey: 'unit_holy_knight',
    },
    {
        id: 'u08',
        name: 'Poison Assassin',
        rarity: 'rare',
        baseHp: 65,
        baseAtk: 11,
        baseSpd: 6,
        role: 'backline',
        passiveType: 'lifesteal',
        passiveParams: { percentHeal: 10 },
        spriteKey: 'unit_poison_assassin',
    },

    // === EPIC (2 units) ===
    {
        id: 'u09',
        name: 'Berserker',
        rarity: 'epic',
        baseHp: 90,
        baseAtk: 16,
        baseSpd: 5,
        role: 'frontline',
        passiveType: 'atk_per_turn',
        passiveParams: { atkGain: 1 },
        spriteKey: 'unit_berserker',
    },
    {
        id: 'u10',
        name: 'Frost Archer',
        rarity: 'epic',
        baseHp: 65,
        baseAtk: 13,
        baseSpd: 6,
        role: 'backline',
        passiveType: 'slow_target',
        passiveParams: { spdReduction: 1 },
        spriteKey: 'unit_frost_archer',
    },

    // === LEGENDARY (2 units) ===
    {
        id: 'u11',
        name: 'Dragon Lord',
        rarity: 'legendary',
        baseHp: 130,
        baseAtk: 15,
        baseSpd: 5,
        role: 'frontline',
        passiveType: 'aoe_splash',
        passiveParams: { splashDamage: 3 },
        spriteKey: 'unit_dragon_lord',
    },
    {
        id: 'u12',
        name: 'Time Wizard',
        rarity: 'legendary',
        baseHp: 55,
        baseAtk: 9,
        baseSpd: 10,
        role: 'backline',
        passiveType: 'double_action_chance',
        passiveParams: { chancePercent: 50 },
        spriteKey: 'unit_time_wizard',
    },
];

// Helper for quick lookup
export const UNIT_BY_ID: Record<string, UnitDefinition> = Object.fromEntries(
    UNIT_DEFINITIONS.map((u) => [u.id, u])
);
