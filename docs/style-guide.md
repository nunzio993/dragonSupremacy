# NFT Autobattler Style Guide

## ART_STYLE

| Property | Value | Notes |
|----------|-------|-------|
| **Perspective** | Side-view battle | Creatures face each other horizontally |
| **Lineart** | Black outline 1.5–2px | Consistent weight, no tapered strokes |
| **Shading** | 2-layer cel-shading | Base color + 1 shadow layer, hard edge |
| **Palette Saturation** | 0.85 | Vibrant but not neon |
| **Contrast** | Medium | Avoid pure black shadows on light areas |
| **Backgrounds** | Soft gradient, low-detail | No distracting elements, max 3 colors |
| **Sprite Scale** | Uniform creature height ±10% | All creatures roughly same canvas size |

### Constraints
- No gradients within creature sprites (only cel-shading)
- No drop shadows on sprites
- Background must not compete with foreground elements
- All assets export as PNG with transparency

---

## CREATURE_STYLE

| Property | Value | Notes |
|----------|-------|-------|
| **Silhouette** | Readable at 64x64px | Must be identifiable without color |
| **Proportions** | Chibi 2.5 heads | Head = 40% of body height |
| **Idle Pose** | Neutral, front paws forward | Weight centered, no dynamic action |
| **Facing** | Right (player) / Left (enemy) | Flip horizontally for enemy side |
| **Variations** | Palette swaps + accessories only | Same base silhouette per species |

### Constraints
- No limbs extending beyond bounding box
- Eyes must be visible in idle pose
- Maximum 6 colors per creature (excluding outline)
- Accessories must not obscure silhouette

---

## FX_STYLE

| Property | Value | Notes |
|----------|-------|-------|
| **Layer Mode** | Additive | Bright on dark background |
| **Blur** | None | Crisp edges only |
| **Particles** | No overflow | Stay within sprite bounds |
| **Duration** | 200–400ms | Quick, punchy feedback |

### Damage FX
| Effect | Implementation |
|--------|----------------|
| Hit Flash | Red tint overlay (#ff4444), 100ms |
| Shake | ±4px horizontal, 150ms, ease-out |
| HP Decrease | Animate bar width, 300ms |

### Status FX
| Status | Visual |
|--------|--------|
| Poison | Purple tint pulse |
| Burn | Orange flicker overlay |
| Freeze | Blue static tint |
| Paralysis | Yellow spark flash |

### Constraints
- No motion blur
- No particle systems (sprite-based only)
- FX must not obscure creature silhouette
- Audio sync at 50% of animation duration

---

## UI_STYLE

| Property | Value |
|----------|-------|
| **Style** | Flat design |
| **Corners** | Rounded (8–12px radius) |
| **Base Color** | `#1e1e22` |
| **Accent Primary** | `#4aa7ff` (blue) |
| **Accent Secondary** | `#ff6a6a` (red) |
| **Font Family** | Sans-serif, bold weight |
| **Font Fallback** | system-ui, -apple-system |

### HP Bar
| Property | Value |
|----------|-------|
| **Style** | Segmented (10 segments) |
| **Height** | 16px |
| **Colors** | Green > Yellow > Red (threshold-based) |
| **Border** | 2px `rgba(255,255,255,0.1)` |
| **Animation** | Width transition 300ms ease |

### Color Thresholds
| HP % | Color |
|------|-------|
| 100–50% | `#2ecc71` (green) |
| 49–25% | `#f1c40f` (yellow) |
| 24–0% | `#e74c3c` (red, pulsing) |

### Buttons
| State | Style |
|-------|-------|
| Default | `#4aa7ff` background, white text |
| Hover | Lighten 10%, subtle scale 1.02 |
| Disabled | `#444` background, `#888` text |
| Destructive | `#ff6a6a` background |

### Constraints
- No serif fonts
- No gradients on interactive elements
- Minimum touch target 44x44px
- Text contrast ratio ≥ 4.5:1

---

## Quick Reference

```
Colors:
  --bg-base:      #1e1e22
  --accent-blue:  #4aa7ff
  --accent-red:   #ff6a6a
  --hp-green:     #2ecc71
  --hp-yellow:    #f1c40f
  --hp-red:       #e74c3c
  --text-primary: #ffffff
  --text-muted:   #888888

Spacing:
  --radius-sm:    4px
  --radius-md:    8px
  --radius-lg:    12px

Timing:
  --fx-fast:      200ms
  --fx-normal:    300ms
  --fx-slow:      400ms
```
