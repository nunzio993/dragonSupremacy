/**
 * useBattleGateV2 - Hook for BattleGateV2 escrow system
 * 
 * Handles:
 * - Creating battles with stake deposit
 * - Joining battles with stake deposit
 * - Claiming winnings after battle
 * - Canceling battles
 */

import { useWriteContract, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, Address, decodeEventLog } from 'viem';
import { useCallback, useState } from 'react';
import { CONTRACTS } from '../contracts/config';

// BattleGateV2 ABI
const BATTLE_GATE_V2_ABI = [
    {
        name: 'createBattle',
        type: 'function',
        inputs: [
            { name: 'creatureId', type: 'uint256' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        outputs: [{ name: 'battleId', type: 'bytes32' }],
        stateMutability: 'nonpayable'
    },
    {
        name: 'joinBattle',
        type: 'function',
        inputs: [
            { name: 'battleId', type: 'bytes32' },
            { name: 'creatureId', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'claimWinnings',
        type: 'function',
        inputs: [{ name: 'battleId', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'cancelBattle',
        type: 'function',
        inputs: [{ name: 'battleId', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'claimHostTimeout',
        type: 'function',
        inputs: [{ name: 'battleId', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'getBattle',
        type: 'function',
        inputs: [{ name: 'battleId', type: 'bytes32' }],
        outputs: [{
            name: '',
            type: 'tuple',
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
            ]
        }],
        stateMutability: 'view'
    },
    {
        name: 'isInBattle',
        type: 'function',
        inputs: [{ name: 'wallet', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view'
    },
    {
        name: 'getPlayerBattle',
        type: 'function',
        inputs: [{ name: 'wallet', type: 'address' }],
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'view'
    },
    {
        name: 'minStake',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'maxStake',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'emergencyRefund',
        type: 'function',
        inputs: [{ name: 'battleId', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    // Events for parsing
    {
        type: 'event',
        name: 'BattleCreated',
        inputs: [
            { name: 'battleId', type: 'bytes32', indexed: true },
            { name: 'host', type: 'address', indexed: true },
            { name: 'creatureId', type: 'uint256', indexed: false },
            { name: 'stakeAmount', type: 'uint256', indexed: false }
        ]
    }
] as const;

// ERC20 ABI for approval
const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
    },
    {
        name: 'allowance',
        type: 'function',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    }
] as const;

/**
 * Get stake limits from contract
 */
export function useStakeLimits() {
    const { data: minStake } = useReadContract({
        address: CONTRACTS.BATTLE_GATE_V2 as Address,
        abi: BATTLE_GATE_V2_ABI,
        functionName: 'minStake',
    });

    const { data: maxStake } = useReadContract({
        address: CONTRACTS.BATTLE_GATE_V2 as Address,
        abi: BATTLE_GATE_V2_ABI,
        functionName: 'maxStake',
    });

    return {
        minStake: minStake ?? parseEther('10'),
        maxStake: maxStake ?? parseEther('1000')
    };
}

/**
 * Get player's active battle and its state
 */
export function usePlayerActiveBattle() {
    const { address } = useAccount();

    // Get battle ID for player
    const { data: battleId, refetch: refetchBattleId } = useReadContract({
        address: CONTRACTS.BATTLE_GATE_V2 as Address,
        abi: BATTLE_GATE_V2_ABI,
        functionName: 'getPlayerBattle',
        args: address ? [address] : undefined,
    });

    // Get battle details if we have a battle ID
    const { data: battleData, refetch: refetchBattle } = useReadContract({
        address: CONTRACTS.BATTLE_GATE_V2 as Address,
        abi: BATTLE_GATE_V2_ABI,
        functionName: 'getBattle',
        args: battleId && battleId !== '0x0000000000000000000000000000000000000000000000000000000000000000'
            ? [battleId]
            : undefined,
    });

    const hasPendingBattle = battleId && battleId !== '0x0000000000000000000000000000000000000000000000000000000000000000';

    // BattleState: 0=NONE, 1=CREATED, 2=MATCHED, 3=RESOLVED, 4=CLAIMED, 5=EXPIRED
    const battleState = battleData ? Number((battleData as any).state) : 0;
    const canCancel = hasPendingBattle && battleState === 1; // CREATED
    const isResolved = hasPendingBattle && battleState === 3;  // RESOLVED
    const isHost = battleData && address && (battleData as any).host?.toLowerCase() === address.toLowerCase();

    // Check if player is the winner
    const winner = battleData ? (battleData as any).winner : undefined;
    const isWinner = winner && address && winner.toLowerCase() === address.toLowerCase();
    const canClaim = isResolved && isWinner; // Only show claim if player WON
    const didLose = isResolved && !isWinner && winner !== '0x0000000000000000000000000000000000000000';

    return {
        battleId: battleId as `0x${string}` | undefined,
        battleData: battleData as any,
        hasPendingBattle: !!hasPendingBattle,
        battleState,
        canCancel,
        canClaim,
        isWinner,
        didLose,
        isHost,
        refetch: () => { refetchBattleId(); refetchBattle(); }
    };
}

/**
 * Check if player is already in a battle
 */
export function useIsInBattle() {
    const { address } = useAccount();

    const { data, refetch } = useReadContract({
        address: CONTRACTS.BATTLE_GATE_V2 as Address,
        abi: BATTLE_GATE_V2_ABI,
        functionName: 'isInBattle',
        args: address ? [address] : undefined,
    });

    return {
        isInBattle: !!data,
        refetch
    };
}

/**
 * Get DGNE allowance for BattleGateV2
 */
export function useDGNEAllowance() {
    const { address } = useAccount();

    const { data, refetch } = useReadContract({
        address: CONTRACTS.DRAGON_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, CONTRACTS.BATTLE_GATE_V2 as Address] : undefined,
    });

    return {
        allowance: data ?? 0n,
        refetch
    };
}

/**
 * Main hook for battle operations
 */
export function useBattleGateV2() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, isPending } = useWriteContract();
    const { minStake, maxStake } = useStakeLimits();
    const { isInBattle, refetch: refetchBattleStatus } = useIsInBattle();
    const { allowance, refetch: refetchAllowance } = useDGNEAllowance();

    const [txStatus, setTxStatus] = useState<'idle' | 'approving' | 'creating' | 'joining' | 'claiming' | 'canceling'>('idle');

    /**
     * Approve DGNE for staking
     */
    const approveDGNE = useCallback(async (amount: bigint) => {
        setTxStatus('approving');
        try {
            const tx = await writeContractAsync({
                address: CONTRACTS.DRAGON_TOKEN as Address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.BATTLE_GATE_V2 as Address, amount],
            });
            // Wait for confirmation
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash: tx });
            }
            await refetchAllowance();
            return tx;
        } finally {
            setTxStatus('idle');
        }
    }, [writeContractAsync, publicClient, refetchAllowance]);

    /**
     * Create a new battle with stake
     * Returns battleId for socket room creation
     */
    const createBattle = useCallback(async (creatureId: bigint, stakeAmount: bigint): Promise<{ battleId: string; txHash: string }> => {
        if (!address) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Client not available');

        // Check allowance
        if (allowance < stakeAmount) {
            await approveDGNE(stakeAmount * 10n); // Approve 10x for convenience
        }

        setTxStatus('creating');
        try {
            const tx = await writeContractAsync({
                address: CONTRACTS.BATTLE_GATE_V2 as Address,
                abi: BATTLE_GATE_V2_ABI,
                functionName: 'createBattle',
                args: [creatureId, stakeAmount],
            });

            // Wait for receipt and extract battleId from event
            const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

            // Find BattleCreated event
            const battleCreatedLog = receipt.logs.find(log => {
                try {
                    const decoded = decodeEventLog({
                        abi: BATTLE_GATE_V2_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    return decoded.eventName === 'BattleCreated';
                } catch {
                    return false;
                }
            });

            if (!battleCreatedLog) {
                throw new Error('BattleCreated event not found in transaction');
            }

            const decoded = decodeEventLog({
                abi: BATTLE_GATE_V2_ABI,
                data: battleCreatedLog.data,
                topics: battleCreatedLog.topics,
            });

            const battleId = (decoded.args as any).battleId as string;

            await refetchBattleStatus();
            return { battleId, txHash: tx };
        } finally {
            setTxStatus('idle');
        }
    }, [address, publicClient, allowance, approveDGNE, writeContractAsync, refetchBattleStatus]);

    /**
     * Join an existing battle
     */
    const joinBattle = useCallback(async (battleId: string, creatureId: bigint, stakeAmount: bigint): Promise<{ txHash: string }> => {
        if (!address) throw new Error('Wallet not connected');
        if (!publicClient) throw new Error('Client not available');

        // Check allowance
        if (allowance < stakeAmount) {
            await approveDGNE(stakeAmount * 10n);
        }

        setTxStatus('joining');
        try {
            const tx = await writeContractAsync({
                address: CONTRACTS.BATTLE_GATE_V2 as Address,
                abi: BATTLE_GATE_V2_ABI,
                functionName: 'joinBattle',
                args: [battleId as `0x${string}`, creatureId],
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });
            await refetchBattleStatus();
            return { txHash: tx };
        } finally {
            setTxStatus('idle');
        }
    }, [address, publicClient, allowance, approveDGNE, writeContractAsync, refetchBattleStatus]);

    /**
     * Claim winnings after battle resolved
     */
    const claimWinnings = useCallback(async (battleId: string): Promise<{ txHash: string }> => {
        if (!publicClient) throw new Error('Client not available');

        setTxStatus('claiming');
        try {
            const tx = await writeContractAsync({
                address: CONTRACTS.BATTLE_GATE_V2 as Address,
                abi: BATTLE_GATE_V2_ABI,
                functionName: 'claimWinnings',
                args: [battleId as `0x${string}`],
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });
            await refetchBattleStatus();
            return { txHash: tx };
        } finally {
            setTxStatus('idle');
        }
    }, [publicClient, writeContractAsync, refetchBattleStatus]);

    /**
     * Cancel a battle (host only, before guest joins)
     */
    const cancelBattle = useCallback(async (battleId: string): Promise<{ txHash: string }> => {
        if (!publicClient) throw new Error('Client not available');

        setTxStatus('canceling');
        try {
            const tx = await writeContractAsync({
                address: CONTRACTS.BATTLE_GATE_V2 as Address,
                abi: BATTLE_GATE_V2_ABI,
                functionName: 'cancelBattle',
                args: [battleId as `0x${string}`],
                gas: BigInt(500000),  // Explicit gas limit to avoid estimation issues
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });
            await refetchBattleStatus();
            return { txHash: tx };
        } finally {
            setTxStatus('idle');
        }
    }, [publicClient, writeContractAsync, refetchBattleStatus]);

    return {
        // State
        isInBattle,
        isPending,
        txStatus,

        // Limits
        minStake,
        maxStake,

        // Allowance
        allowance,
        approveDGNE,
        refetchAllowance,

        // Actions
        createBattle,
        joinBattle,
        claimWinnings,
        cancelBattle,
        emergencyRefund,

        // Refetch
        refetchBattleStatus
    };

    /**
     * Emergency refund for stuck battles (admin/owner only)
     */
    async function emergencyRefund(battleId: string): Promise<{ txHash: string }> {
        if (!publicClient) throw new Error('Client not available');

        setTxStatus('canceling');
        try {
            const tx = await writeContractAsync({
                address: CONTRACTS.BATTLE_GATE_V2 as Address,
                abi: BATTLE_GATE_V2_ABI,
                functionName: 'emergencyRefund',
                args: [battleId as `0x${string}`],
                gas: BigInt(500000),
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });
            await refetchBattleStatus();
            return { txHash: tx };
        } finally {
            setTxStatus('idle');
        }
    }
}

export default useBattleGateV2;
