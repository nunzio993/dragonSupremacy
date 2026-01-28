# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND                              │
│  React + Vite + TypeScript                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Screens   │  │ Components  │  │  Contexts   │         │
│  │  - Home     │  │ - UnitCard  │  │ - Auth      │         │
│  │  - Roster   │  │ - BattleUI  │  │ - GameData  │         │
│  │  - Match    │  │ - HPBar     │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                               │
│  Express + TypeScript                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Routes    │  │ Middleware  │  │  Services   │         │
│  │  - auth     │  │ - JWT auth  │  │ - RMRK mock │         │
│  │  - roster   │  │ - CORS      │  │             │         │
│  │  - match    │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                                │                  │
│         ▼                                ▼                  │
│  ┌─────────────┐                  ┌─────────────┐          │
│  │ PostgreSQL  │                  │ Game Engine │          │
│  │  - accounts │                  │ (pure logic)│          │
│  │  - units    │                  │             │          │
│  │  - matches  │                  │             │          │
│  └─────────────┘                  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ (Future)
┌─────────────────────────────────────────────────────────────┐
│                    RMRK BLOCKCHAIN                          │
│  Kusama Parachain                                           │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │  Unit NFTs  │──│ Equip NFTs  │ (nested children)        │
│  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Package Structure

### packages/shared-types

Core TypeScript interfaces used across all packages:

```typescript
// Key types
UnitDefinition      // Static unit data
EquipmentDefinition // Static equipment data
PlayerUnitInstance  // Player-owned unit
MatchSetup          // Battle configuration
MatchEvent          // Battle log entry
MatchResult         // Battle outcome
```

Also exports game data:
- `UNIT_DEFINITIONS` - 12 unit types
- `EQUIPMENT_DEFINITIONS` - 10 equipment types
- `UNIT_BY_ID` / `EQUIPMENT_BY_ID` - lookup maps

### packages/game-engine

Pure logic battle simulation:

```typescript
// Main function
simulateBattle(setup: MatchSetup): MatchResult

// RNG
createRng(seed: number): Rng
createMatchSeed(matchId: string, timestamp: number): number
```

Features:
- Deterministic (same seed = same result)
- No side effects (pure functions)
- Testable in isolation
- Processes all passives and equipment effects

### packages/rmrk-module

RMRK NFT integration:

```typescript
interface IRmrkService {
  mintUnitNFT(ownerId, unitDefId): Promise<string>
  mintEquipNFT(ownerId, equipDefId): Promise<string>
  attachEquipToUnit(unitNftId, equipNftId): Promise<void>
  detachEquipFromUnit(unitNftId, equipNftId): Promise<void>
  // ... more methods
}

// Current implementation
class MockRmrkService implements IRmrkService
```

---

## Backend API Design

### Authentication

- Guest auth: `POST /api/v1/auth/guest`
- JWT tokens with 7-day expiry
- Token in `Authorization: Bearer <token>` header

### RESTful Endpoints

| Resource | Endpoint | Methods |
|----------|----------|---------|
| Auth | `/api/v1/auth/*` | POST |
| Roster | `/api/v1/roster` | GET |
| Loadout | `/api/v1/roster/loadout` | POST |
| Equipment | `/api/v1/roster/equip` | POST |
| Match | `/api/v1/match/simulate` | POST |
| History | `/api/v1/match/history` | GET |
| Game Data | `/api/v1/gamedata/*` | GET |

### Response Format

```json
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Error message"
}
```

---

## Database Schema

```sql
-- Accounts
accounts (
  id UUID PK,
  created_at TIMESTAMPTZ,
  xp INTEGER,
  level INTEGER,
  soft_currency INTEGER
)

-- Player's units
player_units (
  id UUID PK,
  account_id UUID FK,
  unit_definition_id VARCHAR,
  rmrk_nft_id VARCHAR
)

-- Player's equipment
player_equipment (
  id UUID PK,
  account_id UUID FK,
  equipment_definition_id VARCHAR,
  equipped_on_unit_id UUID FK NULLABLE,
  rmrk_nft_id VARCHAR
)

-- Active loadout
loadouts (
  id UUID PK,
  account_id UUID FK UNIQUE,
  unit_ids UUID[]
)

-- Match history
matches (
  id UUID PK,
  account_id UUID FK,
  seed BIGINT,
  result VARCHAR,
  team_a JSONB,
  team_b JSONB,
  events JSONB,
  total_turns INTEGER,
  xp_gained INTEGER,
  created_at TIMESTAMPTZ
)
```

---

## Frontend Architecture

### State Management

- **AuthContext**: Login state, JWT token
- **GameDataContext**: Unit/equipment definitions

### Screen Flow

```
Home
  │
  ├── Roster ──────────────┐
  │   (view/equip units)   │
  │                        │
  ├── Pre-Match ◄──────────┤
  │   (select team)        │
  │       │                │
  │       ▼                │
  │   Match ───────────────┤
  │   (battle animation)   │
  │       │                │
  │       ▼                │
  │   Result ──────────────┘
  │
  └── History
      (past matches)
```

### API Client

Centralized in `services/api.ts`:
- Auto-attaches JWT token
- Typed methods for all endpoints
- Error handling

---

## Deployment

### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | Database |
| backend | 3001 | API server |
| frontend | 3000 | Web UI (nginx) |

### Environment Variables

```bash
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=<secret>
CORS_ORIGINS=http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:3001
```
