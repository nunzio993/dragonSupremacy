/**
 * RMRK Module Interfaces
 *
 * Defines NFT types and service interfaces for the game.
 * Implementations can be:
 * - MockRmrkService: In-memory mock for development
 * - RmrkService: Real RMRK SDK integration for production
 */

import { ElementType } from '@nft-autobattler/shared-types';

// ============================================
// NEW: CREATURE AND MOVE NFT TYPES
// ============================================

/**
 * Metadata for a Creature NFT
 * Represents a unique creature instance with IVs (individual values)
 */
export interface CreatureNftMetadata {
    creatureDefinitionId: string;
    level: number;
    /** Individual Value for HP (0-31) */
    ivHp: number;
    /** Individual Value for Attack (0-31) */
    ivAtk: number;
    /** Individual Value for Defense (0-31) */
    ivDef: number;
    /** Individual Value for Speed (0-31) */
    ivSpd: number;
    elementType: ElementType;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    /** IDs of moves this creature can learn */
    movePoolIds: string[];
}

/**
 * Metadata for a Move NFT
 * Represents a learnable move that can be attached to creatures
 */
export interface MoveNftMetadata {
    moveDefinitionId: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

// ============================================
// NEW: CREATURE/MOVE NFT SERVICE INTERFACE
// ============================================

/**
 * RMRK Service Interface for Creature and Move NFTs
 *
 * This is the primary interface for the Pokémon-style game.
 */
export interface IRmrkCreatureService {
    // ---------------------------
    // Creature NFTs
    // ---------------------------

    /**
     * Mint a new creature NFT for a player
     * @param ownerId - Player account ID
     * @param metadata - Creature metadata including stats and element
     * @returns The minted NFT ID
     */
    mintCreatureNft(ownerId: string, metadata: CreatureNftMetadata): Promise<string>;

    /**
     * Transfer a creature NFT to a new owner
     * @param nftId - Creature NFT ID
     * @param newOwnerId - New owner account ID
     */
    transferCreatureNft(nftId: string, newOwnerId: string): Promise<void>;

    /**
     * Get metadata for a creature NFT
     * @param nftId - Creature NFT ID
     * @returns Creature metadata or null if not found
     */
    getCreatureNft(nftId: string): Promise<CreatureNftMetadata | null>;

    /**
     * Get all creature NFTs owned by a player
     * @param ownerId - Player account ID
     * @returns Array of creature NFT IDs
     */
    getPlayerCreatures(ownerId: string): Promise<string[]>;

    /**
     * Update creature NFT metadata (e.g., level up)
     * @param nftId - Creature NFT ID
     * @param data - Partial metadata to update
     */
    updateCreatureMetadata(nftId: string, data: Partial<CreatureNftMetadata>): Promise<void>;

    /**
     * Burn (destroy) a creature NFT
     * @param nftId - Creature NFT ID
     */
    burnCreatureNft(nftId: string): Promise<void>;

    // ---------------------------
    // Move NFTs
    // ---------------------------

    /**
     * Mint a new move NFT for a player
     * @param ownerId - Player account ID
     * @param metadata - Move metadata
     * @returns The minted NFT ID
     */
    mintMoveNft(ownerId: string, metadata: MoveNftMetadata): Promise<string>;

    /**
     * Transfer a move NFT to a new owner
     * @param nftId - Move NFT ID
     * @param newOwnerId - New owner account ID
     */
    transferMoveNft(nftId: string, newOwnerId: string): Promise<void>;

    /**
     * Get metadata for a move NFT
     * @param nftId - Move NFT ID
     * @returns Move metadata or null if not found
     */
    getMoveNft(nftId: string): Promise<MoveNftMetadata | null>;

    /**
     * Get all move NFTs owned by a player
     * @param ownerId - Player account ID
     * @returns Array of move NFT IDs
     */
    getPlayerMoves(ownerId: string): Promise<string[]>;

    /**
     * Burn (destroy) a move NFT
     * @param nftId - Move NFT ID
     */
    burnMoveNft(nftId: string): Promise<void>;

    // ---------------------------
    // Move Teaching (Nesting)
    // ---------------------------

    /**
     * Attach a move NFT to a creature (teach move)
     * @param creatureNftId - Creature NFT ID
     * @param moveNftId - Move NFT ID to attach
     */
    teachMove(creatureNftId: string, moveNftId: string): Promise<void>;

    /**
     * Detach a move NFT from a creature (forget move)
     * @param creatureNftId - Creature NFT ID
     * @param moveNftId - Move NFT ID to detach
     */
    forgetMove(creatureNftId: string, moveNftId: string): Promise<void>;

    /**
     * Get all moves attached to a creature
     * @param creatureNftId - Creature NFT ID
     * @returns Array of move NFT IDs
     */
    getCreatureMoves(creatureNftId: string): Promise<string[]>;
}

// ============================================
// DEPRECATED: OLD UNIT/EQUIPMENT TYPES
// ============================================

// These types are kept for backward compatibility with the old autobattler system.
// They will be removed in a future version.

import { UnitNftMetadata, EquipNftMetadata } from '@nft-autobattler/shared-types';

/**
 * @deprecated Use IRmrkCreatureService instead
 * Legacy RMRK Service Interface for Unit/Equipment NFTs
 */
export interface IRmrkService {
    /**
     * @deprecated Use mintCreatureNft instead
     */
    mintUnitNFT(ownerId: string, unitDefinitionId: string): Promise<string>;

    /**
     * @deprecated Equipment is no longer supported
     */
    mintEquipNFT(ownerId: string, equipmentDefinitionId: string): Promise<string>;

    /**
     * @deprecated Equipment is no longer supported
     */
    attachEquipToUnit(unitNftId: string, equipNftId: string): Promise<void>;

    /**
     * @deprecated Equipment is no longer supported
     */
    detachEquipFromUnit(unitNftId: string, equipNftId: string): Promise<void>;

    /**
     * @deprecated Use getCreatureNft instead
     */
    getUnitMetadata(unitNftId: string): Promise<UnitNftMetadata>;

    /**
     * @deprecated Equipment is no longer supported
     */
    getEquipMetadata(equipNftId: string): Promise<EquipNftMetadata>;

    /**
     * @deprecated Use updateCreatureMetadata instead
     */
    updateUnitMetadata(unitNftId: string, data: Partial<UnitNftMetadata>): Promise<void>;

    /**
     * @deprecated Use getPlayerCreatures and getPlayerMoves instead
     */
    getPlayerNFTs(ownerId: string): Promise<{
        units: string[];
        equipment: string[];
    }>;

    /**
     * @deprecated Equipment is no longer supported
     */
    getUnitChildren(unitNftId: string): Promise<string[]>;

    /**
     * @deprecated Equipment is no longer supported
     */
    getEquipParent(equipNftId: string): Promise<string | null>;

    /**
     * @deprecated Use transferCreatureNft or transferMoveNft instead
     */
    transferNFT(nftId: string, fromOwnerId: string, toOwnerId: string): Promise<void>;

    /**
     * @deprecated Use burnCreatureNft or burnMoveNft instead
     */
    burnNFT(nftId: string): Promise<void>;
}

/**
 * @deprecated Multi-resource support for skins
 * May be re-added for creature cosmetics in the future
 */
export interface IRmrkResourceService {
    addResource(unitNftId: string, resourceId: string, resourceUri: string): Promise<void>;
    setActiveResource(unitNftId: string, resourceId: string): Promise<void>;
    getResources(unitNftId: string): Promise<Array<{
        resourceId: string;
        resourceUri: string;
        isActive: boolean;
    }>>;
}
