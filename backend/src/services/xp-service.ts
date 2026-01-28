/**
 * XP Service
 * Handles adding XP to creatures on-chain after battles
 */

import { ethers } from 'ethers';

// RMRKCreature contract ABI for XP functions
const XP_ABI = [
    {
        inputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'addXP',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getLevel',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// XP rewards configuration
export const XP_REWARDS = {
    WIN: 100,           // XP for winning a battle
    PARTICIPATION: 25,  // XP for participating (loser)
    PERFECT_WIN: 50,    // Bonus XP for winning without taking damage
} as const;

// Contract configuration
const CONTRACT_ADDRESS = process.env.RMRK_CREATURE_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
// Use account #1 to avoid nonce conflicts with BattleGateV2 service (which uses #0)
const PRIVATE_KEY = process.env.XP_SIGNER_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

class XPService {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private contract: ethers.Contract;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(CONTRACT_ADDRESS, XP_ABI, this.wallet);
    }

    /**
     * Add XP to a creature after battle
     * @param tokenId - The creature's token ID
     * @param amount - Amount of XP to add
     */
    async addXP(tokenId: string, amount: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            console.log(`[XP] Adding ${amount} XP to creature #${tokenId}`);

            const tx = await this.contract.addXP(BigInt(tokenId), BigInt(amount));
            const receipt = await tx.wait();

            console.log(`[XP] Transaction confirmed: ${receipt.hash}`);

            return {
                success: true,
                txHash: receipt.hash,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[XP] Error adding XP: ${errorMsg}`);

            return {
                success: false,
                error: errorMsg,
            };
        }
    }

    /**
     * Get current level of a creature
     */
    async getLevel(tokenId: string): Promise<number> {
        try {
            const level = await this.contract.getLevel(BigInt(tokenId));
            return Number(level);
        } catch (error) {
            console.error(`[XP] Error getting level: ${error}`);
            return 1;
        }
    }

    /**
     * Award XP to battle participants
     * @param winnerCreatureId - Token ID of the winning creature
     * @param loserCreatureId - Token ID of the losing creature
     * @param isPerfectWin - Whether the winner took no damage
     */
    async awardBattleXP(
        winnerCreatureId: string,
        loserCreatureId: string,
        isPerfectWin: boolean = false
    ): Promise<void> {
        // Award winner XP
        const winnerXP = XP_REWARDS.WIN + (isPerfectWin ? XP_REWARDS.PERFECT_WIN : 0);
        await this.addXP(winnerCreatureId, winnerXP);

        // Award loser participation XP
        await this.addXP(loserCreatureId, XP_REWARDS.PARTICIPATION);
    }
}

// Singleton instance
export const xpService = new XPService();

export default XPService;
