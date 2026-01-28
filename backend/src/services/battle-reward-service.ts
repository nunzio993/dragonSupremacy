/**
 * Battle Reward Service
 * Calls BattleGate.rewardWinner() on-chain to mint DGNE tokens to winner
 * Uses verified battle nonces to prevent replay attacks
 */

import { ethers } from 'ethers';

// BattleGate ABI for reward function
const BATTLE_GATE_ABI = [
    'function rewardWinner(address winner, bytes32 battleNonce) external',
    'function getEntryCost() external view returns (uint256 dgneCost, uint256 rmrkCost, uint256 reward)'
];

// Server wallet private key - must be authorized as operator on BattleGate
const SERVER_PRIVATE_KEY = process.env.SERVER_WALLET_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat account #0 for dev

// Contract addresses (should match deployed-addresses.json)
const BATTLE_GATE_ADDRESS = process.env.BATTLE_GATE_ADDRESS ||
    '0x0165878A594ca255338adfa4d48449f69242Eb8F';

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// Singleton provider and wallet
let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let battleGate: ethers.Contract | null = null;

function getContract(): ethers.Contract {
    if (!battleGate) {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        wallet = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);
        battleGate = new ethers.Contract(BATTLE_GATE_ADDRESS, BATTLE_GATE_ABI, wallet);
    }
    return battleGate;
}

/**
 * Award DGNE tokens to the battle winner via BattleGate contract
 * Uses the winner's battle nonce for on-chain verification
 * 
 * @param winnerAddress - Ethereum address of the winner
 * @param battleNonce - The battle nonce from when winner paid entry fee
 */
export async function rewardBattleWinner(
    winnerAddress: string,
    battleNonce: string
): Promise<{ success: boolean; txHash?: string; error?: string; amount?: string }> {
    try {
        console.log(`[BattleReward] Rewarding winner ${winnerAddress} with nonce ${battleNonce}`);

        const contract = getContract();

        // Get reward amount from config
        const [, , reward] = await contract.getEntryCost();
        const rewardAmount = ethers.formatEther(reward);
        console.log(`[BattleReward] Reward amount: ${rewardAmount} DGNE`);

        // Call rewardWinner on BattleGate (verifies nonce was used in payEntryFee)
        const tx = await contract.rewardWinner(winnerAddress, battleNonce);
        console.log(`[BattleReward] Transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`[BattleReward] Transaction confirmed in block ${receipt.blockNumber}`);

        return {
            success: true,
            txHash: tx.hash,
            amount: rewardAmount
        };
    } catch (error: any) {
        console.error(`[BattleReward] Failed to reward winner:`, error.message);

        // Common error cases with user-friendly messages
        if (error.message.includes('Not authorized operator')) {
            return { success: false, error: 'Server wallet not authorized as operator on BattleGate' };
        }
        if (error.message.includes('Battle not found')) {
            return { success: false, error: 'Battle nonce not found - entry fee may not have been paid on-chain' };
        }

        return { success: false, error: error.message };
    }
}

/**
 * Get current reward amount from contract config
 */
export async function getBattleReward(): Promise<bigint> {
    try {
        const contract = getContract();
        const [, , reward] = await contract.getEntryCost();
        return reward;
    } catch (error) {
        console.error('[BattleReward] Failed to get reward amount:', error);
        return BigInt(8e18); // Default 8 DGNE
    }
}
