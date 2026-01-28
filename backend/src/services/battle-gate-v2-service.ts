/**
 * BattleGateV2 Service
 * Handles on-chain battle resolution with signature
 */

import { ethers } from 'ethers';

// Contract ABI (only needed functions)
const BATTLE_GATE_V2_ABI = [
    {
        inputs: [
            { name: 'battleId', type: 'bytes32' },
            { name: 'winner', type: 'address' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'signature', type: 'bytes' }
        ],
        name: 'resolveBattle',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ name: 'battleId', type: 'bytes32' }],
        name: 'getBattle',
        outputs: [
            {
                components: [
                    { name: 'host', type: 'address' },
                    { name: 'guest', type: 'address' },
                    { name: 'hostCreatureId', type: 'uint256' },
                    { name: 'guestCreatureId', type: 'uint256' },
                    { name: 'stakeAmount', type: 'uint256' },
                    { name: 'createdAt', type: 'uint256' },
                    { name: 'matchedAt', type: 'uint256' },
                    { name: 'resolvedAt', type: 'uint256' },
                    { name: 'state', type: 'uint8' },
                    { name: 'winner', type: 'address' }
                ],
                name: '',
                type: 'tuple'
            }
        ],
        stateMutability: 'view',
        type: 'function'
    }
];

// Configuration from environment
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const BATTLE_GATE_V2_ADDRESS = process.env.BATTLE_GATE_V2_ADDRESS || '0x1291Be112d480055DaFd8a610b7d1e203891C274';

// SECURITY: Private key MUST be set via environment variable
// For local dev: set BACKEND_PRIVATE_KEY in .env to a Hardhat test account
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
if (!BACKEND_PRIVATE_KEY) {
    throw new Error(
        'CRITICAL: BACKEND_PRIVATE_KEY environment variable is required.\n' +
        'For local development, add to backend/.env:\n' +
        'BACKEND_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    );
}

export interface ResolveBattleResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export interface BattleOnChain {
    host: string;
    guest: string;
    hostCreatureId: bigint;
    guestCreatureId: bigint;
    stakeAmount: bigint;
    createdAt: bigint;
    matchedAt: bigint;
    resolvedAt: bigint;
    state: number; // 0=NONE, 1=CREATED, 2=MATCHED, 3=RESOLVED, 4=CLAIMED, 5=EXPIRED
    winner: string;
}

class BattleGateV2Service {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private contract: ethers.Contract;
    private chainId: bigint = 31337n; // Local hardhat chain ID

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(BATTLE_GATE_V2_ADDRESS, BATTLE_GATE_V2_ABI, this.wallet);

        // Get chain ID
        this.provider.getNetwork().then(network => {
            this.chainId = network.chainId;
            console.log(`[BattleGateV2] Connected to chain ${this.chainId}`);
        });
    }

    /**
     * Resolve a battle on-chain
     * @param battleId The on-chain battle ID (bytes32)
     * @param winnerAddress The winner's wallet address
     */
    async resolveBattle(battleId: string, winnerAddress: string): Promise<ResolveBattleResult> {
        try {
            console.log(`[BattleGateV2] Resolving battle ${battleId} with winner ${winnerAddress}`);

            // Generate timestamp
            const timestamp = Math.floor(Date.now() / 1000);

            // Create signature
            const signature = await this.signBattleResult(battleId, winnerAddress, timestamp);

            console.log(`[BattleGateV2] Generated signature, submitting TX...`);

            // Call contract
            const tx = await this.contract.resolveBattle(
                battleId,
                winnerAddress,
                timestamp,
                signature
            );

            console.log(`[BattleGateV2] TX submitted: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`[BattleGateV2] TX confirmed in block ${receipt.blockNumber}`);

            return { success: true, txHash: tx.hash };

        } catch (error: any) {
            console.error(`[BattleGateV2] Error resolving battle:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sign a battle result for on-chain verification
     */
    private async signBattleResult(
        battleId: string,
        winner: string,
        timestamp: number
    ): Promise<string> {
        // Create message hash matching contract's expectation:
        // keccak256(abi.encodePacked(battleId, winner, timestamp, chainId))
        const messageHash = ethers.solidityPackedKeccak256(
            ['bytes32', 'address', 'uint256', 'uint256'],
            [battleId, winner, timestamp, this.chainId]
        );

        // Sign with EIP-191 prefix (what ethers does by default with signMessage)
        const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

        return signature;
    }

    /**
     * Get battle state from chain
     */
    async getBattle(battleId: string): Promise<BattleOnChain | null> {
        try {
            const battle = await this.contract.getBattle(battleId);
            return {
                host: battle.host,
                guest: battle.guest,
                hostCreatureId: battle.hostCreatureId,
                guestCreatureId: battle.guestCreatureId,
                stakeAmount: battle.stakeAmount,
                createdAt: battle.createdAt,
                matchedAt: battle.matchedAt,
                resolvedAt: battle.resolvedAt,
                state: Number(battle.state),
                winner: battle.winner
            };
        } catch (error: any) {
            console.error(`[BattleGateV2] Error getting battle:`, error.message);
            return null;
        }
    }

    /**
     * Verify a battle is in MATCHED state (ready for off-chain battle)
     */
    async isBattleReady(battleId: string): Promise<boolean> {
        const battle = await this.getBattle(battleId);
        return battle !== null && battle.state === 2; // MATCHED
    }

    /**
     * Get wallet address used for signing
     */
    getBackendAddress(): string {
        return this.wallet.address;
    }
}

// Singleton instance
export const battleGateV2Service = new BattleGateV2Service();

export default BattleGateV2Service;
