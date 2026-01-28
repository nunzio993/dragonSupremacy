/**
 * Creature Fetcher Service
 * Fetches creature data from the RMRKCreature contract for battles
 */

import { ethers } from 'ethers';
import { BattleCreature, Move, ElementType } from '../battle/types.js';

// Element type mapping: contract uses uint8, we use string
const ELEMENT_ID_TO_NAME: Record<number, ElementType> = {
    0: 'FIRE',
    1: 'WATER',
    2: 'GRASS',
    3: 'ELECTRIC',
    4: 'ICE',
    5: 'EARTH',
    6: 'DARK',
    7: 'LIGHT'
};

// Status effect mapping
const STATUS_ID_TO_NAME: Record<number, string> = {
    0: 'NONE',
    1: 'BURN',
    2: 'FREEZE',
    3: 'POISON',
    4: 'PARALYZE',
    5: 'STUN',
    6: 'BLIND',
    7: 'FEAR'
};

// Category mapping
const CATEGORY_ID_TO_NAME: Record<number, 'PHYSICAL' | 'SPECIAL' | 'STATUS'> = {
    0: 'PHYSICAL',
    1: 'SPECIAL',
    2: 'STATUS'
};

// Move names database (basic for now, can be expanded)
const MOVE_NAMES: Record<number, string> = {
    // Fire moves
    1: 'Ember', 2: 'Flamethrower', 3: 'Inferno', 4: 'Fire Fang', 5: 'Fire Blast', 6: 'Will-O-Wisp',
    // Water moves
    11: 'Water Gun', 12: 'Aqua Jet', 13: 'Hydro Pump', 14: 'Surf', 15: 'Scald', 16: 'Rain Dance',
    // Grass moves
    21: 'Vine Whip', 22: 'Razor Leaf', 23: 'Solar Beam', 24: 'Leaf Blade', 25: 'Giga Drain', 26: 'Spore',
    // Electric moves
    31: 'Thunder Shock', 32: 'Thunderbolt', 33: 'Thunder', 34: 'Volt Tackle', 35: 'Spark', 36: 'Thunder Wave',
    // Ice moves
    41: 'Ice Shard', 42: 'Ice Beam', 43: 'Blizzard', 44: 'Ice Fang', 45: 'Freeze-Dry', 46: 'Haze',
    // Earth moves  
    51: 'Mud Shot', 52: 'Earthquake', 53: 'Earth Power', 54: 'Rock Slide', 55: 'Stone Edge', 56: 'Stealth Rock',
    // Dark moves
    61: 'Bite', 62: 'Dark Pulse', 63: 'Night Slash', 64: 'Crunch', 65: 'Shadow Ball', 66: 'Nasty Plot',
    // Light moves
    71: 'Flash', 72: 'Dazzling Gleam', 73: 'Moonblast', 74: 'Play Rough', 75: 'Radiant Beam', 76: 'Calm Mind',
    // Neutral moves
    101: 'Tackle', 102: 'Body Slam', 103: 'Hyper Beam', 104: 'Quick Attack', 105: 'Slash', 106: 'Protect'
};

// ABI for creature fetch functions
const CREATURE_ABI = [
    // getCoreData
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'coreData',
        outputs: [
            { name: 'genSeed', type: 'bytes32' },
            { name: 'personality', type: 'bytes32' },
            { name: 'elementType', type: 'bytes32' },
            { name: 'temperament', type: 'bytes32' },
            { name: 'bornAt', type: 'uint48' },
            { name: 'talent', type: 'uint8' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    // getLiveStats
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getLiveStats',
        outputs: [
            { name: 'stats', type: 'uint8[9]' },
            { name: 'level', type: 'uint16' },
            { name: 'ageDays', type: 'uint16' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    // getMoves
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getMoves',
        outputs: [
            {
                name: 'moves',
                type: 'tuple[4]',
                components: [
                    { name: 'moveId', type: 'uint8' },
                    { name: 'moveType', type: 'uint8' },
                    { name: 'category', type: 'uint8' },
                    { name: 'power', type: 'uint8' },
                    { name: 'accuracy', type: 'uint8' },
                    { name: 'cooldownMax', type: 'uint8' },
                    { name: 'statusEffect', type: 'uint8' },
                    { name: 'statusChance', type: 'uint8' }
                ]
            },
            { name: 'moveCount', type: 'uint8' },
            { name: 'mastery', type: 'uint8[4]' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    // ownerOf
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ name: 'owner', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
    }
] as const;

// HPManager contract ABI
const HP_MANAGER_ABI = [
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getHP',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'hp', type: 'uint256' }
        ],
        name: 'setHP',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    }
] as const;

// Contract configuration
const CONTRACT_ADDRESS = process.env.RMRK_CREATURE_ADDRESS || '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0';
const HP_MANAGER_ADDRESS = process.env.HP_MANAGER_ADDRESS || '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9';
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// Convert bytes32 to string
function bytes32ToString(bytes32: string): string {
    const hex = bytes32.slice(2);
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        if (code === 0) break;
        str += String.fromCharCode(code);
    }
    return str;
}

class CreatureFetcher {
    private provider: ethers.JsonRpcProvider;
    private contract: ethers.Contract;
    private wallet: ethers.Wallet;
    private hpManagerContract: ethers.Contract | null = null;
    private hpManagerWriteContract: ethers.Contract | null = null;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.contract = new ethers.Contract(CONTRACT_ADDRESS, CREATURE_ABI, this.provider);

        // Wallet for write operations (setHP) - uses deployer account which is hpUpdater
        const SIGNER_KEY = process.env.HP_SIGNER_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        this.wallet = new ethers.Wallet(SIGNER_KEY, this.provider);

        // HPManager contracts (will be set when address is available)
        if (HP_MANAGER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
            this.hpManagerContract = new ethers.Contract(HP_MANAGER_ADDRESS, HP_MANAGER_ABI, this.provider);
            this.hpManagerWriteContract = new ethers.Contract(HP_MANAGER_ADDRESS, HP_MANAGER_ABI, this.wallet);
            console.log(`[CreatureFetcher] HPManager configured at ${HP_MANAGER_ADDRESS}`);
        } else {
            console.log(`[CreatureFetcher] HPManager not configured - HP will default to 100%`);
        }
    }

    /**
     * Set HP on-chain after battle (uses HPManager)
     * @param tokenId Creature token ID
     * @param hpPercent HP percentage (0-100)
     */
    async setHP(tokenId: string, hpPercent: number): Promise<boolean> {
        if (!this.hpManagerWriteContract) {
            console.log(`[CreatureFetcher] HPManager not configured, skipping HP update`);
            return false;
        }

        try {
            const clampedHP = Math.max(0, Math.min(100, Math.round(hpPercent)));
            console.log(`[CreatureFetcher] Setting HP of #${tokenId} to ${clampedHP}%`);

            const tx = await this.hpManagerWriteContract.setHP(BigInt(tokenId), BigInt(clampedHP));
            await tx.wait();

            console.log(`[CreatureFetcher] HP set successfully for #${tokenId}`);
            return true;
        } catch (error: any) {
            console.error(`[CreatureFetcher] Error setting HP for #${tokenId}:`, error.message);
            return false;
        }
    }

    /**
     * Fetch a creature from the contract and convert to BattleCreature format
     */
    async fetchCreature(tokenId: string, ownerId: string): Promise<BattleCreature | null> {
        try {
            console.log(`[CreatureFetcher] Fetching creature #${tokenId}...`);

            // Fetch all data in parallel
            const [coreData, liveStats, movesData] = await Promise.all([
                this.contract.coreData(BigInt(tokenId)),
                this.contract.getLiveStats(BigInt(tokenId)),
                this.contract.getMoves(BigInt(tokenId))
            ]);

            // Fetch HP from HPManager (separate call, defaults to 100 if not configured)
            let onChainHP = BigInt(100);
            if (this.hpManagerContract) {
                try {
                    onChainHP = await this.hpManagerContract.getHP(BigInt(tokenId));
                } catch {
                    onChainHP = BigInt(100); // Default 100 if not set
                }
            }

            // Parse element type from bytes32
            const elementType = bytes32ToString(coreData.elementType) as ElementType;
            const temperament = bytes32ToString(coreData.temperament);
            const talent = Number(coreData.talent);

            // Parse live stats
            const stats = liveStats.stats;
            const attributes = {
                STR: Number(stats[0]),
                AGI: Number(stats[1]),
                SPD: Number(stats[2]),
                REF: Number(stats[3]),
                END: Number(stats[4]),
                VIT: Number(stats[5]),
                INT: Number(stats[6]),
                PRC: Number(stats[7]),
                RGN: Number(stats[8])
            };

            // Parse moves
            const moveCount = Number(movesData.moveCount);
            const mastery = movesData.mastery;
            const moves: Move[] = [];
            const moveMastery: Record<string, number> = {};

            for (let i = 0; i < moveCount; i++) {
                const rawMove = movesData.moves[i];
                const moveId = Number(rawMove.moveId);

                if (moveId === 0) continue; // Empty slot

                const moveType = ELEMENT_ID_TO_NAME[Number(rawMove.moveType)] || 'EARTH';
                const category = CATEGORY_ID_TO_NAME[Number(rawMove.category)] || 'PHYSICAL';
                const statusEffectId = Number(rawMove.statusEffect);
                const statusEffect = statusEffectId > 0 ? STATUS_ID_TO_NAME[statusEffectId] : undefined;
                const statusChance = Number(rawMove.statusChance) / 100; // Convert from 0-100 to 0-1
                const masteryValue = (85 + Number(mastery[i])) / 100; // Convert from 0-30 to 0.85-1.15

                const move: Move = {
                    moveId: `move_${moveId}`,
                    name: MOVE_NAMES[moveId] || `Move #${moveId}`,
                    type: moveType,
                    category,
                    power: Number(rawMove.power),
                    accuracy: Number(rawMove.accuracy),
                    cooldownMax: Number(rawMove.cooldownMax),
                    priority: 0, // Default priority
                    statusEffect: statusEffect as any,
                    statusChance
                };

                moves.push(move);
                moveMastery[move.moveId] = masteryValue;
            }

            // Calculate HP from VIT stat and on-chain HP percentage
            const maxHp = attributes.VIT * 20; // VIT * 20 = max HP (matches battle engine)
            const hpPercent = Number(onChainHP); // 0-100
            const currentHp = Math.round((maxHp * hpPercent) / 100);

            // Build BattleCreature
            const creature: BattleCreature = {
                id: tokenId,
                name: `${elementType} Dragon #${tokenId}`,
                ownerId,
                elementType,
                talent,
                temperament: temperament as any,
                attributes,
                moves,
                moveMastery,
                aptitudeVsType: {
                    FIRE: 1.0, WATER: 1.0, GRASS: 1.0, ELECTRIC: 1.0,
                    ICE: 1.0, EARTH: 1.0, DARK: 1.0, LIGHT: 1.0
                },
                currentHp,
                maxHp,
                cooldowns: {},
                statusEffects: []
            };

            console.log(`[CreatureFetcher] Fetched ${creature.name} with ${moves.length} moves`);
            return creature;

        } catch (error) {
            console.error(`[CreatureFetcher] Error fetching creature #${tokenId}:`, error);
            return null;
        }
    }

    /**
     * Check if a creature exists and is owned by the specified address
     */
    async verifyOwnership(tokenId: string, ownerAddress: string): Promise<boolean> {
        try {
            const owner = await this.contract.ownerOf(BigInt(tokenId));
            return owner.toLowerCase() === ownerAddress.toLowerCase();
        } catch {
            return false;
        }
    }
}

// Singleton instance
export const creatureFetcher = new CreatureFetcher();

export default CreatureFetcher;
