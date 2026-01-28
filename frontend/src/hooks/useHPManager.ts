/**
 * useHPManager Hook
 * Interacts with HPManager contract for HP queries and instant heal
 */

import { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';

// HPManager contract address (deployed on localhost)
const HP_MANAGER_ADDRESS = '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584' as const;

// Simplified ABI - only what we need
const HP_MANAGER_ABI = [
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getHP',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getHealCost',
        outputs: [
            { name: 'cost', type: 'uint256' },
            { name: 'hpToHeal', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'instantHeal',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'healCostPer10Percent',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'hpRecoveryRatePerHour',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

// DGNE Token for approval - use the contract where tokens actually exist!
const DGNE_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F' as const;
const DGNE_ABI = [
    {
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

export interface HPInfo {
    currentHP: number;
    healCost: bigint;
    hpToHeal: number;
    recoveryRate: number; // % per hour
}

export function useCreatureHP(tokenId: string | null) {
    const [hpInfo, setHpInfo] = useState<HPInfo | null>(null);

    // Read current HP
    const { data: currentHP, refetch: refetchHP } = useReadContract({
        address: HP_MANAGER_ADDRESS,
        abi: HP_MANAGER_ABI,
        functionName: 'getHP',
        args: tokenId ? [BigInt(tokenId)] : undefined,
        query: { enabled: !!tokenId }
    });

    // Read heal cost
    const { data: healCostData } = useReadContract({
        address: HP_MANAGER_ADDRESS,
        abi: HP_MANAGER_ABI,
        functionName: 'getHealCost',
        args: tokenId ? [BigInt(tokenId)] : undefined,
        query: { enabled: !!tokenId }
    });

    // Read recovery rate
    const { data: recoveryRate } = useReadContract({
        address: HP_MANAGER_ADDRESS,
        abi: HP_MANAGER_ABI,
        functionName: 'hpRecoveryRatePerHour',
    });

    useEffect(() => {
        if (currentHP !== undefined) {
            setHpInfo({
                currentHP: Number(currentHP),
                healCost: healCostData ? (healCostData as any)[0] : BigInt(0),
                hpToHeal: healCostData ? Number((healCostData as any)[1]) : 0,
                recoveryRate: recoveryRate ? Number(recoveryRate) : 5,
            });
        }
    }, [currentHP, healCostData, recoveryRate]);

    return { hpInfo, refetchHP };
}

export function useInstantHeal() {
    const { address } = useAccount();
    const [isHealing, setIsHealing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Approve DGNE for HPManager
    const {
        writeContract: approveWrite,
        data: approveTxHash
    } = useWriteContract();

    const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({
        hash: approveTxHash as `0x${string}` | undefined,
    });

    // Call instantHeal
    const {
        writeContract: healWrite,
        data: healTxHash
    } = useWriteContract();

    const { isSuccess: healSuccess } = useWaitForTransactionReceipt({
        hash: healTxHash as `0x${string}` | undefined,
    });

    // Check current allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: DGNE_ADDRESS,
        abi: DGNE_ABI,
        functionName: 'allowance',
        args: address ? [address, HP_MANAGER_ADDRESS] : undefined,
        query: { enabled: !!address }
    });

    const heal = useCallback(async (tokenId: string, healCost: bigint) => {
        if (!address) {
            setError('Wallet not connected');
            return false;
        }

        setIsHealing(true);
        setError(null);

        try {
            // Check if we need to approve
            const currentAllowance = allowance || BigInt(0);

            if (currentAllowance < healCost) {
                console.log('[Heal] Approving DGNE spend...');
                approveWrite({
                    address: DGNE_ADDRESS,
                    abi: DGNE_ABI,
                    functionName: 'approve',
                    args: [HP_MANAGER_ADDRESS, healCost * BigInt(2)], // Approve 2x for buffer
                });

                // Wait a bit for approval
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Call instant heal with explicit gas to prevent estimation errors
            console.log(`[Heal] Healing creature #${tokenId}...`);
            healWrite({
                address: HP_MANAGER_ADDRESS,
                abi: HP_MANAGER_ABI,
                functionName: 'instantHeal',
                args: [BigInt(tokenId)],
                gas: 200000n, // Explicit gas limit
            });

            return true;
        } catch (err: any) {
            console.error('[Heal] Error:', err);
            setError(err.message || 'Heal failed');
            return false;
        } finally {
            setIsHealing(false);
        }
    }, [address, allowance, approveWrite, healWrite]);

    return {
        heal,
        isHealing,
        error,
        isSuccess: healSuccess,
        txHash: healTxHash
    };
}

export { HP_MANAGER_ADDRESS };
