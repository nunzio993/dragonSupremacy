# Assumptions & TODO

This document tracks design decisions made when information was not specified, and future work.

---

## Assumptions Made

### Game Balance

| Assumption | Value | Rationale |
|------------|-------|-----------|
| Max turns before draw | 100 | Prevents infinite matches while allowing long battles |
| Damage variance | ±1 | Minimal RNG, still noticeable tactically |
| Max units per team | 3 | Simple composition without overwhelming choices |
| Max equipment per unit | 2 | Allows meaningful builds without complexity |
| Equipment slots | Any type in any slot | Simplifies UI, more freedom for players |

### Progression

| Assumption | Value | Rationale |
|------------|-------|-----------|
| XP per win | 20 | Meaningful progress per match |
| XP per loss | 5 | Still encouraging to play |
| XP per draw | 10 | Middle ground |
| XP per level | 100 | Easy to understand, ~5 wins per level |
| Starting soft currency | 100 | Enough for a few actions |

### AI Opponent

| Assumption | Value | Rationale |
|------------|-------|-----------|
| AI team size | Same as player | Fair matchup |
| Rarity unlocks | Level-gated | Gradual difficulty increase |
| Equipment chance | 30% + 10%/level | Progressive challenge |

### Technical

| Assumption | Value | Rationale |
|------------|-------|-----------|
| JWT expiry | 7 days | Balance security/convenience |
| Guest auth | Auto-create on first visit | Minimal friction |
| Match history limit | 50 | Reasonable API response size |
| Animation speed | 200-500ms per event | Readable but not slow |

---

## Future Work (TODO)

### v1.1 - Polish

- [ ] Sound effects for attacks/deaths
- [ ] Battle speed controls (1x, 2x, skip)
- [ ] Unit level-up system
- [ ] More detailed stats screen
- [ ] Tutorial for new players

### v1.2 - Content

- [ ] 6 more units (18 total)
- [ ] 5 more equipment items (15 total)
- [ ] Set bonuses for equipment combos
- [ ] Daily login rewards
- [ ] Achievement system

### v2.0 - Multiplayer

- [ ] PvP matchmaking
- [ ] Leaderboards
- [ ] Seasons/rankings
- [ ] Friend battles
- [ ] Spectator mode

### v2.1 - Economy

- [ ] Unit upgrade/fusion
- [ ] Equipment crafting
- [ ] Trading between players
- [ ] Premium currency
- [ ] Battle pass

### RMRK Integration

- [ ] Connect to real RMRK SDK
- [ ] Deploy NFT collections on Kusama
- [ ] Implement multi-resource skins
- [ ] Enable NFT trading
- [ ] On-chain match verification

### Technical Improvements

- [ ] WebSocket for real-time battles
- [ ] Redis caching
- [ ] Rate limiting
- [ ] Analytics/metrics
- [ ] Error tracking (Sentry)
- [ ] Load testing
- [ ] CI/CD pipeline

---

## Potential Variations

### Original Spec Alternatives

These are options that could be implemented if the current approach doesn't work:

1. **Turn Order**: Could use initiative system instead of pure SPD
2. **Targeting**: Could add targeting priority (lowest HP, highest ATK, etc.)
3. **Equipment Slots**: Could restrict by type (1 weapon, 1 armor)
4. **Team Size**: Could scale up to 5v5 for more depth
5. **Match Length**: Could reduce max turns to 50 for faster games

### Monetization Options (Future)

1. **Cosmetics Only**: Skins, effects, avatars
2. **Battle Pass**: Seasonal progression rewards
3. **Gacha**: Random unit/equipment packs
4. **Direct Purchase**: Buy specific units/equipment
5. **NFT Sales**: Initial NFT collection sale

---

## Known Limitations

1. **No Real-time PvP**: Current version is async vs AI only
2. **Mock RMRK**: Not connected to real blockchain yet
3. **No Persistence of RNG State**: Each match is independent
4. **Simple AI**: Random team selection, no strategy
5. **No Localization**: English only
6. **No Mobile App**: Web only (but mobile-responsive)

---

## Change Log

### 2026-01-20 - Initial Design

- Created 12 units with balanced stats
- Created 10 equipment items
- Implemented deterministic battle engine
- Mock RMRK service
- Full frontend with all screens
- Docker deployment setup
