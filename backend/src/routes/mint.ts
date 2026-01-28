/**
 * Mint Routes - Secure minting with EIP-712 signatures
 */
import { Router } from 'express';
import { generateCreature, generateRandomSeed } from '../services/creature-generator.js';
import { ElementType } from '../data/moves.js';
import { ethers } from 'ethers';

const router = Router();

// Backend signer - MUST match the signer address configured in MintGateV2 contract
// For local dev: Hardhat account #0
const SIGNER_PRIVATE_KEY = process.env.MINT_SIGNER_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

console.log('[Mint] Signer address:', signer.address);

// MintGateV2 address - must match deployed contract
const MINT_GATE_ADDRESS = process.env.MINT_GATE_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '31337');

// EIP-712 Domain
const domain = {
    name: 'MintGateV2',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: MINT_GATE_ADDRESS,
};

// EIP-712 Types
const types = {
    MintCreature: [
        { name: 'to', type: 'address' },
        { name: 'genSeed', type: 'bytes32' },
        { name: 'talent', type: 'uint8' },
        { name: 'personality', type: 'bytes32' },
        { name: 'elementType', type: 'bytes32' },
        { name: 'temperament', type: 'bytes32' },
        { name: 'baseStats', type: 'uint72' },
        { name: 'growthRates', type: 'uint144' },
        { name: 'aptitudes', type: 'uint64' },
        { name: 'moveCount', type: 'uint8' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
    ],
};

/**
 * POST /api/mint/generate
 * Generate creature data and sign it for on-chain minting
 * Body: { seed?: string, elementType: string, userAddress: string, nonce: number }
 */
router.post('/generate', async (req, res) => {
    try {
        const { seed, elementType, userAddress, nonce } = req.body;

        if (!elementType || !['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'EARTH', 'DARK', 'LIGHT'].includes(elementType)) {
            return res.status(400).json({ error: 'Invalid elementType' });
        }

        if (!userAddress || !ethers.isAddress(userAddress)) {
            return res.status(400).json({ error: 'Invalid userAddress' });
        }

        if (nonce === undefined || nonce < 0) {
            return res.status(400).json({ error: 'Invalid nonce' });
        }

        const genSeed = seed || generateRandomSeed();
        const creature = generateCreature(genSeed, elementType as ElementType);

        // Pack data for contract
        const packed = packCreatureForContract(creature);

        // Deadline: 5 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 300;

        // Create message to sign
        const message = {
            to: userAddress,
            genSeed: packed.genSeed,
            talent: packed.talent,
            personality: packed.personality,
            elementType: packed.elementType,
            temperament: packed.temperament,
            baseStats: BigInt(packed.baseStats),
            growthRates: BigInt(packed.growthRates),
            aptitudes: BigInt(packed.aptitudes),
            moveCount: packed.moveCount,
            nonce: BigInt(nonce),
            deadline: BigInt(deadline),
        };

        // Sign with EIP-712
        const signature = await signer.signTypedData(domain, types, message);

        return res.json({
            success: true,
            creature,
            packed: {
                ...packed,
                deadline,
                signature,
            },
            signerAddress: signer.address,
        });
    } catch (error: any) {
        console.error('Generate error:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/mint/signer
 * Get the signer address for verification
 */
router.get('/signer', (req, res) => {
    res.json({
        signerAddress: signer.address,
        mintGateAddress: MINT_GATE_ADDRESS,
        chainId: CHAIN_ID,
    });
});

/**
 * Pack creature data into contract-compatible format
 */
function packCreatureForContract(creature: ReturnType<typeof generateCreature>) {
    // Pack baseStats: 9 x 8 bits = 72 bits
    const baseStats = packStats(creature.attributes as any);

    // Pack growthRates: 9 x 16 bits = 144 bits
    const growthRates = packGrowthRates(creature.growthRates as any);

    // Pack aptitudes: 8 x 8 bits = 64 bits
    const aptitudes = packAptitudes(creature.aptitudeVsType);

    // Format moves for contract - MUST match RMRKCreature.Move struct exactly
    // struct Move { moveId, moveType, category, power, accuracy, cooldownMax, statusEffect, statusChance }
    const elementToType: Record<string, number> = {
        'FIRE': 0, 'WATER': 1, 'GRASS': 2, 'ELECTRIC': 3,
        'ICE': 4, 'EARTH': 5, 'DARK': 6, 'LIGHT': 7
    };
    const categoryToNum: Record<string, number> = {
        'PHYSICAL': 0, 'SPECIAL': 1, 'STATUS': 2
    };
    const statusToNum: Record<string, number> = {
        '': 0, 'BURN': 1, 'FREEZE': 2, 'POISON': 3, 'PARALYZE': 4, 'STUN': 5
    };

    const moves = creature.moves.map(m => ({
        moveId: m.moveId,
        moveType: elementToType[m.type] ?? 0,
        category: categoryToNum[m.category] ?? 0,
        power: m.power,
        accuracy: m.accuracy,
        cooldownMax: m.cooldownMax ?? 0,
        statusEffect: statusToNum[m.statusEffect ?? ''] ?? 0,
        statusChance: m.statusChance ?? 0,
    }));

    // Mastery values
    const mastery = creature.moveMastery.map(m => Math.min(30, Math.max(0, m)));

    return {
        genSeed: creature.genSeed,
        talent: creature.talent,
        personality: ethers.encodeBytes32String(creature.personality.id),
        elementType: ethers.encodeBytes32String(creature.elementType),
        temperament: ethers.encodeBytes32String(creature.temperament),
        baseStats: '0x' + baseStats.toString(16).padStart(18, '0'),
        growthRates: '0x' + growthRates.toString(16).padStart(36, '0'),
        moves,
        moveCount: creature.moveCount,
        mastery,
        aptitudes: '0x' + aptitudes.toString(16).padStart(16, '0'),
    };
}

function packStats(attrs: Record<string, number>): bigint {
    const stats = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT', 'INT', 'PRC', 'RGN'];
    let packed = 0n;
    for (let i = 0; i < 9; i++) {
        const value = BigInt(Math.min(255, Math.max(0, attrs[stats[i]] || 0)));
        packed |= value << BigInt(i * 8);
    }
    return packed;
}

function packGrowthRates(rates: Record<string, number>): bigint {
    const stats = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT', 'INT', 'PRC', 'RGN'];
    let packed = 0n;
    for (let i = 0; i < 9; i++) {
        const value = BigInt(Math.min(65535, Math.max(0, Math.round((rates[stats[i]] || 0) * 1000))));
        packed |= value << BigInt(i * 16);
    }
    return packed;
}

function packAptitudes(aptitudes: Record<string, number>): bigint {
    const types = ['FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'EARTH', 'DARK', 'LIGHT'];
    let packed = 0n;
    for (let i = 0; i < 8; i++) {
        const value = BigInt(Math.min(255, Math.max(0, Math.round((aptitudes[types[i]] || 1) * 100))));
        packed |= value << BigInt(i * 8);
    }
    return packed;
}

export default router;
