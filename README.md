# NFT Autobattler

A minimal autobattler game with RMRK NFT integration. Players collect units and equipment (represented as NFTs), build teams, and battle against AI opponents.

## Features

- **12 Unique Units** - Different rarities (Common/Rare/Epic/Legendary) with unique passives
- **10 Equipment Types** - Weapons, Armor, and Trinkets with stat bonuses and special effects
- **Deterministic Battle Engine** - Reproducible matches with seeded RNG
- **RMRK NFT Integration** - Units and equipment as nested NFTs
- **Responsive UI** - Works on desktop and mobile browsers

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)

### Development Setup

```bash
# Clone and install dependencies
cd nft-autobattler
npm install

# Start PostgreSQL (via Docker)
docker-compose up -d postgres

# Run database migrations
npm run db:migrate --workspace=backend

# Start development servers
npm run dev
```

The game will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Docker Deployment

```bash
# Build and run all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

## Project Structure

```
nft-autobattler/
├── packages/
│   ├── shared-types/      # TypeScript interfaces & game data
│   ├── game-engine/       # Battle simulation logic
│   └── rmrk-module/       # RMRK NFT integration
├── backend/               # Express API server
├── frontend/              # React + Vite frontend
├── docs/                  # Documentation
└── docker-compose.yml
```

## Game Rules

### Battle Flow
1. Select up to 3 units for your team
2. Equip up to 2 items per unit
3. Start battle - combat is automatic
4. Earn XP based on result (Win: 20 XP, Draw: 10 XP, Loss: 5 XP)

### Turn Order
- Units act in order of SPD (highest first)
- Each turn: attack a random enemy, apply damage ±1

### Passives & Effects
Units have passive abilities that trigger under certain conditions:
- `hp_boost_when_equipped` - +10% HP when equipped
- `damage_boost_low_hp` - +25% damage when HP < 50%
- `heal_on_kill` - Heal 5 HP on kill
- `aoe_splash` - Deal splash damage to all enemies
- And more...

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/guest` | Create guest account |
| GET | `/api/v1/roster` | Get player's units & equipment |
| POST | `/api/v1/roster/loadout` | Save active loadout |
| POST | `/api/v1/roster/equip` | Equip item to unit |
| POST | `/api/v1/match/simulate` | Run battle vs AI |
| GET | `/api/v1/match/history` | Get match history |
| GET | `/api/v1/gamedata/all` | Get unit & equipment definitions |

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **NFT**: RMRK (mock implementation for v1)

## Documentation

- [Game Design](./docs/game-design.md) - Full game rules and mechanics
- [Architecture](./docs/architecture.md) - Technical architecture overview
- [RMRK Integration](./docs/rmrk-integration.md) - NFT mapping and flows
- [Assumptions & TODO](./docs/assumptions-todo.md) - Design decisions and future work

## License

MIT
