import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { CONTRACTS, RMRK_CREATURE_ABI, STAT_NAMES } from '../contracts/config';

// Generate random bytes32 seed
export function generateSeed(): `0x${string}` {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

// ============ Types ============

export interface CreatureStats {
    STR: number;
    AGI: number;
    SPD: number;
    REF: number;
    END: number;
    VIT: number;
    INT: number;
    PRC: number;
    RGN: number;
}

// Move info from contract
export interface MoveInfo {
    moveId: number;
    name: string;
    type: string;  // Element type
    category: 'PHYSICAL' | 'SPECIAL' | 'STATUS';
    power: number;
    accuracy: number;
    cooldownMax: number;
    statusEffect?: string;
    statusChance: number;
    mastery: number;  // 0.85-1.15
}

export interface CreatureInfo {
    tokenId: bigint;
    genSeed: `0x${string}`;
    talent: number;
    personality: string;
    elementType: string;
    temperament: string;
    bornAt: bigint;
    xp: bigint;
    level: number;
    ageDays: number;
    stats: CreatureStats;
    moves: MoveInfo[];
    // HP from HPManager
    currentHp: number;
    maxHp: number;
}

// ============ Helpers ============

function bytes32ToString(bytes32: string): string {
    // Remove trailing null bytes and convert hex to string
    const hex = bytes32.slice(2);
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        if (byte === 0) break;
        str += String.fromCharCode(byte);
    }
    return str;
}

// ============ Creature Generation Logic ============

const PERSONALITIES = [
    { id: 'BRAVE', statUp: 'STR', statDown: 'SPD' },
    { id: 'CALM', statUp: 'INT', statDown: 'STR' },
    { id: 'BOLD', statUp: 'END', statDown: 'REF' },
    { id: 'TIMID', statUp: 'SPD', statDown: 'STR' },
    { id: 'MODEST', statUp: 'AGI', statDown: 'STR' },
    { id: 'ADAMANT', statUp: 'STR', statDown: 'AGI' },
    { id: 'IMPISH', statUp: 'END', statDown: 'AGI' },
    { id: 'JOLLY', statUp: 'SPD', statDown: 'AGI' },
    { id: 'NAIVE', statUp: 'SPD', statDown: 'END' },
    { id: 'CAREFUL', statUp: 'END', statDown: 'INT' },
    { id: 'NEUTRAL', statUp: null, statDown: null },
] as const;

const TEMPERAMENTS = ['CALM', 'FOCUSED', 'NEUTRAL', 'NERVOUS', 'RECKLESS'] as const;

const ELEMENT_MOVES: Record<string, string[]> = {
    FIRE: ['fire_fang', 'inferno', 'flame_shield', 'ember', 'fire_blast'],
    WATER: ['water_gun', 'aqua_jet', 'hydro_pump', 'bubble', 'surf'],
    GRASS: ['vine_whip', 'razor_leaf', 'solar_beam', 'leech_seed', 'grass_knot'],
    ELECTRIC: ['thunderbolt', 'spark', 'thunder_wave', 'discharge', 'volt_tackle'],
    ICE: ['ice_beam', 'blizzard', 'frost_breath', 'ice_shard', 'avalanche'],
    EARTH: ['earthquake', 'rock_slide', 'mud_shot', 'stone_edge', 'dig'],
    DARK: ['dark_pulse', 'shadow_ball', 'night_slash', 'crunch', 'foul_play'],
    LIGHT: ['flash', 'dazzle', 'holy_light', 'radiant_beam', 'purify'],
};

// Seeded RNG (xorshift32)
class SeededRNG {
    private state: number;

    constructor(seed: string) {
        this.state = this.hashString(seed);
        if (this.state === 0) this.state = 1;
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) || 1;
    }

    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return (this.state / 0xFFFFFFFF);
    }

    pick<T>(arr: readonly T[]): T {
        return arr[Math.floor(this.next() * arr.length)];
    }

    float(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

// Generate creature data from seed
function generateCreatureFromSeed(genSeed: string, elementType: string) {
    const rng = new SeededRNG(genSeed);

    // 1. Talent (1-100, normal distribution centered at 50)
    const u1 = Math.max(0.0001, rng.next());
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const talent = Math.max(1, Math.min(100, Math.round(50 + z * 15)));

    // 2. Temperament
    const temperament = rng.pick(TEMPERAMENTS);

    // 3. Personality
    const personality = rng.pick(PERSONALITIES);

    // 4. Base attributes (30-80)
    const b = (talent - 50) / 50;
    const sigmaAttr = 0.15;
    const stats: number[] = [];

    for (let i = 0; i < 9; i++) {
        const Z = rng.float(-1, 1);
        let value = 50 + 15 * b + 20 * sigmaAttr * Z;
        value = Math.max(30, Math.min(80, Math.round(value)));
        stats.push(value);
    }

    // Apply personality modifiers
    if (personality.statUp && personality.statDown) {
        const statNames = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT', 'INT', 'PRC', 'RGN'];
        const upIdx = statNames.indexOf(personality.statUp);
        const downIdx = statNames.indexOf(personality.statDown);
        if (upIdx >= 0) stats[upIdx] = Math.round(stats[upIdx] * 1.1);
        if (downIdx >= 0) stats[downIdx] = Math.round(stats[downIdx] * 0.9);
    }

    // 5. Growth rates (300-1800, INT always 150)
    const baseGrowthRate = 700 + 600 * ((talent - 50) / 50);
    const growthRates: number[] = [];

    for (let i = 0; i < 9; i++) {
        if (i === 6) { // INT
            growthRates.push(150);
        } else {
            const Z = rng.float(-0.5, 0.5);
            const rate = Math.max(300, Math.min(1800, Math.round(baseGrowthRate + Z * 300)));
            growthRates.push(rate);
        }
    }

    // 6. Moves (4 from element pool)
    const movePool = [...(ELEMENT_MOVES[elementType] || ELEMENT_MOVES.FIRE)];
    rng.shuffle(movePool);
    const moves = movePool.slice(0, 4);

    // 7. Aptitudes (90-110)
    const aptitudes: number[] = [];
    for (let i = 0; i < 8; i++) {
        const Z = rng.float(-1, 1);
        const apt = Math.max(90, Math.min(110, Math.round(100 + 3 * b + 5 * Z)));
        aptitudes.push(apt);
    }

    return { talent, temperament, personality: personality.id, stats, growthRates, moves, aptitudes };
}

// Pack stats into uint72 (9 x 8 bits)
function packBaseStats(stats: number[]): bigint {
    let packed = 0n;
    for (let i = 0; i < 9; i++) {
        packed |= BigInt(stats[i] & 0xFF) << BigInt(i * 8);
    }
    return packed;
}

// Pack growth rates into uint144 (9 x 16 bits)
function packGrowthRates(rates: number[]): bigint {
    let packed = 0n;
    for (let i = 0; i < 9; i++) {
        packed |= BigInt(rates[i] & 0xFFFF) << BigInt(i * 16);
    }
    return packed;
}

// Pack aptitudes into uint64 (8 x 8 bits)
function packAptitudes(apts: number[]): bigint {
    let packed = 0n;
    for (let i = 0; i < 8; i++) {
        packed |= BigInt(apts[i] & 0xFF) << BigInt(i * 8);
    }
    return packed;
}

// String to bytes32
function stringToBytes32(str: string): `0x${string}` {
    const bytes = new TextEncoder().encode(str);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hex.padEnd(64, '0')}` as `0x${string}`;
}

// ============ Hooks ============

export function useMintCreature() {
    const { writeContract, data: hash, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Move database for minting (element -> moveId mappings)
    const MOVE_DB: Record<string, { moveId: number; type: number; category: number; power: number; accuracy: number; cooldown: number; status: number; statusChance: number }[]> = {
        FIRE: [
            { moveId: 1, type: 0, category: 1, power: 50, accuracy: 100, cooldown: 0, status: 1, statusChance: 10 },   // Ember
            { moveId: 2, type: 0, category: 1, power: 90, accuracy: 85, cooldown: 1, status: 1, statusChance: 20 },    // Flamethrower
            { moveId: 3, type: 0, category: 1, power: 130, accuracy: 60, cooldown: 3, status: 1, statusChance: 50 },   // Inferno
            { moveId: 4, type: 0, category: 0, power: 65, accuracy: 95, cooldown: 0, status: 1, statusChance: 10 },    // Fire Fang
        ],
        WATER: [
            { moveId: 11, type: 1, category: 1, power: 40, accuracy: 100, cooldown: 0, status: 0, statusChance: 0 },   // Water Gun
            { moveId: 12, type: 1, category: 0, power: 40, accuracy: 100, cooldown: 0, status: 0, statusChance: 0 },   // Aqua Jet
            { moveId: 13, type: 1, category: 1, power: 120, accuracy: 75, cooldown: 2, status: 0, statusChance: 0 },   // Hydro Pump
            { moveId: 14, type: 1, category: 1, power: 90, accuracy: 90, cooldown: 1, status: 0, statusChance: 0 },    // Surf
        ],
        GRASS: [
            { moveId: 21, type: 2, category: 0, power: 45, accuracy: 100, cooldown: 0, status: 0, statusChance: 0 },
            { moveId: 22, type: 2, category: 0, power: 55, accuracy: 95, cooldown: 0, status: 0, statusChance: 0 },
            { moveId: 23, type: 2, category: 1, power: 120, accuracy: 100, cooldown: 2, status: 0, statusChance: 0 },
            { moveId: 24, type: 2, category: 0, power: 90, accuracy: 100, cooldown: 1, status: 0, statusChance: 0 },
        ],
        ELECTRIC: [
            { moveId: 31, type: 3, category: 1, power: 40, accuracy: 100, cooldown: 0, status: 4, statusChance: 10 },
            { moveId: 32, type: 3, category: 1, power: 90, accuracy: 100, cooldown: 1, status: 4, statusChance: 10 },
            { moveId: 33, type: 3, category: 1, power: 110, accuracy: 70, cooldown: 2, status: 4, statusChance: 30 },
            { moveId: 34, type: 3, category: 0, power: 90, accuracy: 100, cooldown: 1, status: 4, statusChance: 10 },
        ],
        ICE: [
            { moveId: 41, type: 4, category: 0, power: 40, accuracy: 100, cooldown: 0, status: 0, statusChance: 0 },
            { moveId: 42, type: 4, category: 1, power: 90, accuracy: 100, cooldown: 1, status: 2, statusChance: 10 },
            { moveId: 43, type: 4, category: 1, power: 110, accuracy: 70, cooldown: 2, status: 2, statusChance: 10 },
            { moveId: 44, type: 4, category: 0, power: 65, accuracy: 95, cooldown: 0, status: 2, statusChance: 10 },
        ],
        EARTH: [
            { moveId: 51, type: 5, category: 1, power: 55, accuracy: 95, cooldown: 0, status: 0, statusChance: 0 },
            { moveId: 52, type: 5, category: 0, power: 100, accuracy: 100, cooldown: 2, status: 0, statusChance: 0 },
            { moveId: 53, type: 5, category: 1, power: 90, accuracy: 100, cooldown: 1, status: 0, statusChance: 0 },
            { moveId: 54, type: 5, category: 0, power: 75, accuracy: 90, cooldown: 1, status: 0, statusChance: 0 },
        ],
        DARK: [
            { moveId: 61, type: 6, category: 0, power: 60, accuracy: 100, cooldown: 0, status: 7, statusChance: 10 },
            { moveId: 62, type: 6, category: 1, power: 80, accuracy: 100, cooldown: 1, status: 7, statusChance: 20 },
            { moveId: 63, type: 6, category: 0, power: 70, accuracy: 100, cooldown: 0, status: 0, statusChance: 0 },
            { moveId: 64, type: 6, category: 0, power: 80, accuracy: 100, cooldown: 1, status: 7, statusChance: 20 },
        ],
        LIGHT: [
            { moveId: 71, type: 7, category: 1, power: 40, accuracy: 100, cooldown: 0, status: 6, statusChance: 100 },
            { moveId: 72, type: 7, category: 1, power: 80, accuracy: 100, cooldown: 1, status: 0, statusChance: 0 },
            { moveId: 73, type: 7, category: 1, power: 95, accuracy: 100, cooldown: 1, status: 0, statusChance: 0 },
            { moveId: 74, type: 7, category: 0, power: 90, accuracy: 90, cooldown: 1, status: 0, statusChance: 0 },
        ],
    };

    // Empty move for unused slots
    const emptyMove = { moveId: 0, moveType: 0, category: 0, power: 0, accuracy: 0, cooldownMax: 0, statusEffect: 0, statusChance: 0 };

    const mint = (params: {
        to: `0x${string}`;
        genSeed: `0x${string}`;
        elementType: string;
    }) => {
        const { to, genSeed, elementType } = params;

        // Generate all creature data from seed
        const creature = generateCreatureFromSeed(genSeed, elementType);

        // Pack data for contract
        const baseStats = packBaseStats(creature.stats);
        const growthRates = packGrowthRates(creature.growthRates);
        const aptitudes = packAptitudes(creature.aptitudes);

        // Get moves from database for this element
        const elementMoves = MOVE_DB[elementType] || MOVE_DB.FIRE;

        // Create Move tuples (4 moves)
        const moveCount = Math.min(4, elementMoves.length);
        const moves: { moveId: number; moveType: number; category: number; power: number; accuracy: number; cooldownMax: number; statusEffect: number; statusChance: number }[] = [];

        for (let i = 0; i < 4; i++) {
            if (i < moveCount) {
                const m = elementMoves[i];
                moves.push({
                    moveId: m.moveId,
                    moveType: m.type,
                    category: m.category,
                    power: m.power,
                    accuracy: m.accuracy,
                    cooldownMax: m.cooldown,
                    statusEffect: m.status,
                    statusChance: m.statusChance
                });
            } else {
                moves.push(emptyMove);
            }
        }

        // Generate random mastery values (0-30, actual = 85 + value)
        const rng = new SeededRNG(genSeed);
        const mastery: [number, number, number, number] = [
            Math.floor(rng.next() * 30),
            Math.floor(rng.next() * 30),
            Math.floor(rng.next() * 30),
            Math.floor(rng.next() * 30)
        ];

        console.log('[useMintCreature] Minting creature:', {
            to,
            genSeed,
            talent: creature.talent,
            elementType,
            moveCount,
            moves: moves.map(m => m.moveId),
            mastery,
        });

        writeContract({
            address: CONTRACTS.RMRKCreature.address,
            abi: RMRK_CREATURE_ABI,
            functionName: 'mintCreature',
            args: [
                to,
                genSeed,
                creature.talent,
                stringToBytes32(creature.personality),
                stringToBytes32(elementType),
                stringToBytes32(creature.temperament),
                baseStats,
                growthRates,
                moves as any, // tuple[4]
                moveCount,
                mastery,
                aptitudes,
            ],
            gas: 500000n, // Manual gas limit - estimation fails with tuple types
        });
    };

    return {
        mint,
        hash,
        isPending,
        isConfirming,
        isSuccess,
        error,
    };
}

// Standalone viem publicClient to avoid wagmi authorization issues
let viemClient: any = null;
async function getViemClient() {
    if (!viemClient) {
        const { createPublicClient, http } = await import('viem');
        const { hardhat } = await import('viem/chains');
        viemClient = createPublicClient({
            chain: hardhat,
            transport: http('http://127.0.0.1:8545'),
        });
    }
    return viemClient;
}

export function useCreatureBalance(address?: `0x${string}`) {
    const [data, setData] = useState<bigint | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [refetchCount, setRefetchCount] = useState(0);

    useEffect(() => {
        async function fetch() {
            if (!address) {
                setData(0n);
                setIsLoading(false);
                return;
            }
            try {
                const client = await getViemClient();
                const { parseAbi } = await import('viem');
                const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
                const balance = await client.readContract({
                    address: CONTRACTS.RMRKCreature.address,
                    abi,
                    functionName: 'balanceOf',
                    args: [address],
                });
                setData(balance);
            } catch (e) {
                console.error('[useCreatureBalance] Error:', e);
                setData(0n);
            } finally {
                setIsLoading(false);
            }
        }
        fetch();
    }, [address, refetchCount]);

    return { data, isLoading, refetch: () => setRefetchCount(c => c + 1) };
}

export function useTotalSupply() {
    const [data, setData] = useState<bigint | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                const client = await getViemClient();
                const { parseAbi } = await import('viem');
                const abi = parseAbi(['function totalSupply() view returns (uint256)']);
                const supply = await client.readContract({
                    address: CONTRACTS.RMRKCreature.address,
                    abi,
                    functionName: 'totalSupply',
                });
                setData(supply);
            } catch (e) {
                console.error('[useTotalSupply] Error:', e);
                setData(0n);
            } finally {
                setIsLoading(false);
            }
        }
        fetch();
    }, []);

    return { data, isLoading };
}
/**
 * Get all owned creatures with full stats
 * Uses viem publicClient directly to avoid wagmi authorization issues
 */
export function useOwnedCreatures(address?: `0x${string}`) {
    const [creatures, setCreatures] = useState<CreatureInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const { data: balance, isLoading: isBalanceLoading, refetch: refetchBalance } = useCreatureBalance(address);
    const { data: totalSupply, isLoading: isTotalLoading } = useTotalSupply();

    useEffect(() => {
        async function loadCreatures() {
            if (isBalanceLoading || isTotalLoading) return;
            if (!address || balance === undefined || balance === 0n || !totalSupply) {
                setCreatures([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Create standalone publicClient to avoid wagmi auth issues
                const { createPublicClient, http, parseAbi } = await import('viem');
                const { hardhat } = await import('viem/chains');

                const publicClient = createPublicClient({
                    chain: hardhat,
                    transport: http('http://127.0.0.1:8545'),
                });

                const creatureAbi = parseAbi([
                    'function ownerOf(uint256) view returns (address)',
                    'function coreData(uint256) view returns (bytes32, bytes32, bytes32, bytes32, uint48, uint8)',
                    'function getLiveStats(uint256) view returns (uint8[9], uint16, uint16)',
                    'function getMoves(uint256) view returns ((uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8)[4], uint8, uint8[4])',
                    'function xp(uint256) view returns (uint256)',
                ]);

                const hpAbi = parseAbi(['function getHP(uint256) view returns (uint8)']);
                const HP_MANAGER = '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584';

                const creatureList: CreatureInfo[] = [];
                const supply = Number(totalSupply);
                const targetCount = Number(balance);

                for (let tokenId = 1; tokenId <= supply && creatureList.length < targetCount; tokenId++) {
                    try {
                        // Check owner
                        const owner = await publicClient.readContract({
                            address: CONTRACTS.RMRKCreature.address,
                            abi: creatureAbi,
                            functionName: 'ownerOf',
                            args: [BigInt(tokenId)],
                        });

                        if (owner.toLowerCase() !== address.toLowerCase()) continue;

                        // Get core data
                        const core = await publicClient.readContract({
                            address: CONTRACTS.RMRKCreature.address,
                            abi: creatureAbi,
                            functionName: 'coreData',
                            args: [BigInt(tokenId)],
                        }) as [string, string, string, string, bigint, number];

                        // Get live stats - returns [uint8[9] stats, uint16 level, uint16 ageDays]
                        const liveStatsResult = await publicClient.readContract({
                            address: CONTRACTS.RMRKCreature.address,
                            abi: creatureAbi,
                            functionName: 'getLiveStats',
                            args: [BigInt(tokenId)],
                        }) as unknown as [number[], number, number];
                        const stats = liveStatsResult[0]; // uint8[9] array

                        // Get moves
                        const movesData = await publicClient.readContract({
                            address: CONTRACTS.RMRKCreature.address,
                            abi: creatureAbi,
                            functionName: 'getMoves',
                            args: [BigInt(tokenId)],
                        }) as [any[], number, number[]];

                        // Get XP
                        let xpValue = 0n;
                        try {
                            xpValue = await publicClient.readContract({
                                address: CONTRACTS.RMRKCreature.address,
                                abi: creatureAbi,
                                functionName: 'xp',
                                args: [BigInt(tokenId)],
                            }) as bigint;
                        } catch { /* no xp */ }

                        // Parse creature data
                        const decodeBytes32 = (hex: string) => {
                            const bytes = hex.slice(2);
                            let str = '';
                            for (let i = 0; i < bytes.length; i += 2) {
                                const code = parseInt(bytes.slice(i, i + 2), 16);
                                if (code === 0) break;
                                str += String.fromCharCode(code);
                            }
                            return str;
                        };

                        const elementType = decodeBytes32(core[2]) as any;
                        const personality = decodeBytes32(core[1]);
                        const temperament = decodeBytes32(core[3]);
                        const talent = core[5];
                        const xp = Number(xpValue);
                        const level = Math.floor(Math.sqrt(xp / 100)) + 1;

                        // Parse moves
                        const elementMap = ['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'EARTH', 'DARK', 'LIGHT'];
                        const categoryMap = ['PHYSICAL', 'SPECIAL', 'STATUS'];
                        const moveNames: Record<number, string> = {
                            // Fire (1-6)
                            1: 'Ember', 2: 'Flamethrower', 3: 'Inferno', 4: 'Fire Fang', 5: 'Flame Burst', 6: 'Will-O-Wisp',
                            // Water (11-16)
                            11: 'Water Gun', 12: 'Aqua Jet', 13: 'Hydro Pump', 14: 'Surf', 15: 'Scald', 16: 'Healing Rain',
                            // Grass (21-26)
                            21: 'Vine Whip', 22: 'Razor Leaf', 23: 'Solar Beam', 24: 'Leaf Storm', 25: 'Leech Seed', 26: 'Synthesis',
                            // Electric (31-36)
                            31: 'Spark', 32: 'Thunderbolt', 33: 'Thunder', 34: 'Volt Switch', 35: 'Thunder Wave', 36: 'Discharge',
                            // Ice (41-46)
                            41: 'Ice Shard', 42: 'Ice Beam', 43: 'Blizzard', 44: 'Ice Fang', 45: 'Absolute Zero', 46: 'Frost Armor',
                            // Earth (51-56)
                            51: 'Mud Slap', 52: 'Earthquake', 53: 'Rock Slide', 54: 'Stone Edge', 55: 'Bulldoze', 56: 'Stone Wall',
                            // Dark (61-66)
                            61: 'Shadow Sneak', 62: 'Dark Pulse', 63: 'Night Slash', 64: 'Crunch', 65: 'Nightmare', 66: 'Shadow Ball',
                            // Light (71-76)
                            71: 'Flash', 72: 'Holy Beam', 73: 'Divine Light', 74: 'Radiance', 75: 'Purify', 76: 'Blessing',
                            // Neutral/Common (101-102)
                            101: 'Tackle', 102: 'Quick Strike',
                        };

                        const moves = movesData[0].slice(0, movesData[1]).map((m: any, i: number) => ({
                            id: m[0],
                            name: moveNames[m[0]] || `Move #${m[0]}`,
                            type: elementMap[m[1]] || 'FIRE',
                            category: categoryMap[m[2]] || 'PHYSICAL',
                            power: m[3],
                            accuracy: m[4],
                            cooldown: 0,
                            maxCooldown: m[5],
                            // Mastery stored as 0-30, actual = 85 + value, display as decimal 0.85-1.15
                            mastery: (85 + (movesData[2][i] || 0)) / 100,
                        }));

                        // Calculate HP
                        const vit = stats[5] || 50;
                        const end = stats[4] || 50;
                        const maxHp = Math.floor((vit * 2 + end) * (level / 50 + 1));
                        let currentHp = maxHp;

                        // Try to get HP from HPManager
                        try {
                            const hpPercent = await publicClient.readContract({
                                address: HP_MANAGER as `0x${string}`,
                                abi: hpAbi,
                                functionName: 'getHP',
                                args: [BigInt(tokenId)],
                            }) as number;
                            currentHp = Math.round((maxHp * hpPercent) / 100);
                        } catch { /* use max HP */ }

                        const creature: CreatureInfo = {
                            tokenId: BigInt(tokenId),
                            genSeed: core[0] as `0x${string}`,
                            elementType,
                            personality,
                            temperament,
                            talent,
                            level,
                            xp,
                            stats: {
                                STR: stats[0] || 50,
                                AGI: stats[1] || 50,
                                SPD: stats[2] || 50,
                                REF: stats[3] || 50,
                                END: stats[4] || 50,
                                VIT: stats[5] || 50,
                                INT: stats[6] || 50,
                                PRC: stats[7] || 50,
                                RGN: stats[8] || 50,
                            },
                            moves,
                            currentHp,
                            maxHp,
                        };

                        creatureList.push(creature);
                        console.log('[useOwnedCreatures] Loaded creature', tokenId, creature);
                    } catch (err) {
                        console.warn('[useOwnedCreatures] Error loading token', tokenId, err);
                    }
                }

                setCreatures(creatureList);
            } catch (err) {
                console.error('[useOwnedCreatures] Error:', err);
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        }

        loadCreatures();
    }, [address, balance, totalSupply, isBalanceLoading, isTotalLoading]);

    return { creatures, isLoading, error, refetch: refetchBalance };
}

function parseCreatureData(
    tokenId: bigint,
    coreHex: string,
    liveHex: string,
    movesHex: string,
    xpHex: string
): CreatureInfo {
    const data = coreHex.slice(2);
    const liveData = liveHex.slice(2);

    // Core data parsing (6 fields)
    const genSeed = ('0x' + data.slice(0, 64)) as `0x${string}`;
    const personality = bytes32ToString('0x' + data.slice(64, 128));
    const elementType = bytes32ToString('0x' + data.slice(128, 192));
    const temperament = bytes32ToString('0x' + data.slice(192, 256));
    const bornAt = BigInt('0x' + data.slice(256, 320) || '0');
    const talent = parseInt(data.slice(320, 384) || '0', 16);

    // Live stats parsing for static uint8[9] array
    // ABI encoding for static arrays: 9 x 32-byte padded uint8, then level, then ageDays
    // Each stat occupies 64 hex chars (32 bytes), stats[0] at offset 0, stats[1] at 64, etc.
    // level at 9*64=576, ageDays at 10*64=640

    const stats: CreatureStats = {
        STR: parseInt(liveData.slice(0, 64) || '0', 16),
        AGI: parseInt(liveData.slice(64, 128) || '0', 16),
        SPD: parseInt(liveData.slice(128, 192) || '0', 16),
        REF: parseInt(liveData.slice(192, 256) || '0', 16),
        END: parseInt(liveData.slice(256, 320) || '0', 16),
        VIT: parseInt(liveData.slice(320, 384) || '0', 16),
        INT: parseInt(liveData.slice(384, 448) || '0', 16),
        PRC: parseInt(liveData.slice(448, 512) || '0', 16),
        RGN: parseInt(liveData.slice(512, 576) || '0', 16),
    };

    const level = parseInt(liveData.slice(576, 640) || '0', 16);
    const ageDays = parseInt(liveData.slice(640, 704) || '0', 16);

    // Parse moves from new struct format
    // New struct: 4 x Move (8 bytes each) + moveCount + mastery[4]
    // Each Move: moveId, moveType, category, power, accuracy, cooldownMax, statusEffect, statusChance
    const ELEMENT_NAMES = ['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'EARTH', 'DARK', 'LIGHT'];
    const CATEGORY_NAMES: ('PHYSICAL' | 'SPECIAL' | 'STATUS')[] = ['PHYSICAL', 'SPECIAL', 'STATUS'];
    const STATUS_NAMES = ['NONE', 'BURN', 'FREEZE', 'POISON', 'PARALYZE', 'STUN', 'BLIND', 'FEAR'];
    const MOVE_NAMES: Record<number, string> = {
        1: 'Ember', 2: 'Flamethrower', 3: 'Inferno', 4: 'Fire Fang',
        11: 'Water Gun', 12: 'Aqua Jet', 13: 'Hydro Pump', 14: 'Surf',
        21: 'Vine Whip', 22: 'Razor Leaf', 23: 'Solar Beam', 24: 'Leaf Blade',
        31: 'Thunder Shock', 32: 'Thunderbolt', 33: 'Thunder', 34: 'Volt Tackle',
        41: 'Ice Shard', 42: 'Ice Beam', 43: 'Blizzard', 44: 'Ice Fang',
        51: 'Mud Shot', 52: 'Earthquake', 53: 'Earth Power', 54: 'Rock Slide',
        61: 'Bite', 62: 'Dark Pulse', 63: 'Night Slash', 64: 'Crunch',
        71: 'Flash', 72: 'Dazzling Gleam', 73: 'Moonblast', 74: 'Play Rough',
        101: 'Tackle', 102: 'Body Slam', 103: 'Hyper Beam'
    };

    const moves: MoveInfo[] = [];
    if (movesHex && movesHex.length > 2) {
        const movesData = movesHex.slice(2);
        // Offset for move structs in ABI encoding (depends on contract layout)
        // Each Move field is padded to 32 bytes in ABI, so 8 fields x 32 bytes = 256 bytes per move
        const BYTES_PER_FIELD = 64; // 32 bytes = 64 hex chars

        // Read moveCount (comes after 4 moves, offset = 4 * 8 fields * 64 = 2048)
        const moveCountOffset = 4 * 8 * BYTES_PER_FIELD;
        const moveCount = parseInt(movesData.slice(moveCountOffset, moveCountOffset + BYTES_PER_FIELD) || '0', 16);

        // Read mastery array (starts after moveCount)
        const masteryOffset = moveCountOffset + BYTES_PER_FIELD;
        const masteryValues: number[] = [];
        for (let i = 0; i < 4; i++) {
            const val = parseInt(movesData.slice(masteryOffset + i * BYTES_PER_FIELD, masteryOffset + (i + 1) * BYTES_PER_FIELD) || '0', 16);
            masteryValues.push(val);
        }

        // Parse each move
        for (let i = 0; i < Math.min(moveCount, 4); i++) {
            const baseOffset = i * 8 * BYTES_PER_FIELD;
            const moveId = parseInt(movesData.slice(baseOffset + 0 * BYTES_PER_FIELD, baseOffset + 1 * BYTES_PER_FIELD) || '0', 16);

            if (moveId === 0) continue;

            const moveTypeId = parseInt(movesData.slice(baseOffset + 1 * BYTES_PER_FIELD, baseOffset + 2 * BYTES_PER_FIELD) || '0', 16);
            const categoryId = parseInt(movesData.slice(baseOffset + 2 * BYTES_PER_FIELD, baseOffset + 3 * BYTES_PER_FIELD) || '0', 16);
            const power = parseInt(movesData.slice(baseOffset + 3 * BYTES_PER_FIELD, baseOffset + 4 * BYTES_PER_FIELD) || '0', 16);
            const accuracy = parseInt(movesData.slice(baseOffset + 4 * BYTES_PER_FIELD, baseOffset + 5 * BYTES_PER_FIELD) || '0', 16);
            const cooldownMax = parseInt(movesData.slice(baseOffset + 5 * BYTES_PER_FIELD, baseOffset + 6 * BYTES_PER_FIELD) || '0', 16);
            const statusEffectId = parseInt(movesData.slice(baseOffset + 6 * BYTES_PER_FIELD, baseOffset + 7 * BYTES_PER_FIELD) || '0', 16);
            const statusChance = parseInt(movesData.slice(baseOffset + 7 * BYTES_PER_FIELD, baseOffset + 8 * BYTES_PER_FIELD) || '0', 16);

            moves.push({
                moveId,
                name: MOVE_NAMES[moveId] || `Move #${moveId}`,
                type: ELEMENT_NAMES[moveTypeId] || 'EARTH',
                category: CATEGORY_NAMES[categoryId] || 'PHYSICAL',
                power,
                accuracy,
                cooldownMax,
                statusEffect: statusEffectId > 0 ? STATUS_NAMES[statusEffectId] : undefined,
                statusChance: statusChance / 100,
                mastery: (85 + masteryValues[i]) / 100
            });
        }
    }

    // Parse XP
    const xp = xpHex && xpHex.length > 2 ? BigInt(xpHex) : 0n;

    // Calculate HP from VIT stat
    const maxHp = stats.VIT * 10;
    const currentHp = maxHp; // Default 100% - HPManager will update when fetched

    return {
        tokenId,
        genSeed,
        talent: talent || 50,
        personality: personality || 'NEUTRAL',
        elementType: elementType || 'FIRE',
        temperament: temperament || 'NEUTRAL',
        bornAt,
        xp,
        level: level || 1,
        ageDays: ageDays || 0,
        stats,
        moves,
        currentHp,
        maxHp,
    };
}

export { STAT_NAMES };
