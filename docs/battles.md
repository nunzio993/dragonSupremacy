# Battle Systems Documentation

This document describes the two battle systems in the NFT Autobattler game.

---

## Overview

The game supports two distinct battle modes:

| Feature | Auto Battle (Legacy) | Turn-Based Battle |
|---------|---------------------|-------------------|
| Interaction | Instant simulation | Player chooses actions each turn |
| Engine | `simulateBattle()` | `simulateTurn()` |
| Entities | Units + Equipment | Creatures + Moves |
| Database | `matches` table | `turn_battles` table |
| Routes | `/api/v1/match/*` | `/api/v1/turn-battle/*` |
| Frontend | `MatchScreen` | `TurnBattleScreen` |

---

## Auto Battle (Legacy)

The original autobattler system where battles are simulated instantly.

### Flow
```
PreMatchScreen → Select Units → Click "Auto Battle (Legacy)"
       ↓
Backend simulates entire battle instantly
       ↓
MatchScreen shows replay of events
```

### Backend

**Route File:** `backend/src/routes/match.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/match/simulate` | POST | Simulate full battle |
| `/match/history` | GET | Get match history |
| `/match/:id/replay` | GET | Get match data for replay |

**Database Table:** `matches`
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY,
  account_id UUID,
  seed BIGINT,
  result VARCHAR(10),          -- 'teamA', 'teamB', 'draw'
  opponent_type VARCHAR(20),   -- 'ai'
  team_a JSONB,                -- PlayerUnitInstance[]
  team_b JSONB,                -- PlayerUnitInstance[]
  events JSONB,                -- MatchEvent[]
  total_turns INTEGER,
  xp_gained INTEGER,
  created_at TIMESTAMPTZ
);
```

### Game Engine

**Function:** `simulateBattle(setup: MatchSetup): MatchResult`

- Takes team composition and simulates entire battle
- Returns winner, events array, and final state
- Deterministic based on seed

---

## Turn-Based Battle (New)

Interactive Pokémon-style battles where players choose actions each turn.

### Flow
```
PreMatchScreen → Select 3 Creatures → Click "Turn-Based Battle"
       ↓
Backend creates initial BattleState
       ↓
TurnBattleScreen (interactive):
  - View active creatures
  - Select move or switch
  - Submit action → Backend simulates turn → Update state
  - Repeat until battle ends
       ↓
Result overlay (Victory/Defeat/Draw)
```

### Backend

**Route File:** `backend/src/routes/turn-battle.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/turn-battle/start` | POST | Start new battle |
| `/turn-battle/action` | POST | Submit player action |
| `/turn-battle/state/:id` | GET | Get current state |
| `/turn-battle/active` | GET | List active battles |

**AI Service:** `backend/src/services/ai.ts`
- Generates AI team (easy/medium/hard)
- Generates AI action each turn

**Database Table:** `turn_battles`
```sql
CREATE TABLE turn_battles (
  id UUID PRIMARY KEY,
  player_id UUID,
  state_json JSONB,            -- Full BattleState object
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Game Engine

**Function:** `simulateTurn(state, p1Action, p2Action, seed): BattleState`

- Pure function (no side effects)
- Deterministic (same inputs = same output)
- Returns new state with events from the turn

**Features:**
- 9 element types with effectiveness chart
- Status effects (Burn, Poison, Sleep, Freeze, Paralysis, Shield)
- Priority and speed-based action order
- Cooldown management
- Automatic switch on faint

### Types (from `shared-types`)

```typescript
interface BattleState {
  id: string;
  seed: number;
  turnNumber: number;
  phase: BattlePhase;
  result: BattleResult;
  player1: PlayerSide;
  player2: PlayerSide;
  lastTurnEvents: BattleEvent[];
}

interface PlayerAction {
  playerId: string;
  type: 'USE_MOVE' | 'SWITCH';
  moveId?: string;
  switchToInstanceId?: string;
}

interface CreatureInstance {
  instanceId: string;
  creatureDefinitionId: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  status: StatusEffectType;
  isFainted: boolean;
  knownMoveIds: string[];
  moveCooldowns: Record<string, number>;
}
```

---

## Frontend Components

### PreMatchScreen
- Select 3 creatures for battle
- Two buttons:
  - "⚡ Auto Battle (Legacy)" → `/match`
  - "🎮 Turn-Based Battle" → `/turn-battle`

### MatchScreen (Legacy)
- Plays back recorded events
- Timeline controls (play, pause, speed, step)
- Unit tooltips with stats

### TurnBattleScreen (New)
- Interactive battle UI
- Creature cards with HP bars and status
- Move grid (4 buttons with power, type, cooldown)
- Switch panel (bench creatures)
- Event log
- Result overlay

---

## Type Effectiveness Chart

```
FIRE     → GRASS 2x, ICE 2x, WATER 0.5x, FIRE 0.5x
WATER    → FIRE 2x, EARTH 2x, GRASS 0.5x, WATER 0.5x
GRASS    → WATER 2x, EARTH 2x, FIRE 0.5x, ICE 0.5x
ELECTRIC → WATER 2x, EARTH 0x (immune)
ICE      → GRASS 2x, EARTH 2x, FIRE 0.5x, ICE 0.5x
EARTH    → FIRE 2x, ELECTRIC 2x, WATER 0.5x, GRASS 0.5x
DARK     → LIGHT 2x, DARK 0.5x
LIGHT    → DARK 2x, LIGHT 0.5x
NEUTRAL  → No bonuses or weaknesses
```

---

## Future Considerations

1. **PvP Support:** Turn-based system designed for PvP (both players submit actions)
2. **RMRK Integration:** Creature/Move NFTs will replace DB-based ownership
3. **Legacy Deprecation:** Auto-battle may be removed or converted to use creatures
