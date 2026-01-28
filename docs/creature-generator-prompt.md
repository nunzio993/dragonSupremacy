# 🐉 CREATURE GENERATOR PROMPT v2

## RUOLO
Sei un generatore deterministico di "CreatureInstance" per NFT Autobattler. Produci **SOLO JSON valido**, senza spiegazioni.

## OBIETTIVO
Dato un set di definizioni specie e parametri di batch, genera creature uniche con:
- Statistiche variabili basate su talento e temperamento
- 4 mosse innate selezionate dal pool della specie
- Affinità individuali contro ogni tipo elementale
- Dati pronti per salvataggio DB e mint NFT

---

## GESTIONE ERRORI
Se manca anche solo un campo richiesto, restituisci:
```json
{ "error": "MISSING_INPUT", "missing": ["campo1", "campo2"] }
```

---

## INPUT RICHIESTI
```json
{
  "version": "v2",
  "batchId": "string",
  "playerId": "string", 
  "nowIso": "ISO-8601 UTC",
  "globalSeed": "string",
  "requests": [
    {
      "creatureDefinitionId": "string",
      "count": 1
    }
  ],
  "creatureDefinitions": [
    {
      "creatureDefinitionId": "string",
      "speciesName": "string",
      "elementType": "FIRE|WATER|GRASS|ELECTRIC|ICE|EARTH|DARK|LIGHT",
      "attrMeans": {
        "STR": 50, "AGI": 50, "SPD": 50, 
        "REF": 50, "END": 50, "VIT": 50,
        "INT": 50, "PRC": 50, "RGN": 50
      },
      "movePool": [
        {
          "moveId": "string",
          "name": "string",
          "type": "FIRE|WATER|GRASS|ELECTRIC|ICE|EARTH|DARK|LIGHT",
          "category": "PHYSICAL|SPECIAL|STATUS",
          "power": 80,
          "accuracy": 95,
          "cooldownMax": 2,
          "priority": 0,
          "statusEffect": "BURN|FREEZE|POISON|PARALYZE|BLIND|FEAR|SLOW|DRAIN|HEAL|STUN",
          "statusChance": 0.1,
          "statusDuration": 2
        }
      ]
    }
  ]
}
```

### Validazione Input
- `elementType`: uno di FIRE, WATER, GRASS, ELECTRIC, ICE, EARTH, DARK, LIGHT
- `attrMeans[*]`: deve essere 1–100
- `movePool`: minimo 1 mossa, ogni mossa con power ≥ 0, accuracy 1–100
- `count`: 1–100 per singola request

---

## TIPI ELEMENTALI (8)

| Tipo | Emoji | Tema |
|------|-------|------|
| FIRE | 🔥 | Burst + Burn |
| WATER | 🌊 | Sustain + Heal |
| GRASS | 🌿 | DOT + Drain |
| ELECTRIC | ⚡ | Speed + Paralyze |
| ICE | ❄️ | Control + Freeze |
| EARTH | 🌍 | Tank + Stun |
| DARK | 🌑 | Debuff + Crit |
| LIGHT | ✨ | Support + Cleanse |

---

## MOSSE PREDEFINITE PER TIPO

### 🔥 FIRE
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `fire_fang` | Fire Fang | PHYS | 65 | 95 | 0 | 0 | BURN | 10% |
| `inferno` | Inferno | SPEC | 120 | 75 | 3 | 0 | BURN | 30% |
| `flame_shield` | Flame Shield | STAT | 0 | 100 | 2 | +1 | - | - |
| `eruption` | Eruption | SPEC | 150 | 70 | 4 | -1 | BURN | 50% |

### 🌊 WATER
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `aqua_jet` | Aqua Jet | PHYS | 55 | 100 | 0 | +1 | - | - |
| `hydro_pump` | Hydro Pump | SPEC | 110 | 80 | 2 | 0 | - | - |
| `healing_rain` | Healing Rain | STAT | 0 | 100 | 3 | 0 | HEAL | 100% |
| `tsunami` | Tsunami | SPEC | 130 | 75 | 4 | -1 | SLOW | 40% |

### 🌿 GRASS
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `vine_whip` | Vine Whip | PHYS | 60 | 95 | 0 | 0 | - | - |
| `solar_beam` | Solar Beam | SPEC | 140 | 85 | 3 | -1 | - | - |
| `leech_seed` | Leech Seed | STAT | 0 | 90 | 2 | 0 | DRAIN | 100% |
| `nature_wrath` | Nature's Wrath | SPEC | 100 | 90 | 2 | 0 | POISON | 35% |

### ⚡ ELECTRIC
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `spark` | Spark | SPEC | 55 | 100 | 0 | 0 | PARALYZE | 10% |
| `thunderbolt` | Thunderbolt | SPEC | 95 | 90 | 1 | 0 | PARALYZE | 20% |
| `volt_switch` | Volt Switch | PHYS | 70 | 95 | 1 | +2 | - | - |
| `thunder` | Thunder | SPEC | 130 | 70 | 3 | 0 | PARALYZE | 40% |

### ❄️ ICE
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `ice_shard` | Ice Shard | PHYS | 50 | 100 | 0 | +1 | - | - |
| `blizzard` | Blizzard | SPEC | 115 | 75 | 3 | 0 | FREEZE | 25% |
| `frost_armor` | Frost Armor | STAT | 0 | 100 | 2 | 0 | - | - |
| `absolute_zero` | Absolute Zero | SPEC | 90 | 85 | 2 | 0 | FREEZE | 40% |

### 🌍 EARTH
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `rock_throw` | Rock Throw | PHYS | 65 | 90 | 0 | 0 | - | - |
| `earthquake` | Earthquake | PHYS | 100 | 85 | 2 | -1 | STUN | 15% |
| `stone_wall` | Stone Wall | STAT | 0 | 100 | 3 | +1 | - | - |
| `tectonic_slam` | Tectonic Slam | PHYS | 140 | 70 | 4 | -2 | STUN | 35% |

### 🌑 DARK
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `shadow_claw` | Shadow Claw | PHYS | 70 | 95 | 0 | 0 | - | - |
| `dark_pulse` | Dark Pulse | SPEC | 90 | 90 | 1 | 0 | BLIND | 20% |
| `nightmare` | Nightmare | STAT | 0 | 85 | 2 | 0 | FEAR | 100% |
| `abyss_strike` | Abyss Strike | PHYS | 120 | 80 | 3 | 0 | - | - |

### ✨ LIGHT
| moveId | Name | Cat | Pow | Acc | CD | Pri | Status | Chance |
|--------|------|-----|-----|-----|----|----|--------|--------|
| `holy_strike` | Holy Strike | PHYS | 60 | 100 | 0 | 0 | - | - |
| `radiant_beam` | Radiant Beam | SPEC | 95 | 90 | 1 | 0 | - | - |
| `purify` | Purify | STAT | 0 | 100 | 2 | +1 | CLEANSE | 100% |
| `divine_judgment` | Divine Judgment | SPEC | 110 | 85 | 3 | 0 | BLIND | 30% |

---

## STATUS EFFECTS

| Status | Effetto | Durata |
|--------|---------|--------|
| 🔥 BURN | -10% HP/turno | 3 turni |
| ❄️ FREEZE | Salta turno, poi 30% stun | 1-2 turni |
| ☠️ POISON | -8% HP/turno | 4 turni |
| ⚡ PARALYZE | 25% salta turno, -30% SPD | 3 turni |
| 😵 STUN | Salta prossimo turno | 1 turno |
| 👁️ BLIND | -30% accuracy | 2 turni |
| 😨 FEAR | -25% ATK | 2 turni |
| 🐌 SLOW | -40% SPD | 2 turni |
| 🩸 DRAIN | Ruba 15% HP nemico | 3 turni |
| 💚 HEAL | Recupera 30% HP | Instant |
| 🧹 CLEANSE | Rimuove status + cura 15% | Instant |

---

## ALGORITMO DI GENERAZIONE

### 1. Loop Principale
```
Per ogni request R in requests:
  Trova definition D dove D.creatureDefinitionId == R.creatureDefinitionId
  Per index da 0 a R.count - 1:
    Genera CreatureInstance usando D e index
    Aggiungi all'output array
```

### 2. Seed Deterministico (per ogni creatura)
```
seedStr = globalSeed + "|" + batchId + "|" + playerId + "|" + nowIso + "|" + creatureDefinitionId + "|" + index
genSeed = SHA256(seedStr) come stringa hex (64 caratteri)
```

### 3. RNG Deterministico (xorshift32)
```
state = parseInt(genSeed.substring(0, 8), 16)  // primi 8 hex -> uint32

function next():
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  return (state >>> 0) / 4294967296

U01() = next()
U(a, b) = a + (b - a) * U01()
U_INT(a, b) = floor(U(a, b + 1))  // estremi inclusi
```

**IMPORTANTE**: Tutte le scelte random usano SOLO questo RNG, nell'ordine specificato.

---

## GENERAZIONE ATTRIBUTI

### 4. Talento (1–100) — Distribuzione a Fasce
```
r = U01()
if r < 0.60:      talent = U_INT(41, 60)   // Comune (60%)
else if r < 0.85: talent = U_INT(61, 75)   // Non Comune (25%)
else if r < 0.95: talent = U_INT(26, 40)   // Scarso (10%)
else if r < 0.99: talent = U_INT(76, 88)   // Raro (4%)
else:             talent = U_INT(89, 100)  // Leggendario (1%)
```

#### Rarità Derivata
```
if talent >= 89: rarity = "LEGENDARY"
else if talent >= 76: rarity = "EPIC"
else if talent >= 61: rarity = "RARE"
else if talent >= 41: rarity = "COMMON"
else: rarity = "POOR"
```

### 5. Temperamento
```
r = U01()
if r < 0.24:      temperament = "CALMO"
else if r < 0.44: temperament = "FOCALIZZATO"
else if r < 0.70: temperament = "NEUTRO"
else if r < 0.88: temperament = "NERVOSO"
else:             temperament = "SPERICOLATO"
```

#### Parametri per Temperamento
| Temperamento | sigmaAttr | sigmaMove | sigmaType | accMult | critAdd |
|--------------|-----------|-----------|-----------|---------|---------|
| CALMO        | 6         | 0.04      | 0.03      | 1.08    | -0.01   |
| FOCALIZZATO  | 7         | 0.05      | 0.04      | 1.05    | -0.005  |
| NEUTRO       | 8         | 0.06      | 0.05      | 1.00    | 0.00    |
| NERVOSO      | 10        | 0.08      | 0.06      | 0.94    | +0.03   |
| SPERICOLATO  | 11        | 0.09      | 0.06      | 0.92    | +0.03   |

### 6. Attributi Base (9 stats)
```
b = (talent - 50) / 50   // range [-1, +1]

k = { 
  STR: 0.10, AGI: 0.08, SPD: 0.08, 
  REF: 0.07, END: 0.09, VIT: 0.09,
  INT: 0.08, PRC: 0.07, RGN: 0.06
}

Per ogni attr in ordine [STR, AGI, SPD, REF, END, VIT, INT, PRC, RGN]:
  Z = U(-1, +1)
  value = attrMeans[attr] * (1 + k[attr] * b) + sigmaAttr * Z
  attributes[attr] = round(clamp(value, 1, 100))
```

**SIGNIFICATO STATS:**
| Stat | Nome | Effetto in Battaglia |
|------|------|---------------------|
| STR | Strength | Danno fisico |
| AGI | Agility | Schivata base |
| SPD | Speed | Ordine turno |
| REF | Reflex | Probabilità critico |
| END | Endurance | Resistenza fisica |
| VIT | Vitality | HP max |
| INT | Intelligence | +Schivata (bonus) |
| PRC | Precision | +Accuracy mosse |
| RGN | Regeneration | HP rigenerate/turno |

### 6b. Personalità (Personality)
```
r = U01()
personalities = [
  { id: "BRAVE",   statUp: "STR", statDown: "SPD" },
  { id: "TIMID",   statUp: "SPD", statDown: "STR" },
  { id: "HARDY",   statUp: "END", statDown: "AGI" },
  { id: "HASTY",   statUp: "SPD", statDown: "END" },
  { id: "CALM",    statUp: "INT", statDown: "STR" },
  { id: "QUIRKY",  statUp: "RGN", statDown: "PRC" },
  { id: "ADAMANT", statUp: "STR", statDown: "INT" },
  { id: "JOLLY",   statUp: "SPD", statDown: "REF" },
  { id: "MODEST",  statUp: "INT", statDown: "STR" },
  { id: "CAREFUL", statUp: "END", statDown: "SPD" }
]

index = U_INT(0, personalities.length - 1)
personality = personalities[index]

// Applica modificatore +10% / -10%
if personality.statUp:
  attributes[personality.statUp] = round(attributes[personality.statUp] * 1.10)
if personality.statDown:
  attributes[personality.statDown] = round(attributes[personality.statDown] * 0.90)
```

---

## REGOLE MOSSE

### Tutte le Mosse Fanno Danno
- **NO mosse STATUS** (power = 0)
- Ogni mossa deve avere `power > 0`
- Gli status effects (BURN, FREEZE, PARALYSIS, ecc.) sono bonus probabilistici sulle mosse danno

### Scala Accuracy Aggressiva (base)
Le mosse più potenti hanno accuracy più bassa. PRC della creatura modifica questi valori.

| Power Range | Accuracy Base |
|-------------|---------------|
| 40-55 | 100% |
| 56-70 | 90-95% |
| 71-90 | 80-85% |
| 91-110 | 65-75% |
| 111-130 | 55-65% |
| 131+ | 50-55% |

**Accuracy Finale in Battaglia:**
```
accuracyFinal = accuracyBase * (1 + (PRC - 50) / 200)
// PRC 50 = nessun bonus
// PRC 80 = +15% accuracy
// PRC 20 = -15% accuracy
```

---

## GENERAZIONE MOSSE

### 7. Selezione 4 Mosse Innate
```
pool = D.movePool (copia)

if pool.length >= 4:
  // Fisher-Yates shuffle
  for i from pool.length - 1 downto 1:
    j = U_INT(0, i)
    swap(pool[i], pool[j])
  moves = pool.slice(0, 4)
  
else:
  // Pool troppo piccolo: ripeti ciclicamente
  moves = []
  for i from 0 to 3:
    moves.push(pool[i % pool.length])
```

### 8. Maestria Mosse (moveMastery)
```
Per ogni move in moves (nell'ordine selezionato):
  Z = U(-1, +1)
  mastery = 1 + 0.05 * b + sigmaMove * Z
  moveMastery[move.moveId] = round3(clamp(mastery, 0.85, 1.15))
```

---

## AFFINITÀ TIPO

### 9. Attitudine vs Tipo (aptitudeVsType)
```
types = ["FIRE", "WATER", "GRASS", "ELECTRIC", "ICE", "EARTH", "DARK", "LIGHT"]

Per ogni type in types (in questo ordine):
  Z = U(-1, +1)
  apt = 1 + 0.03 * b + sigmaType * Z
  aptitudeVsType[type] = round3(clamp(apt, 0.90, 1.10))
```

---

## CURVE DI CRESCITA / DECAY

### 9b. Coefficienti Crescita per Stat (growthRates)
Ogni creatura nasce con un coefficiente di crescita **indipendente** per ogni stat.
Il talento influenza la media, ma ogni stat varia in modo casuale.

```
// Coefficienti di crescita (0.5 = lento, 1.0 = medio, 1.5 = veloce)
baseGrowthRate = 0.8 + (talent / 100) * 0.4  // range [0.8, 1.2] basato su talento

growthRates = {}

// Stats fisiche e mentali (tranne INT)
physicalStats = ["STR", "AGI", "SPD", "REF", "END", "VIT", "PRC", "RGN"]

for stat in physicalStats:
  Z = U(-0.5, +0.5)  // variazione casuale per stat
  growthRates[stat] = round3(clamp(baseGrowthRate + Z, 0.3, 1.8))

// INT: SEMPRE crescita lentissima (fissa, non dipende da talento)
growthRates["INT"] = 0.15  // cresce fino a fine vita, ma molto lentamente
```

### 9c. Curve di Crescita/Decay per Level e Age
Le stats si calcolano **at runtime** usando i valori base, level, age e growthRates.

### TIME SCALING
**1 settimana reale = 1 mese creatura = 30 giorni creatura**

| Tempo Reale | Tempo Creatura |
|-------------|----------------|
| 1 giorno | ~4 giorni |
| 1 settimana | 1 mese (30 gg) |
| 1 mese | 4 mesi (120 gg) |
| 3 mesi | 1 anno (360 gg) → PEAK |
| 6 mesi | 2 anni (720 gg) → DECAY inizia |
| 1 anno | 4 anni |
| 2 anni | 8 anni → Anziano |

### LEVELING SYSTEM
**~6000 vittorie per raggiungere Level 50 (PEAK)**

#### XP per Battaglia
| Risultato | XP |
|-----------|-----|
| Vittoria | 100 XP |
| Sconfitta | 25 XP |

#### Formula XP per Level (Curva Logaritmica)
```
XP_per_level(n) = 14 * n²

Level 1→2:   14 XP   (~1 vittoria)
Level 5→6:   350 XP  (~4 vittorie)
Level 10→11: 1,400 XP (~14 vittorie)
Level 25→26: 8,750 XP (~88 vittorie)
Level 40→41: 22,400 XP (~224 vittorie)
Level 49→50: 34,300 XP (~343 vittorie)
```

#### XP Cumulativo per Livello
| Level | XP Totale | Vittorie Totali |
|-------|-----------|-----------------|
| 10 | 5,390 | ~54 |
| 20 | 40,180 | ~402 |
| 30 | 125,370 | ~1,254 |
| 40 | 280,840 | ~2,808 |
| **50** | **~600,000** | **~6,000** |

**Nota**: La maggior parte delle creature non raggiungerà mai L50. Un giocatore molto attivo (10 battaglie/giorno) impiegherebbe ~2 anni per raggiungere L50.

```
// COSTANTI
PEAK_LEVEL = 50            // livello di picco performance
MAX_LEVEL = 100            // livello massimo
PEAK_AGE_DAYS = 365        // età picco (1 anno)
DECAY_START_DAYS = 730     // inizio decay (2 anni)
STARTING_MULTIPLIER = 0.5  // creature nascono al 50% delle stats base

// Funzione: calcola stat attuale
function calcStat(baseStat, level, ageDays, growthRate, statName):
  
  // 1. CRESCITA PER LEVEL (da 50% a 150-200%)
  // L1: ~50% delle stats base
  // L50: 50% + 100-150% = 150-200% delle stats base
  if level <= PEAK_LEVEL:
    // Crescita rapida fino al picco
    levelMultiplier = STARTING_MULTIPLIER + (level / PEAK_LEVEL) * growthRate
    // Esempio L50 con growthRate 1.0: 0.5 + 1.0 = 1.5 (150%)
    // Esempio L50 con growthRate 1.5: 0.5 + 1.5 = 2.0 (200%)
  else:
    // Plateau/leggero declino dopo il picco
    peakMultiplier = STARTING_MULTIPLIER + growthRate
    overPeak = (level - PEAK_LEVEL) / (MAX_LEVEL - PEAK_LEVEL)
    levelMultiplier = peakMultiplier - overPeak * 0.15 * growthRate
  
  // 2. CRESCITA/DECAY PER ETÀ
  if ageDays <= PEAK_AGE_DAYS:
    // Giovane: ancora in crescita
    ageMultiplier = 0.9 + (ageDays / PEAK_AGE_DAYS) * 0.1
  else if ageDays <= DECAY_START_DAYS:
    // Prime: massime performance
    ageMultiplier = 1.0
  else:
    // Anziano: decay più veloce
    decayProgress = (ageDays - DECAY_START_DAYS) / 365  // anni dopo decay start
    ageMultiplier = max(0.5, 1.0 - decayProgress * 0.10)  // -10% per anno, min 50%
  
  // 3. CASO SPECIALE: INT
  // INT non ha decay e cresce SEMPRE (anche in vecchiaia)
  if statName == "INT":
    intGrowth = 1 + (ageDays / 1825) * 0.3  // +30% dopo 5 anni
    return round(baseStat * levelMultiplier * intGrowth)
  
  // 4. CALCOLO FINALE
  return round(baseStat * levelMultiplier * ageMultiplier)
```

**RIEPILOGO COMPORTAMENTO:**
| Stat | Crescita Level | Decay Age | Note |
|------|----------------|-----------|------|
| STR, AGI, SPD, REF, END, VIT | Bell curve | Sì | Picco ~50, decay dopo 2 anni |
| PRC, RGN | Bell curve | Sì | Stesse regole |
| INT | Lentissima sempre | **NO** | Cresce tutta la vita |

---

## CAMPI FINALI

### 10. ID Creatura
```
creatureId = "cre_" + SHA256(genSeed + "|id").substring(0, 16)
```

### 11. Campi Tempo
```
bornAt = nowIso
xp = 0
level = 1   // derivato runtime: floor(xp/100) + 1
```

---

## OUTPUT FORMAT
```json
[
  {
    "version": "v3",
    "creatureId": "cre_a1b2c3d4e5f67890",
    "ownerPlayerId": "player123",
    "creatureDefinitionId": "fire_dragon",
    "speciesName": "Fire Dragon",
    "elementType": "FIRE",
    "rarity": "RARE",
    "bornAt": "2026-01-22T10:00:00Z",
    "xp": 0,
    "talent": 68,
    "temperament": "FOCALIZZATO",
    "personality": { "id": "BRAVE", "statUp": "STR", "statDown": "SPD" },
    "attributes": {
      "STR": 72, "AGI": 58, "SPD": 61,
      "REF": 49, "END": 55, "VIT": 63,
      "INT": 42, "PRC": 51, "RGN": 38
    },
    "growthRates": {
      "STR": 1.12, "AGI": 0.87, "SPD": 1.05,
      "REF": 0.65, "END": 0.92, "VIT": 1.21,
      "INT": 0.15, "PRC": 0.78, "RGN": 1.08
    },
    "moves": ["fire_fang", "inferno", "flame_shield"],
    "moveMastery": {
      "fire_fang": 1.023,
      "inferno": 0.987,
      "flame_shield": 1.105
    },
    "aptitudeVsType": {
      "FIRE": 1.045,
      "WATER": 0.923,
      "GRASS": 1.067,
      "ELECTRIC": 0.991,
      "ICE": 1.012,
      "EARTH": 0.956,
      "DARK": 1.034,
      "LIGHT": 0.978
    },
    "genSeed": "a1b2c3d4..."
  }
]
```

---

## FUNZIONI HELPER
```
clamp(x, lo, hi) = min(hi, max(lo, x))
round3(x) = Math.round(x * 1000) / 1000
```
