# Frontend UI/UX Upgrade - Technical Notes

## Overview
Incremental upgrade to the Match screen experience. No changes to backend, game-engine, or RMRK modules.

---

## Changes Made

### MatchScreen.tsx

#### A) Replay Controls
- **Play/Pause**: Toggle button pauses/resumes event playback using `useRef` to control async loop
- **Speed Control**: 0.5x / 1x / 2x buttons modify delay timing via ref-based speed multiplier
- **Step Forward**: Advances one event when paused using step request flag
- **Restart**: Resets unit states from stored initial data and replays from beginning
- **Timeline Bar**: Visual progress indicator showing current event position (click for position feedback)

**Implementation Notes**:
- Used refs (`isPausedRef`, `playbackSpeedRef`, `stepRequestRef`) to control async `playEvents()` loop
- Stored initial match data in `matchDataRef` for restart functionality
- Added `playbackAbortRef` for cleanup on component unmount

#### B) Stats Display
- **Live Status Bar**: Shows "X / Y" alive units for each team at top of screen
- **Mini Stats**: HP and ATK shown inline below each unit's HP bar
- **Unit Tooltip**: Hover reveals full stats (HP, ATK, SPD) plus rarity badge
  - Hidden on mobile (< 768px) for touch compatibility

#### C) Error Handling
- **Error State**: Displays error message with retry button instead of navigating away
- **Try Again**: Calls `startMatch()` to retry the `/match/simulate` API call

#### D) Performance
- **React.memo()**: Wrapped `BattleUnitDisplay` component to prevent unnecessary re-renders
- **useCallback**: Applied to all event handlers passed to child components
- **useMemo**: Computed alive counts and timeline progress with memoization

---

### MatchScreen.css

#### New Styles
- `.playback-controls` - Control bar container with flex layout
- `.control-btn` / `.control-btn-main` - Circular control buttons with hover effects
- `.speed-btn` / `.speed-btn.active` - Speed selector toggles
- `.timeline-container` / `.timeline-bar` / `.timeline-progress` - Progress visualization
- `.battle-status-bar` - Live unit count display
- `.unit-tooltip` - Floating tooltip with stats
- `.error-container` - Error state styling
- `.rarity-glow-*` - Colored glows for unit avatars by rarity

#### Responsive Updates
- Mobile (< 768px): Controls stick to bottom, battlefield stacks vertically
- Tooltip hidden on mobile to avoid touch conflicts
- Reduced control button sizes for touch targets
- Event log height reduced to 80px on mobile

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Refs for playback control | React state updates are async; refs provide immediate access in async loops |
| Memoized BattleUnitDisplay | Prevents re-render of all units when only one changes |
| Timeline click logs only | Full state reconstruction for scrubbing would require event snapshots - deferred |
| Tooltip hidden on mobile | Touch events conflict with hover; touch-and-hold would delay interaction |

---

## Open Items / Future Improvements

1. **Full Timeline Scrubbing**: Currently shows progress only. Full implementation would require:
   - Snapshot state at each event
   - Reconstruct team states when seeking to any position

2. **Sound Effects**: No audio feedback currently - could add attack/damage sounds

3. **Unit Death Animation**: Could fade out dead units more smoothly

4. **Turn Counter**: Could show "Turn X" in status bar (requires tracking turn events)

5. **Match Replay from History**: HistoryScreen could use same replay controls for past matches

---

## Files Modified

| File | Lines | Description |
|------|-------|-------------|
| `frontend/src/screens/MatchScreen.tsx` | ~530 | Complete rewrite with controls |
| `frontend/src/screens/MatchScreen.css` | ~470 | New control/tooltip/responsive styles |

## Files Not Modified
- `frontend/src/screens/HistoryScreen.tsx` - No changes
- `frontend/src/screens/HomeScreen.tsx` - No changes
- `frontend/src/screens/PreMatchScreen.tsx` - No changes
- `frontend/src/screens/RosterScreen.tsx` - No changes
- `backend/*` - No changes
- `packages/game-engine/*` - No changes
- `packages/rmrk-mock/*` - No changes
