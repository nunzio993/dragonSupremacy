import { EquipmentDefinition } from './types.js';

/**
 * 10 Equipment Types for v1
 * Mix of pure stat boosts and special effects
 */
export const EQUIPMENT_DEFINITIONS: EquipmentDefinition[] = [
    // === WEAPONS ===
    {
        id: 'e01',
        name: 'Iron Sword',
        type: 'weapon',
        bonusHp: 0,
        bonusAtk: 3,
        bonusSpd: 0,
        effectType: 'none',
        effectParams: {},
        iconKey: 'equip_iron_sword',
    },
    {
        id: 'e02',
        name: 'Vampiric Blade',
        type: 'weapon',
        bonusHp: 0,
        bonusAtk: 2,
        bonusSpd: 0,
        effectType: 'lifesteal',
        effectParams: { percentHeal: 10 },
        iconKey: 'equip_vampiric_blade',
    },
    {
        id: 'e03',
        name: 'Flame Dagger',
        type: 'weapon',
        bonusHp: 0,
        bonusAtk: 4,
        bonusSpd: 0,
        effectType: 'first_hit_bonus',
        effectParams: { bonusDamage: 2 },
        iconKey: 'equip_flame_dagger',
    },

    // === ARMOR ===
    {
        id: 'e04',
        name: 'Steel Shield',
        type: 'armor',
        bonusHp: 20,
        bonusAtk: 0,
        bonusSpd: 0,
        effectType: 'none',
        effectParams: {},
        iconKey: 'equip_steel_shield',
    },
    {
        id: 'e05',
        name: 'Plate Armor',
        type: 'armor',
        bonusHp: 30,
        bonusAtk: -1,
        bonusSpd: -1,
        effectType: 'block_chance',
        effectParams: { chancePercent: 15, blockAmount: 1 },
        iconKey: 'equip_plate_armor',
    },
    {
        id: 'e06',
        name: 'Mage Robe',
        type: 'armor',
        bonusHp: 10,
        bonusAtk: 2,
        bonusSpd: 0,
        effectType: 'none',
        effectParams: {},
        iconKey: 'equip_mage_robe',
    },

    // === TRINKETS ===
    {
        id: 'e07',
        name: 'Speed Boots',
        type: 'trinket',
        bonusHp: 0,
        bonusAtk: 0,
        bonusSpd: 2,
        effectType: 'none',
        effectParams: {},
        iconKey: 'equip_speed_boots',
    },
    {
        id: 'e08',
        name: 'Lucky Charm',
        type: 'trinket',
        bonusHp: 5,
        bonusAtk: 1,
        bonusSpd: 1,
        effectType: 'dodge_chance',
        effectParams: { chancePercent: 10 },
        iconKey: 'equip_lucky_charm',
    },
    {
        id: 'e09',
        name: 'War Banner',
        type: 'trinket',
        bonusHp: 0,
        bonusAtk: 0,
        bonusSpd: 0,
        effectType: 'team_atk_buff',
        effectParams: { atkBonus: 1 },
        iconKey: 'equip_war_banner',
    },
    {
        id: 'e10',
        name: 'Phoenix Feather',
        type: 'trinket',
        bonusHp: 0,
        bonusAtk: 0,
        bonusSpd: 0,
        effectType: 'revive',
        effectParams: { reviveHpPercent: 20 },
        iconKey: 'equip_phoenix_feather',
    },
];

// Helper for quick lookup
export const EQUIPMENT_BY_ID: Record<string, EquipmentDefinition> = Object.fromEntries(
    EQUIPMENT_DEFINITIONS.map((e) => [e.id, e])
);
