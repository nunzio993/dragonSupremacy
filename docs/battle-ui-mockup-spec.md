# Battle UI Mockup Specification

## Canvas
- **Resolution:** 1920×1080px
- **Aspect Ratio:** 16:9
- **Background:** #1e1e22

---

## Layout Grid

```
┌────────────────────────────────────────────────────────────────┐
│                         HEADER (80px)                          │
│  [Turn: 5]                                    [⚔️ YOUR TURN]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                      BATTLEFIELD (700px)                       │
│                                                                │
│   ┌─────────────────┐              ┌─────────────────┐        │
│   │   HP BAR + INFO │              │   HP BAR + INFO │        │
│   ├─────────────────┤              ├─────────────────┤        │
│   │                 │              │                 │        │
│   │    PLAYER       │      VS      │     ENEMY       │        │
│   │    CREATURE     │              │    CREATURE     │        │
│   │    (256x256)    │              │    (256x256)    │        │
│   │                 │              │                 │        │
│   └─────────────────┘              └─────────────────┘        │
│         👤 YOU                           🤖 ENEMY              │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                       EVENT LOG (100px)                        │
│  "Flame Lizard used Fire Blast! It's super effective!"        │
├────────────────────────────────────────────────────────────────┤
│                      MOVE PANEL (200px)                        │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  Fire Blast  │  │  Tackle      │                           │
│  │  🔥 FIRE 90  │  │  ⚪ NORMAL 40│                           │
│  └──────────────┘  └──────────────┘                           │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  Ember       │  │  Protect     │                           │
│  │  🔥 FIRE 40  │  │  ⚪ STATUS   │                           │
│  └──────────────┘  └──────────────┘                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### HP Bar Component
```
┌─────────────────────────────────────────────────────┐
│  Flame Lizard  Lv.15  🔥    ████████▓▓  ☠️⚡       │
│                            ─────────────           │
│                             85 / 100 HP            │
└─────────────────────────────────────────────────────┘

Width: 280px
Height: 60px
```

| Element | Position | Style |
|---------|----------|-------|
| Name | Left | Bold 16px white, 1px black outline |
| Level | After name | "Lv.15" 14px #888 |
| Type Icon | After level | 20×20px element icon |
| HP Bar | Below name | 220×16px, segmented (10 segments) |
| HP Text | Below bar | "85 / 100 HP" 12px white |
| Status Icons | Right of bar | 24×24px, max 3 icons |

### HP Bar Segments
```css
/* 10 segments with 2px gaps */
.hp-segment {
    width: 20px;
    height: 16px;
    margin-right: 2px;
    border-radius: 2px;
}

/* Colors by % */
100-50%: #2ecc71 (green)
49-25%:  #f1c40f (yellow)
24-0%:   #e74c3c (red, pulsing)
```

### Move Button
```
┌────────────────────────┐
│     Fire Blast         │  ← Name: Bold 14px white
│     🔥 FIRE    90      │  ← Type icon + name + power
└────────────────────────┘

Width: 200px
Height: 70px
Background: rgba(255,255,255,0.1)
Border: 2px solid element color
Border-radius: 12px
Hover: lighten 10%, scale 1.02
```

---

## Creature Placement

| Side | X Position | Y Position | Facing |
|------|------------|------------|--------|
| Player | 25% from left | Center - 50px | Right → |
| Enemy | 75% from left | Center - 50px | ← Left |

### Creature Card
- Avatar: 256×256px sprite
- Border: 3px element color
- Shadow: 0 4px 20px rgba(0,0,0,0.3)

---

## Background

### Battlefield Gradient
```css
background: linear-gradient(
    180deg,
    #2a2a3e 0%,      /* Sky */
    #1e1e22 60%,     /* Horizon */
    #151518 100%     /* Ground */
);
```

### Horizon Line
- Position: 60% from top
- Style: Subtle 1px line, rgba(255,255,255,0.05)
- Optional: Low-detail hills silhouette

---

## Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Creature Name | System Sans | 16px | Bold | #ffffff |
| Level | System Sans | 14px | Normal | #888888 |
| HP Text | System Sans | 12px | Bold | #ffffff |
| Move Name | System Sans | 14px | Bold | #ffffff |
| Move Power | System Sans | 12px | Normal | #aaaaaa |
| Event Log | System Sans | 14px | Normal | #cccccc |

**Text Outline:** 1px #000000 for all white text on variable backgrounds

---

## Color Palette

```css
:root {
    /* Base */
    --bg-primary: #1e1e22;
    --bg-secondary: #2a2a3e;
    --bg-card: rgba(255, 255, 255, 0.08);
    
    /* Accents */
    --accent-player: #4aa7ff;
    --accent-enemy: #ff6a6a;
    --accent-action: #27ae60;
    
    /* HP States */
    --hp-full: #2ecc71;
    --hp-mid: #f1c40f;
    --hp-low: #e74c3c;
    
    /* Text */
    --text-primary: #ffffff;
    --text-secondary: #888888;
    --text-muted: #666666;
}
```

---

## Export Checklist

- [ ] PNG 1920×1080 flattened
- [ ] PSD with layers:
  - Background
  - Player Creature
  - Player HP Bar
  - Enemy Creature
  - Enemy HP Bar
  - Move Panel
  - Event Log
  - Header
- [ ] No debug elements
- [ ] No excessive particles
- [ ] All text has outlines
