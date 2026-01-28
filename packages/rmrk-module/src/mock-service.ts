/**
 * Mock RMRK Service
 *
 * In-memory implementation of RMRK NFT operations for development.
 * Replace with real RMRK SDK integration for production.
 */

import {
    UnitNftMetadata,
    EquipNftMetadata,
    UNIT_BY_ID,
    EQUIPMENT_BY_ID,
} from '@nft-autobattler/shared-types';
import {
    IRmrkService,
    IRmrkResourceService,
    IRmrkCreatureService,
    CreatureNftMetadata,
    MoveNftMetadata,
} from './interfaces.js';

// ============================================
// STORAGE TYPES
// ============================================

interface StoredCreatureNft {
    id: string;
    ownerId: string;
    metadata: CreatureNftMetadata;
    attachedMoveIds: string[];
}

interface StoredMoveNft {
    id: string;
    ownerId: string;
    metadata: MoveNftMetadata;
    attachedToCreatureId: string | null;
}

// Legacy types for backward compatibility
interface StoredNft {
    id: string;
    ownerId: string;
    type: 'unit' | 'equipment';
    metadata: UnitNftMetadata | EquipNftMetadata;
    children: string[];
    parentId: string | null;
}

interface StoredResource {
    resourceId: string;
    resourceUri: string;
    isActive: boolean;
}

// ============================================
// MOCK SERVICE IMPLEMENTATION
// ============================================

/**
 * Mock RMRK Service for development
 *
 * Implements both the new IRmrkCreatureService and legacy IRmrkService.
 * All data is stored in memory and lost on service restart.
 */
export class MockRmrkService implements IRmrkCreatureService, IRmrkService, IRmrkResourceService {
    // New creature/move storage
    private creatureNfts: Map<string, StoredCreatureNft> = new Map();
    private moveNfts: Map<string, StoredMoveNft> = new Map();

    // Legacy unit/equipment storage (deprecated)
    private nfts: Map<string, StoredNft> = new Map();
    private resources: Map<string, StoredResource[]> = new Map();

    private nftCounter = 0;

    private generateNftId(prefix: string = 'nft'): string {
        this.nftCounter++;
        return `${prefix}-${Date.now()}-${this.nftCounter}`;
    }

    // ========================================
    // NEW: Creature NFT Methods
    // ========================================

    async mintCreatureNft(ownerId: string, metadata: CreatureNftMetadata): Promise<string> {
        const nftId = this.generateNftId('creature');

        this.creatureNfts.set(nftId, {
            id: nftId,
            ownerId,
            metadata: { ...metadata },
            attachedMoveIds: [],
        });

        console.log(`[RMRK Mock] Minted creature NFT ${nftId} (${metadata.creatureDefinitionId}) for ${ownerId}`);
        return nftId;
    }

    async transferCreatureNft(nftId: string, newOwnerId: string): Promise<void> {
        const creature = this.creatureNfts.get(nftId);
        if (!creature) {
            throw new Error(`Creature NFT not found: ${nftId}`);
        }

        const oldOwnerId = creature.ownerId;
        creature.ownerId = newOwnerId;

        console.log(`[RMRK Mock] Transferred creature ${nftId} from ${oldOwnerId} to ${newOwnerId}`);
    }

    async getCreatureNft(nftId: string): Promise<CreatureNftMetadata | null> {
        const creature = this.creatureNfts.get(nftId);
        return creature ? { ...creature.metadata } : null;
    }

    async getPlayerCreatures(ownerId: string): Promise<string[]> {
        const creatures: string[] = [];
        for (const [id, nft] of this.creatureNfts) {
            if (nft.ownerId === ownerId) {
                creatures.push(id);
            }
        }
        return creatures;
    }

    async updateCreatureMetadata(nftId: string, data: Partial<CreatureNftMetadata>): Promise<void> {
        const creature = this.creatureNfts.get(nftId);
        if (!creature) {
            throw new Error(`Creature NFT not found: ${nftId}`);
        }

        creature.metadata = { ...creature.metadata, ...data };
        console.log(`[RMRK Mock] Updated creature ${nftId}:`, data);
    }

    async burnCreatureNft(nftId: string): Promise<void> {
        const creature = this.creatureNfts.get(nftId);
        if (!creature) {
            throw new Error(`Creature NFT not found: ${nftId}`);
        }

        // Detach all attached moves first
        for (const moveId of creature.attachedMoveIds) {
            const move = this.moveNfts.get(moveId);
            if (move) {
                move.attachedToCreatureId = null;
            }
        }

        this.creatureNfts.delete(nftId);
        console.log(`[RMRK Mock] Burned creature NFT ${nftId}`);
    }

    // ========================================
    // NEW: Move NFT Methods
    // ========================================

    async mintMoveNft(ownerId: string, metadata: MoveNftMetadata): Promise<string> {
        const nftId = this.generateNftId('move');

        this.moveNfts.set(nftId, {
            id: nftId,
            ownerId,
            metadata: { ...metadata },
            attachedToCreatureId: null,
        });

        console.log(`[RMRK Mock] Minted move NFT ${nftId} (${metadata.moveDefinitionId}) for ${ownerId}`);
        return nftId;
    }

    async transferMoveNft(nftId: string, newOwnerId: string): Promise<void> {
        const move = this.moveNfts.get(nftId);
        if (!move) {
            throw new Error(`Move NFT not found: ${nftId}`);
        }

        if (move.attachedToCreatureId) {
            throw new Error(`Cannot transfer move ${nftId} while attached to creature ${move.attachedToCreatureId}`);
        }

        const oldOwnerId = move.ownerId;
        move.ownerId = newOwnerId;

        console.log(`[RMRK Mock] Transferred move ${nftId} from ${oldOwnerId} to ${newOwnerId}`);
    }

    async getMoveNft(nftId: string): Promise<MoveNftMetadata | null> {
        const move = this.moveNfts.get(nftId);
        return move ? { ...move.metadata } : null;
    }

    async getPlayerMoves(ownerId: string): Promise<string[]> {
        const moves: string[] = [];
        for (const [id, nft] of this.moveNfts) {
            if (nft.ownerId === ownerId) {
                moves.push(id);
            }
        }
        return moves;
    }

    async burnMoveNft(nftId: string): Promise<void> {
        const move = this.moveNfts.get(nftId);
        if (!move) {
            throw new Error(`Move NFT not found: ${nftId}`);
        }

        // Detach from creature if attached
        if (move.attachedToCreatureId) {
            const creature = this.creatureNfts.get(move.attachedToCreatureId);
            if (creature) {
                creature.attachedMoveIds = creature.attachedMoveIds.filter(id => id !== nftId);
            }
        }

        this.moveNfts.delete(nftId);
        console.log(`[RMRK Mock] Burned move NFT ${nftId}`);
    }

    // ========================================
    // NEW: Move Teaching (Nesting)
    // ========================================

    async teachMove(creatureNftId: string, moveNftId: string): Promise<void> {
        const creature = this.creatureNfts.get(creatureNftId);
        if (!creature) {
            throw new Error(`Creature NFT not found: ${creatureNftId}`);
        }

        const move = this.moveNfts.get(moveNftId);
        if (!move) {
            throw new Error(`Move NFT not found: ${moveNftId}`);
        }

        if (move.attachedToCreatureId) {
            throw new Error(`Move ${moveNftId} is already attached to creature ${move.attachedToCreatureId}`);
        }

        if (creature.attachedMoveIds.length >= 4) {
            throw new Error(`Creature ${creatureNftId} already has maximum moves (4)`);
        }

        creature.attachedMoveIds.push(moveNftId);
        move.attachedToCreatureId = creatureNftId;

        console.log(`[RMRK Mock] Taught move ${moveNftId} to creature ${creatureNftId}`);
    }

    async forgetMove(creatureNftId: string, moveNftId: string): Promise<void> {
        const creature = this.creatureNfts.get(creatureNftId);
        if (!creature) {
            throw new Error(`Creature NFT not found: ${creatureNftId}`);
        }

        const move = this.moveNfts.get(moveNftId);
        if (!move) {
            throw new Error(`Move NFT not found: ${moveNftId}`);
        }

        if (move.attachedToCreatureId !== creatureNftId) {
            throw new Error(`Move ${moveNftId} is not attached to creature ${creatureNftId}`);
        }

        creature.attachedMoveIds = creature.attachedMoveIds.filter(id => id !== moveNftId);
        move.attachedToCreatureId = null;

        console.log(`[RMRK Mock] Forgot move ${moveNftId} from creature ${creatureNftId}`);
    }

    async getCreatureMoves(creatureNftId: string): Promise<string[]> {
        const creature = this.creatureNfts.get(creatureNftId);
        if (!creature) {
            throw new Error(`Creature NFT not found: ${creatureNftId}`);
        }
        return [...creature.attachedMoveIds];
    }

    // ========================================
    // DEPRECATED: Legacy Unit/Equipment Methods
    // ========================================

    /**
     * @deprecated Use mintCreatureNft instead
     */
    async mintUnitNFT(ownerId: string, unitDefinitionId: string): Promise<string> {
        const definition = UNIT_BY_ID[unitDefinitionId];
        if (!definition) {
            throw new Error(`Unknown unit definition: ${unitDefinitionId}`);
        }

        const nftId = this.generateNftId('unit');
        const metadata: UnitNftMetadata = {
            unitDefinitionId,
            level: 1,
            cosmeticSkinId: null,
            powerScore: this.calculatePowerScore(definition.baseHp, definition.baseAtk, definition.baseSpd),
        };

        this.nfts.set(nftId, {
            id: nftId,
            ownerId,
            type: 'unit',
            metadata,
            children: [],
            parentId: null,
        });

        this.resources.set(nftId, [
            {
                resourceId: 'default',
                resourceUri: `/sprites/${definition.spriteKey}.png`,
                isActive: true,
            },
        ]);

        console.log(`[RMRK Mock] [DEPRECATED] Minted unit NFT ${nftId} (${definition.name}) for ${ownerId}`);
        return nftId;
    }

    /**
     * @deprecated Equipment is no longer supported
     */
    async mintEquipNFT(ownerId: string, equipmentDefinitionId: string): Promise<string> {
        const definition = EQUIPMENT_BY_ID[equipmentDefinitionId];
        if (!definition) {
            throw new Error(`Unknown equipment definition: ${equipmentDefinitionId}`);
        }

        const nftId = this.generateNftId('equip');
        const metadata: EquipNftMetadata = {
            equipmentDefinitionId,
            rollSeed: null,
        };

        this.nfts.set(nftId, {
            id: nftId,
            ownerId,
            type: 'equipment',
            metadata,
            children: [],
            parentId: null,
        });

        console.log(`[RMRK Mock] [DEPRECATED] Minted equipment NFT ${nftId} (${definition.name}) for ${ownerId}`);
        return nftId;
    }

    /**
     * @deprecated Equipment is no longer supported
     */
    async attachEquipToUnit(unitNftId: string, equipNftId: string): Promise<void> {
        const unit = this.nfts.get(unitNftId);
        const equip = this.nfts.get(equipNftId);

        if (!unit || unit.type !== 'unit') {
            throw new Error(`Unit NFT not found: ${unitNftId}`);
        }
        if (!equip || equip.type !== 'equipment') {
            throw new Error(`Equipment NFT not found: ${equipNftId}`);
        }
        if (equip.parentId) {
            throw new Error(`Equipment ${equipNftId} is already attached to ${equip.parentId}`);
        }
        if (unit.children.length >= 2) {
            throw new Error(`Unit ${unitNftId} already has max equipment (2)`);
        }

        unit.children.push(equipNftId);
        equip.parentId = unitNftId;

        console.log(`[RMRK Mock] [DEPRECATED] Attached ${equipNftId} to ${unitNftId}`);
    }

    /**
     * @deprecated Equipment is no longer supported
     */
    async detachEquipFromUnit(unitNftId: string, equipNftId: string): Promise<void> {
        const unit = this.nfts.get(unitNftId);
        const equip = this.nfts.get(equipNftId);

        if (!unit || unit.type !== 'unit') {
            throw new Error(`Unit NFT not found: ${unitNftId}`);
        }
        if (!equip || equip.type !== 'equipment') {
            throw new Error(`Equipment NFT not found: ${equipNftId}`);
        }
        if (equip.parentId !== unitNftId) {
            throw new Error(`Equipment ${equipNftId} is not attached to ${unitNftId}`);
        }

        unit.children = unit.children.filter((id) => id !== equipNftId);
        equip.parentId = null;

        console.log(`[RMRK Mock] [DEPRECATED] Detached ${equipNftId} from ${unitNftId}`);
    }

    /**
     * @deprecated Use getCreatureNft instead
     */
    async getUnitMetadata(unitNftId: string): Promise<UnitNftMetadata> {
        const nft = this.nfts.get(unitNftId);
        if (!nft || nft.type !== 'unit') {
            throw new Error(`Unit NFT not found: ${unitNftId}`);
        }
        return nft.metadata as UnitNftMetadata;
    }

    /**
     * @deprecated Equipment is no longer supported
     */
    async getEquipMetadata(equipNftId: string): Promise<EquipNftMetadata> {
        const nft = this.nfts.get(equipNftId);
        if (!nft || nft.type !== 'equipment') {
            throw new Error(`Equipment NFT not found: ${equipNftId}`);
        }
        return nft.metadata as EquipNftMetadata;
    }

    /**
     * @deprecated Use updateCreatureMetadata instead
     */
    async updateUnitMetadata(unitNftId: string, data: Partial<UnitNftMetadata>): Promise<void> {
        const nft = this.nfts.get(unitNftId);
        if (!nft || nft.type !== 'unit') {
            throw new Error(`Unit NFT not found: ${unitNftId}`);
        }
        nft.metadata = { ...(nft.metadata as UnitNftMetadata), ...data };
        console.log(`[RMRK Mock] [DEPRECATED] Updated metadata for ${unitNftId}:`, data);
    }

    /**
     * @deprecated Use getPlayerCreatures and getPlayerMoves instead
     */
    async getPlayerNFTs(ownerId: string): Promise<{ units: string[]; equipment: string[] }> {
        const units: string[] = [];
        const equipment: string[] = [];

        for (const [id, nft] of this.nfts) {
            if (nft.ownerId === ownerId) {
                if (nft.type === 'unit') {
                    units.push(id);
                } else {
                    equipment.push(id);
                }
            }
        }

        return { units, equipment };
    }

    /**
     * @deprecated Use getCreatureMoves instead
     */
    async getUnitChildren(unitNftId: string): Promise<string[]> {
        const nft = this.nfts.get(unitNftId);
        if (!nft || nft.type !== 'unit') {
            throw new Error(`Unit NFT not found: ${unitNftId}`);
        }
        return [...nft.children];
    }

    /**
     * @deprecated Equipment is no longer supported
     */
    async getEquipParent(equipNftId: string): Promise<string | null> {
        const nft = this.nfts.get(equipNftId);
        if (!nft || nft.type !== 'equipment') {
            throw new Error(`Equipment NFT not found: ${equipNftId}`);
        }
        return nft.parentId;
    }

    /**
     * @deprecated Use transferCreatureNft or transferMoveNft instead
     */
    async transferNFT(nftId: string, fromOwnerId: string, toOwnerId: string): Promise<void> {
        const nft = this.nfts.get(nftId);
        if (!nft) {
            throw new Error(`NFT not found: ${nftId}`);
        }
        if (nft.ownerId !== fromOwnerId) {
            throw new Error(`NFT ${nftId} is not owned by ${fromOwnerId}`);
        }

        nft.ownerId = toOwnerId;
        console.log(`[RMRK Mock] [DEPRECATED] Transferred ${nftId} from ${fromOwnerId} to ${toOwnerId}`);
    }

    /**
     * @deprecated Use burnCreatureNft or burnMoveNft instead
     */
    async burnNFT(nftId: string): Promise<void> {
        const nft = this.nfts.get(nftId);
        if (!nft) {
            throw new Error(`NFT not found: ${nftId}`);
        }

        if (nft.parentId) {
            const parent = this.nfts.get(nft.parentId);
            if (parent) {
                parent.children = parent.children.filter((id) => id !== nftId);
            }
        }

        for (const childId of nft.children) {
            this.nfts.delete(childId);
        }

        this.nfts.delete(nftId);
        this.resources.delete(nftId);
        console.log(`[RMRK Mock] [DEPRECATED] Burned NFT ${nftId}`);
    }

    // ========================================
    // DEPRECATED: Multi-resource Methods
    // ========================================

    async addResource(unitNftId: string, resourceId: string, resourceUri: string): Promise<void> {
        const nft = this.nfts.get(unitNftId);
        if (!nft || nft.type !== 'unit') {
            throw new Error(`Unit NFT not found: ${unitNftId}`);
        }

        const resources = this.resources.get(unitNftId) || [];
        if (resources.some((r) => r.resourceId === resourceId)) {
            throw new Error(`Resource ${resourceId} already exists for ${unitNftId}`);
        }

        resources.push({
            resourceId,
            resourceUri,
            isActive: false,
        });
        this.resources.set(unitNftId, resources);
        console.log(`[RMRK Mock] Added resource ${resourceId} to ${unitNftId}`);
    }

    async setActiveResource(unitNftId: string, resourceId: string): Promise<void> {
        const resources = this.resources.get(unitNftId);
        if (!resources) {
            throw new Error(`No resources for ${unitNftId}`);
        }

        const resource = resources.find((r) => r.resourceId === resourceId);
        if (!resource) {
            throw new Error(`Resource ${resourceId} not found for ${unitNftId}`);
        }

        for (const r of resources) {
            r.isActive = r.resourceId === resourceId;
        }
        console.log(`[RMRK Mock] Set active resource ${resourceId} for ${unitNftId}`);
    }

    async getResources(unitNftId: string): Promise<StoredResource[]> {
        return this.resources.get(unitNftId) || [];
    }

    // ========================================
    // Utility Methods
    // ========================================

    private calculatePowerScore(hp: number, atk: number, spd: number): number {
        return Math.round(hp * 0.5 + atk * 2 + spd * 1.5);
    }

    /**
     * Clear all NFT data (for testing)
     */
    clear(): void {
        this.creatureNfts.clear();
        this.moveNfts.clear();
        this.nfts.clear();
        this.resources.clear();
        this.nftCounter = 0;
        console.log('[RMRK Mock] Cleared all data');
    }

    /**
     * Get storage statistics (for debugging)
     */
    getStats(): {
        creatures: number;
        moves: number;
        legacyUnits: number;
        legacyEquipment: number;
    } {
        let legacyUnits = 0;
        let legacyEquipment = 0;
        for (const nft of this.nfts.values()) {
            if (nft.type === 'unit') legacyUnits++;
            else legacyEquipment++;
        }
        return {
            creatures: this.creatureNfts.size,
            moves: this.moveNfts.size,
            legacyUnits,
            legacyEquipment,
        };
    }
}

// Singleton instance for convenience
export const mockRmrkService = new MockRmrkService();
