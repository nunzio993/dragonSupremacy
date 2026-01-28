# RMRK Integration

## Overview

This document describes how game entities map to RMRK NFTs.

RMRK is a set of NFT standards on Kusama that supports:
- **Nested NFTs**: NFTs that can contain other NFTs
- **Multi-Resource**: Multiple "views" of the same NFT
- **Conditional Rendering**: Display based on context

---

## NFT Structure

### Unit NFT (Parent)

```
Unit NFT
├── Metadata
│   ├── unitDefinitionId: "u01"
│   ├── level: 1
│   ├── cosmeticSkinId: null
│   └── powerScore: 76
├── Resources
│   ├── default: /sprites/unit_iron_guard.png
│   └── skin_gold: /sprites/unit_iron_guard_gold.png (optional)
└── Children (Equipment NFTs)
    ├── Equipment NFT #1
    └── Equipment NFT #2
```

### Equipment NFT (Child)

```
Equipment NFT
├── Metadata
│   ├── equipmentDefinitionId: "e01"
│   └── rollSeed: null (for future random stats)
└── Parent: Unit NFT (when equipped)
```

---

## Operations

### Mint Unit

```typescript
const rmrk = new MockRmrkService();

// Player gains a new unit
const nftId = await rmrk.mintUnitNFT(playerId, 'u01');
// Returns: "nft-1705770000-1"

// NFT metadata:
{
  unitDefinitionId: 'u01',
  level: 1,
  cosmeticSkinId: null,
  powerScore: 76  // Calculated from stats
}
```

### Mint Equipment

```typescript
const equipNftId = await rmrk.mintEquipNFT(playerId, 'e01');
// Returns: "nft-1705770000-2"
```

### Equip (Nest)

```typescript
// Attach equipment to unit (nesting)
await rmrk.attachEquipToUnit(unitNftId, equipNftId);

// Equipment NFT is now a child of Unit NFT
// Unit NFT now has children: [equipNftId]
```

### Unequip (Unnest)

```typescript
// Detach equipment from unit
await rmrk.detachEquipFromUnit(unitNftId, equipNftId);

// Equipment NFT has no parent
// Unit NFT has empty children
```

### Update Cosmetics

```typescript
// Add a new skin resource
await rmrk.addResource(unitNftId, 'skin_gold', '/sprites/unit_iron_guard_gold.png');

// Set it as active
await rmrk.setActiveResource(unitNftId, 'skin_gold');

// Update metadata to track active skin
await rmrk.updateUnitMetadata(unitNftId, { cosmeticSkinId: 'skin_gold' });
```

---

## Interface Definition

```typescript
interface IRmrkService {
  // Minting
  mintUnitNFT(ownerId: string, unitDefId: string): Promise<string>;
  mintEquipNFT(ownerId: string, equipDefId: string): Promise<string>;

  // Nesting (equip/unequip)
  attachEquipToUnit(unitNftId: string, equipNftId: string): Promise<void>;
  detachEquipFromUnit(unitNftId: string, equipNftId: string): Promise<void>;

  // Metadata
  getUnitMetadata(unitNftId: string): Promise<UnitNftMetadata>;
  getEquipMetadata(equipNftId: string): Promise<EquipNftMetadata>;
  updateUnitMetadata(unitNftId: string, data: Partial<UnitNftMetadata>): Promise<void>;

  // Ownership
  getPlayerNFTs(ownerId: string): Promise<{ units: string[]; equipment: string[] }>;
  getUnitChildren(unitNftId: string): Promise<string[]>;
  getEquipParent(equipNftId: string): Promise<string | null>;
  transferNFT(nftId: string, from: string, to: string): Promise<void>;
  burnNFT(nftId: string): Promise<void>;
}

interface IRmrkResourceService {
  addResource(unitNftId: string, resourceId: string, uri: string): Promise<void>;
  setActiveResource(unitNftId: string, resourceId: string): Promise<void>;
  getResources(unitNftId: string): Promise<ResourceInfo[]>;
}
```

---

## Current Implementation

### MockRmrkService

For v1 development, we use an in-memory mock:

```typescript
import { MockRmrkService, mockRmrkService } from '@nft-autobattler/rmrk-module';

// Singleton instance
mockRmrkService.mintUnitNFT(playerId, 'u01');

// Or create new instance
const rmrk = new MockRmrkService();
```

Features:
- All operations work in memory
- Console logging for debugging
- Helper methods for testing (`clear()`, `getStats()`)

### Real RMRK Integration (Future)

To connect to actual RMRK:

1. Install RMRK SDK
2. Implement `IRmrkService` interface with real blockchain calls
3. Replace `MockRmrkService` with real implementation
4. No changes needed in rest of codebase

```typescript
// Example future implementation
class RealRmrkService implements IRmrkService {
  private sdk: RmrkSdk;

  async mintUnitNFT(ownerId: string, unitDefId: string): Promise<string> {
    const result = await this.sdk.mint({
      collection: UNITS_COLLECTION_ID,
      metadata: { unitDefinitionId: unitDefId, ... },
      owner: ownerId,
    });
    return result.nftId;
  }
  // ... other methods
}
```

---

## Data Flow

### Create Account

```
1. Backend creates guest account
2. Backend calls rmrk.mintUnitNFT() for starter units
3. Backend calls rmrk.mintEquipNFT() for starter equipment
4. NFT IDs stored in database (player_units.rmrk_nft_id)
```

### Equip Item

```
1. Frontend calls POST /roster/equip
2. Backend validates ownership
3. Backend calls rmrk.attachEquipToUnit()
4. Backend updates player_equipment.equipped_on_unit_id
```

### Battle

```
1. Backend fetches player roster from DB
2. NFT equipment relationships determine unit loadouts
3. Game engine simulates battle
4. Results stored, XP awarded
5. (Future: Match result could be recorded on-chain)
```

---

## Benefits of RMRK

1. **True Ownership**: Players own their units/equipment
2. **Composability**: Equipment nested on units is visible to other apps
3. **Transferability**: Users can trade units on marketplaces
4. **Provenance**: Full history of unit ownership and changes
5. **Multi-Resource**: Same unit can have multiple skins/views
