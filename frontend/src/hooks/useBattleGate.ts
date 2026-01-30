/**
 * useBattleGate - Hook for battle entry fee and rewards
 * 
 * Handles:
 * - Checking if player can afford entry fee
 * - Approving token spending
 * - Paying entry fee
 * - Reading entry costs and rewards
 */

import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { keccak256, encodePacked, Address } from 'viem';
import { useCallback } from 'react';
import { CONTRACTS } from '../contracts/config';

// BattleGate ABI (minimal for what we need)
const BATTLE_GATE_ABI = [
    {
        name: 'payEntryFee',
        type: 'function',
        inputs: [
            { name: 'creatureId', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'getEntryCost',
        type: 'function',
        inputs: [],
        outputs: [
            { name: 'dgneCost', type: 'uint256' },
            { name: 'rmrkCost', type: 'uint256' },
            { name: 'reward', type: 'uint256' }
        ],
        stateMutability: 'view'
    },
    {
        name: 'canEnterBattle',
        type: 'function',
        inputs: [{ name: 'player', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view'
    }
] as const;

// ERC20 approval ABI
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
    },
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    }
] as const;

/**
 * Get entry costs and reward from config
 */
export function useEntryCost() {
    const { data, isLoading, refetch } = useReadContract({
        address: CONTRACTS.BATTLE_GATE as Address,
        abi: BATTLE_GATE_ABI,
        functionName: 'getEntryCost',
    });

    return {
        dgneCost: data?.[0] ?? 0n,
        rmrkCost: data?.[1] ?? 0n,
        reward: data?.[2] ?? 0n,
        isLoading,
        refetch
    };
}

/**
 * Check if player can enter battle (has enough tokens)
 */
export function useCanEnterBattle() {
    const { address } = useAccount();

    const { data, isLoading, refetch } = useReadContract({
        address: CONTRACTS.BATTLE_GATE as Address,
        abi: BATTLE_GATE_ABI,
        functionName: 'canEnterBattle',
        args: address ? [address] : undefined,
    });

    return {
        canEnter: !!data,
        isLoading,
        refetch
    };
}

/**
 * Get token balances (including locked balance from AirdropVault)
 */
export function useTokenBalances() {
    const { address } = useAccount();

    const { data: dgneBalance } = useReadContract({
        address: CONTRACTS.DRAGON_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const { data: rmrkBalance } = useReadContract({
        address: CONTRACTS.MOCK_RMRK as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    // Also get locked balance from AirdropVault (can be spent for battles)
    const { data: lockedDgne } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT as Address,
        abi: [
            {
                name: 'getLockedBalance',
                type: 'function',
                inputs: [{ name: 'user', type: 'address' }],
                outputs: [{ name: 'balance', type: 'uint256' }],
                stateMutability: 'view'
            }
        ] as const,
        functionName: 'getLockedBalance',
        args: address ? [address] : undefined,
    });

    // Effective DGNE = wallet balance + locked balance (both usable for battles)
    const effectiveDgneBalance = (dgneBalance ?? 0n) + (lockedDgne ?? 0n);

    return {
        dgneBalance: effectiveDgneBalance,  // Combined balance for battle eligibility
        walletDgneBalance: dgneBalance ?? 0n,  // Just wallet balance
        lockedDgneBalance: lockedDgne ?? 0n,  // Just locked balance
        rmrkBalance: rmrkBalance ?? 0n
    };
}

/**
 * Get token allowances for BattleGate
 */
export function useTokenAllowances() {
    const { address } = useAccount();

    const { data: dgneAllowance, refetch: refetchDgne } = useReadContract({
        address: CONTRACTS.DRAGON_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, CONTRACTS.BATTLE_GATE as Address] : undefined,
    });

    const { data: rmrkAllowance, refetch: refetchRmrk } = useReadContract({
        address: CONTRACTS.MOCK_RMRK as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, CONTRACTS.BATTLE_GATE as Address] : undefined,
    });

    return {
        dgneAllowance: dgneAllowance ?? 0n,
        rmrkAllowance: rmrkAllowance ?? 0n,
        refetch: () => { refetchDgne(); refetchRmrk(); }
    };
}

/**
 * Approve tokens for BattleGate spending
 */
export function useApproveTokens() {
    const { writeContractAsync } = useWriteContract();
    const { dgneCost, rmrkCost } = useEntryCost();

    const approveDGNE = useCallback(async () => {
        return writeContractAsync({
            address: CONTRACTS.DRAGON_TOKEN as Address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACTS.BATTLE_GATE as Address, dgneCost * 100n], // Approve 100x for convenience
        });
    }, [writeContractAsync, dgneCost]);

    const approveRMRK = useCallback(async () => {
        return writeContractAsync({
            address: CONTRACTS.MOCK_RMRK as Address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACTS.BATTLE_GATE as Address, rmrkCost * 100n],
        });
    }, [writeContractAsync, rmrkCost]);

    return { approveDGNE, approveRMRK };
}

/**
 * Pay entry fee for battle
 */
export function usePayEntryFee() {
    const { writeContractAsync, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const generateNonce = useCallback(() => {
        // Generate unique nonce based on timestamp + random
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        return keccak256(encodePacked(['uint256', 'uint256'], [BigInt(timestamp), BigInt(random)]));
    }, []);

    const payEntryFee = useCallback(async (creatureId: bigint) => {
        const nonce = generateNonce();

        const tx = await writeContractAsync({
            address: CONTRACTS.BATTLE_GATE as Address,
            abi: BATTLE_GATE_ABI,
            functionName: 'payEntryFee',
            args: [creatureId, nonce],
        });

        return { tx, nonce };
    }, [writeContractAsync, generateNonce]);

    return {
        payEntryFee,
        isPending,
        isConfirming,
        isSuccess,
        hash
    };
}

/**
 * Combined hook for full battle entry flow
 */
export function useBattleEntry() {
    const { canEnter, isLoading: checkingEligibility } = useCanEnterBattle();
    const { dgneCost, rmrkCost, reward } = useEntryCost();
    const { dgneBalance, rmrkBalance } = useTokenBalances();
    const { dgneAllowance, rmrkAllowance, refetch: refetchAllowances } = useTokenAllowances();
    const { approveDGNE, approveRMRK } = useApproveTokens();
    const { payEntryFee, isPending, isConfirming } = usePayEntryFee();

    const needsDgneApproval = dgneAllowance < dgneCost;
    const needsRmrkApproval = rmrkAllowance < rmrkCost;
    const hasEnoughDgne = dgneBalance >= dgneCost;
    const hasEnoughRmrk = rmrkBalance >= rmrkCost;

    return {
        // State
        canEnter,
        checkingEligibility,
        isPending,
        isConfirming,

        // Costs
        dgneCost,
        rmrkCost,
        reward,

        // Balances
        dgneBalance,
        rmrkBalance,
        hasEnoughDgne,
        hasEnoughRmrk,

        // Approvals
        needsDgneApproval,
        needsRmrkApproval,
        approveDGNE,
        approveRMRK,
        refetchAllowances,

        // Entry
        payEntryFee
    };
}
