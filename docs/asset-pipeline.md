# Asset Generation Pipeline

AI-assisted workflow for generating game art assets.

---

## Phase 1: Concept

**Purpose:** Initial creature design exploration

**Prompt Template:**
```
2d creature concept, pokemon-like, side-view, chibi proportions, 
clean black outlines, flat cel shading, solid background, 
no effects, high readability, no text
```

**Variables:**
- `{creature_type}` - fire lizard, water turtle, etc.
- `{element}` - fire, water, grass, electric, etc.

**Output:** Reference image for silhouette approval

---

## Phase 2: Battle Sprite

**Purpose:** Final game-ready sprite

**Prompt Template:**
```
2d battle sprite, side-view, idle pose, clean black outline, 
flat cel shading, transparent background, resolution 256x256, 
no motion blur, no fx
```

**Requirements:**
| Property | Value |
|----------|-------|
| Resolution | 256×256px |
| Format | PNG with alpha |
| Background | Transparent |
| Pose | Idle, weight centered |
| Facing | Right (flip for enemy) |

---

## Phase 3: Alternate Skin

**Purpose:** Rarity variants and shiny versions

**Prompt Template:**
```
apply palette swap and minor accessory, preserve silhouette, 
preserve outline thickness, same pose, static, side-view
```

**Variation Types:**
| Rarity | Modification |
|--------|--------------|
| Common | Base palette |
| Rare | Saturated palette + small accessory |
| Epic | Gold/purple tones + medium accessory |
| Legendary | Glowing accents + unique accessory |

**Constraints:**
- Silhouette must remain identical
- Outline thickness unchanged
- Accessories ≤ 15% of sprite area

---

## Phase 4: FX Elements

**Purpose:** Attack and status effect animations

**Prompt Template:**
```
2d fx sprite sheet for elemental attack, additive look, 
simple shapes, no blur, transparent background, resolution 128x128
```

**Sprite Sheet Layout:**
```
┌─────┬─────┬─────┬─────┐
│ F1  │ F2  │ F3  │ F4  │  ← 4 frames
└─────┴─────┴─────┴─────┘
```

**Element FX Colors:**
| Element | Primary | Secondary |
|---------|---------|-----------|
| Fire | #ff6b35 | #ffd93d |
| Water | #4ecdc4 | #81d4fa |
| Grass | #7cb342 | #c5e1a5 |
| Electric | #ffd93d | #fff59d |
| Ice | #81d4fa | #e1f5fe |
| Earth | #8d6e63 | #bcaaa4 |
| Dark | #5c4d7d | #9575cd |
| Light | #fff59d | #ffffff |

---

## Phase 5: Export

**Final Deliverables:**

| Asset Type | Format | Resolution | Layers |
|------------|--------|------------|--------|
| Battle Sprite | PNG | 256×256 | Single |
| FX Sheet | PNG | 512×128 | Single |
| Concept | PNG/PSD | Any | If available |

**Checklist:**
- [ ] PNG with alpha channel
- [ ] No background remnants
- [ ] No text or watermarks
- [ ] No AI artifacts at edges
- [ ] Consistent outline weight
- [ ] Layered PSD if available

---

## File Naming Convention

```
sprites/
├── creatures/
│   ├── {creature_id}_idle.png
│   ├── {creature_id}_rare.png
│   ├── {creature_id}_epic.png
│   └── {creature_id}_legendary.png
├── fx/
│   ├── {element}_attack.png
│   └── {element}_hit.png
└── concepts/
    └── {creature_id}_concept.png
```

**Examples:**
- `flame_lizard_idle.png`
- `fire_attack.png`
- `frost_wolf_epic.png`

---

## Quality Checklist

Before importing assets:

1. **Silhouette Test** - Recognizable at 64×64px
2. **Edge Check** - No aliasing artifacts
3. **Color Count** - ≤ 8 colors per sprite
4. **Transparency** - Clean alpha, no halos
5. **Consistency** - Matches style guide
