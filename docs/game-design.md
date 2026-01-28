# Game Design Document

## Overview

NFT Autobattler is a minimal 1v1 autobattler game where players:
1. Collect units and equipment (as NFTs)
2. Build teams of up to 3 units
3. Equip items to boost stats
4. Battle automatically against AI

Matches are short (30-60 seconds) with simple but engaging mechanics.

---

## Units

### Base Stats

| Stat | Description |
|------|-------------|
| HP | Health points - unit dies at 0 |
| ATK | Base damage per attack |
| SPD | Determines turn order (higher = faster) |

### Roles

- **Frontline**: Typically tankier, meant to absorb damage
- **Backline**: Typically glass cannons, high damage but fragile

### Rarities

| Rarity | Description |
|--------|-------------|
| Common | Basic units, no special traits |
| Rare | Better stats, modest passives |
| Epic | Strong passives, good synergies |
| Legendary | Powerful game-changing abilities |

### Unit List (v1)

| ID | Name | Rarity | HP | ATK | SPD | Passive |
|----|------|--------|-----|-----|-----|---------|
| u01 | Iron Guard | Common | 120 | 8 | 3 | +10% HP when equipped |
| u02 | Swift Scout | Common | 60 | 10 | 8 | +15% SPD first turn |
| u03 | Battle Mage | Common | 80 | 12 | 5 | +2 ATK vs low HP targets |
| u04 | Militia Soldier | Common | 90 | 9 | 5 | None |
| u05 | Stone Titan | Rare | 150 | 6 | 2 | 20% block 1 dmg |
| u06 | Shadow Blade | Rare | 70 | 14 | 7 | +25% dmg when HP<50% |
| u07 | Holy Knight | Rare | 100 | 10 | 4 | Heal 5 HP on kill |
| u08 | Poison Assassin | Rare | 65 | 11 | 6 | 10% lifesteal |
| u09 | Berserker | Epic | 90 | 16 | 5 | +1 ATK per turn |
| u10 | Frost Archer | Epic | 65 | 13 | 6 | Slow target -1 SPD |
| u11 | Dragon Lord | Legendary | 130 | 15 | 5 | AoE 3 splash damage |
| u12 | Time Wizard | Legendary | 55 | 9 | 10 | 50% chance act twice |

---

## Equipment

### Types

| Type | Description |
|------|-------------|
| Weapon | Primarily ATK bonuses |
| Armor | Primarily HP bonuses |
| Trinket | Mixed bonuses, special effects |

### Equipment List (v1)

| ID | Name | Type | +HP | +ATK | +SPD | Effect |
|----|------|------|-----|------|------|--------|
| e01 | Iron Sword | Weapon | 0 | 3 | 0 | None |
| e02 | Vampiric Blade | Weapon | 0 | 2 | 0 | 10% lifesteal |
| e03 | Flame Dagger | Weapon | 0 | 4 | 0 | +2 first hit |
| e04 | Steel Shield | Armor | 20 | 0 | 0 | None |
| e05 | Plate Armor | Armor | 30 | -1 | -1 | 15% block 1 |
| e06 | Mage Robe | Armor | 10 | 2 | 0 | None |
| e07 | Speed Boots | Trinket | 0 | 0 | 2 | None |
| e08 | Lucky Charm | Trinket | 5 | 1 | 1 | 10% dodge |
| e09 | War Banner | Trinket | 0 | 0 | 0 | Team +1 ATK |
| e10 | Phoenix Feather | Trinket | 0 | 0 | 0 | Revive 20% HP |

### Slot Rules

- Each unit has 2 equipment slots
- Any equipment type can go in any slot
- Equipment can be freely swapped between units

---

## Battle System

### Turn Order

1. All units sorted by SPD (descending)
2. Ties broken by: Team A first, then slot index

### Attack Flow

1. Skip if unit is dead
2. Select random alive enemy as target
3. Calculate damage: `ATK + random(-1, +1)`
4. Apply attacker passives/effects
5. Check target dodge/block
6. Apply damage
7. Apply lifesteal
8. Check for death
9. Apply on-death effects

### Win Conditions

- **Victory**: All enemy units dead
- **Defeat**: All your units dead
- **Draw**: After 100 turns, both teams alive

### RNG

- Damage variance: ±1
- Deterministic: same seed = same result
- Seed derived from match ID + timestamp

---

## Progression

### XP System

| Result | XP Gained |
|--------|-----------|
| Victory | 20 |
| Draw | 10 |
| Defeat | 5 |

### Account Level

- Level = floor(XP / 100) + 1
- Higher level unlocks harder AI opponents

### Starter Pack

New accounts receive:
- 4 Common units (Iron Guard, Swift Scout, Battle Mage, Militia Soldier)
- 4 Equipment (Iron Sword, Vampiric Blade, Flame Dagger, Steel Shield)
- 100 soft currency

---

## AI Opponent

### Difficulty Scaling

AI team composition based on player level:

| Level | Available Rarities |
|-------|-------------------|
| 1-2 | Common only |
| 3-4 | Common + Rare |
| 5-7 | Common + Rare + Epic |
| 8+ | All rarities |

### Equipment

- Equipment chance: 30% + (level × 10%), max 80%
- Higher levels get better equipment pool
