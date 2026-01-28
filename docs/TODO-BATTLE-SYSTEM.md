# 🚧 TODO - Features da Implementare

Questo file contiene tutte le feature mock o non implementate nel sistema di battaglia.

---

## 🔴 CRITICO - Blocca il gioco

### 1. Move Database (MANCA)
**File necessario:** `backend/src/data/moves.ts`

Il creature-generator genera mosse come stringhe ID (`['spark', 'thunderbolt', ...]`), ma il battle system ha bisogno di oggetti `Move` completi.

**Da implementare:**
```typescript
// Esempio struttura
export const MOVE_DATABASE: Record<string, Move> = {
    'spark': {
        moveId: 'spark',
        name: 'Spark',
        type: 'ELECTRIC',
        category: 'SPECIAL',
        power: 55,
        accuracy: 100,
        cooldownMax: 0,
        priority: 0,
        statusEffect: 'PARALYZE',
        statusChance: 0.10
    },
    // ... tutte le mosse per ogni elemento
};
```

**Move pools da definire:**
- FIRE: ember, flamethrower, inferno, fire_fang, tackle, quick_strike
- WATER: water_gun, aqua_jet, hydro_pump, ice_beam, tackle, quick_strike
- GRASS: vine_whip, razor_leaf, solar_beam, leaf_storm, tackle, quick_strike
- ELECTRIC: spark, thunderbolt, thunder, volt_switch, tackle, quick_strike
- ICE: ice_shard, ice_beam, blizzard, ice_fang, tackle, quick_strike
- EARTH: mud_slap, earthquake, rock_slide, stone_edge, tackle, quick_strike
- DARK: shadow_sneak, dark_pulse, night_slash, crunch, tackle, quick_strike
- LIGHT: flash, holy_beam, divine_light, radiance, tackle, quick_strike

---

### 2. Creature Fetching in Battle (USA MOCK)
**File:** `backend/src/matchmaking/socket-handlers.ts`
**Linee:** 339-340, 821-870

**Problema attuale:**
```typescript
const creatureA = createMockCreature(room.hostCreatureId, room.hostPlayerId, 'ELECTRIC');
const creatureB = createMockCreature(room.guestCreatureId!, room.guestPlayerId!, 'ICE');
```

**Da implementare:**
- Recuperare i dati della creatura reale dal contratto via `creature.tokenId`
- Usare `generateCreature(genSeed, elementType)` per ricostruire stats, personality, ecc
- Convertire gli ID delle mosse in oggetti Move usando il Move Database
- Passare la BattleCreature completa al battle engine

---

### 3. Creature Name in Lobby (USA "Unknown")
**File:** `backend/src/matchmaking/socket-handlers.ts`
**Linee:** 156, 197, 206, 260, 778

**Problema attuale:**
```typescript
hostCreatureName: 'Unknown', // TODO: Fetch from DB
```

**Da implementare:**
- Recuperare il nome della creatura (es. "Fire Dragon #42") dal contratto o generarlo dinamicamente

---

## 🟡 MEDIO - Migliora l'esperienza

### 4. Creature Sprites
**File:** `frontend/src/screens/Room/Room.tsx`
**Linee:** 337, 344

**Problema attuale:**
```tsx
<img src="/creature-attack.png" alt={...} />
<img src="/creature-mock.png" alt={...} />
```

**Da implementare:**
- Generare o assegnare sprite unici per ogni tipo di elemento/creatura
- Usare l'elemento della creatura per scegliere lo sprite corretto

---

### 5. Creature Level Display
**File:** `frontend/src/screens/Room/Room.tsx`
**Linee:** 319, 351

**Problema attuale:**
```tsx
<span className="creature-level">Lv.50</span>
```

**Da implementare:**
- Mostrare il livello reale della creatura dal contratto

---

### 6. On-chain Payout
**File:** `backend/src/matchmaking/socket-handlers.ts`
**Linea:** 748

**Problema attuale:**
```typescript
// TODO: Trigger on-chain payout
```

**Da implementare:**
- Chiamare lo smart contract per distribuire la stake al vincitore
- Gestire le fees della piattaforma (2%)

---

### 7. Stake Verification
**File:** `backend/src/matchmaking/socket-handlers.ts`
**Linea:** 304-306

**Problema attuale:**
```typescript
// TODO: Verify transaction on-chain
// For now, just mark as deposited
```

**Da implementare:**
- Verificare effettivamente che la transazione di stake sia stata completata on-chain
- Non permettere l'inizio della battaglia senza conferma

---

## 🟢 BASSO - Nice to have

### 8. XP Service Integration
Il sistema XP è implementato ma va verificato che funzioni correttamente con creature reali.

### 9. Reconnection Battle State
La logica di reconnection è presente ma potrebbe servire testing.

### 10. Battle Resolution Multicall Contract
**File:** `contracts/src/BattleResolver.sol` (da creare)

**Problema attuale:**
Alla fine di una battaglia, il backend esegue 4 transazioni separate in sequenza:
1. `BattleGateV2.resolveBattle()` 
2. `HPManager.setHP()` per winner
3. `HPManager.setHP()` per loser
4. `RMRKCreature.addXP()` x2

Questo è inefficiente e lento (4 TX separate, rischio nonce conflict).

**Da implementare:**
- Creare contratto `BattleResolver.sol` con funzione `resolveBattleFull(battleId, winner, winnerCreatureId, loserCreatureId, winnerHp, loserHp, winnerXp, loserXp)`
- Questa funzione chiama tutti i contratti in una sola TX
- Dare permessi a BattleResolver come `trustedBackend`, `hpUpdater`, `xpManager`
- Risparmio gas e tempo, più atomico

---

## 📋 Ordine di Implementazione Suggerito

1. **Move Database** - CRITICO, blocca tutto
2. **Creature Fetching** - CRITICO, dipende da Move Database
3. **Creature Name** - MEDIO, facile da implementare
4. **Creature Level** - FACILE, già presente nei dati
5. **Sprites** - MEDIO, richiede assets
6. **Stake/Payout** - MEDIO, richiede smart contract work
