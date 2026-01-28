import { useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '../contracts/config';
import './StakingScreen.css';

// Simplified ABI for staking
const STAKING_ABI = [
    {
        name: 'stake',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'talent', type: 'uint8' }],
        outputs: []
    },
    {
        name: 'unstake',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: []
    },
    {
        name: 'claimTokens',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: []
    },
    {
        name: 'claimAll',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: []
    },
    {
        name: 'getStakedTokens',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256[]' }]
    },
    {
        name: 'pendingRewards',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'totalPendingRewards',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    }
] as const;

// GameConfig ABI for reading staking params
const GAME_CONFIG_ABI = [
    { name: 'stakingBaseRate', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'talentMultiplier', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export function StakingScreen() {
    const { address, isConnected } = useAccount();

    const { writeContract, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

    // Get staked tokens
    const { data: stakedTokenIds, refetch: refetchStaked } = useReadContract({
        address: CONTRACTS.DRAGON_STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'getStakedTokens',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    // Get total pending rewards
    const { data: totalPending, refetch: refetchPending } = useReadContract({
        address: CONTRACTS.DRAGON_STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'totalPendingRewards',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    // Read staking params from GameConfig
    const { data: stakingBaseRate } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'stakingBaseRate',
    });
    const { data: talentMultiplier } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'talentMultiplier',
    });

    const baseRateDisplay = stakingBaseRate ? (Number(stakingBaseRate) / 1e18).toFixed(0) : '...';
    const multiplierDisplay = talentMultiplier?.toString() || '100';

    // Refetch on success
    useEffect(() => {
        if (isSuccess) {
            refetchStaked();
            refetchPending();
        }
    }, [isSuccess, refetchStaked, refetchPending]);

    const handleClaimAll = () => {
        writeContract({
            address: CONTRACTS.DRAGON_STAKING as `0x${string}`,
            abi: STAKING_ABI,
            functionName: 'claimAll'
        });
    };

    const handleUnstake = (tokenId: bigint) => {
        writeContract({
            address: CONTRACTS.DRAGON_STAKING as `0x${string}`,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [tokenId]
        });
    };

    const formatTokenAmount = (amount: bigint | undefined) => {
        if (!amount) return '0.00';
        const formatted = Number(amount) / 1e18;
        return formatted.toFixed(4);
    };

    if (!isConnected) {
        return (
            <div className="staking-screen">
                <div className="staking-container">
                    <h1>🐉 Dragon Staking</h1>
                    <p className="connect-message">Connect your wallet to view staking</p>
                </div>
            </div>
        );
    }

    // Check if staking contract is deployed
    const stakingNotDeployed = !CONTRACTS.DRAGON_STAKING || CONTRACTS.DRAGON_STAKING.length === 0;

    return (
        <div className="staking-screen">
            <div className="staking-container">
                <h1>🐉 Dragon Staking</h1>

                {stakingNotDeployed ? (
                    <div className="coming-soon">
                        <h2>🚧 Coming Soon</h2>
                        <p>Dragon Staking contracts are not yet deployed.</p>
                    </div>
                ) : (
                    <>
                        {/* Summary Card */}
                        <div className="staking-summary">
                            <div className="summary-stat">
                                <span className="stat-label">Staked Dragons</span>
                                <span className="stat-value">{stakedTokenIds?.length || 0}</span>
                            </div>
                            <div className="summary-stat">
                                <span className="stat-label">Pending Rewards</span>
                                <span className="stat-value highlight">{formatTokenAmount(totalPending)} DGNE</span>
                            </div>
                            <button
                                className="claim-all-btn"
                                onClick={handleClaimAll}
                                disabled={!totalPending || totalPending === 0n || isPending || isConfirming}
                            >
                                {isPending || isConfirming ? 'Processing...' : 'Claim All'}
                            </button>
                        </div>

                        {/* Staking Formula */}
                        <div className="staking-formula">
                            <h3>📊 Current Staking Rate</h3>
                            <div className="formula-box">
                                <code>Daily Rate = {baseRateDisplay} × (1 + Talent/{multiplierDisplay})</code>
                            </div>
                            <p className="formula-example">
                                Example: Talent 50 → {baseRateDisplay} × 1.5 = <strong>{(Number(baseRateDisplay) * 1.5).toFixed(0)} DGNE/day</strong>
                            </p>
                        </div>

                        {/* How it works */}
                        <div className="staking-info">
                            <h3>💡 How Staking Works</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="info-icon">📈</span>
                                    <div>
                                        <strong>Talent-based rewards</strong>
                                        <p>Higher talent = more DGNE per day</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">🎁</span>
                                    <div>
                                        <strong>Claim anytime</strong>
                                        <p>No need to unstake to get rewards</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">🔓</span>
                                    <div>
                                        <strong>No lock period</strong>
                                        <p>Unstake anytime for battles</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">⚡</span>
                                    <div>
                                        <strong>Use DGNE for</strong>
                                        <p>Minting, healing, battles</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Staked Dragons List */}
                        <div className="staked-list">
                            <h2>Your Staked Dragons</h2>
                            {stakedTokenIds && stakedTokenIds.length > 0 ? (
                                <div className="staked-grid">
                                    {stakedTokenIds.map((tokenId) => (
                                        <div key={tokenId.toString()} className="staked-card">
                                            <div className="staked-info">
                                                <span className="staked-id">Dragon #{tokenId.toString()}</span>
                                            </div>
                                            <button
                                                className="unstake-btn"
                                                onClick={() => handleUnstake(tokenId)}
                                                disabled={isPending || isConfirming}
                                            >
                                                Unstake
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-staked">No dragons staked yet. Stake your dragons from the My Creatures page!</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default StakingScreen;
