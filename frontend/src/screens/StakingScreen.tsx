import { useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '../contracts/config';
import './StakingScreen.css';

// Constants for emission calculations
const YEARLY_EMISSION = 2_000_000; // Fixed cap: 2M DGNE per year
const DAILY_EMISSION = YEARLY_EMISSION / 365; // ~5,479 DGNE per day

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
    },
    {
        name: 'totalStakedCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'totalTalentSum',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    }
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

    // Get global staking stats
    const { data: totalStakedCount } = useReadContract({
        address: CONTRACTS.DRAGON_STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'totalStakedCount',
    });

    const { data: totalTalentSum } = useReadContract({
        address: CONTRACTS.DRAGON_STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'totalTalentSum',
    });

    // Calculate estimated DGNE per dragon per day (average)
    const globalStaked = Number(totalStakedCount ?? 1n);
    const avgDgnePerDragon = globalStaked > 0 ? DAILY_EMISSION / globalStaked : DAILY_EMISSION;

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

    const formatNumber = (num: number) => {
        return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
                        {/* Global Statistics */}
                        <div className="global-stats">
                            <h3>📊 Global Staking Statistics</h3>
                            <div className="stats-grid">
                                <div className="stat-box">
                                    <span className="stat-icon">🐉</span>
                                    <span className="stat-value">{globalStaked}</span>
                                    <span className="stat-label">Dragons Staked</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-icon">💰</span>
                                    <span className="stat-value">{formatNumber(DAILY_EMISSION)}</span>
                                    <span className="stat-label">DGNE/Day (Fixed)</span>
                                </div>
                                <div className="stat-box highlight">
                                    <span className="stat-icon">📈</span>
                                    <span className="stat-value">~{formatNumber(avgDgnePerDragon)}</span>
                                    <span className="stat-label">Est. DGNE/Dragon/Day</span>
                                </div>
                            </div>
                        </div>

                        {/* Your Summary Card */}
                        <div className="staking-summary">
                            <h3>Your Staking Summary</h3>
                            <div className="summary-row">
                                <div className="summary-stat">
                                    <span className="stat-label">Your Staked Dragons</span>
                                    <span className="stat-value">{stakedTokenIds?.length || 0}</span>
                                </div>
                                <div className="summary-stat">
                                    <span className="stat-label">Pending Rewards</span>
                                    <span className="stat-value highlight">{formatTokenAmount(totalPending)} DGNE</span>
                                </div>
                            </div>
                            <button
                                className="claim-all-btn"
                                onClick={handleClaimAll}
                                disabled={!totalPending || totalPending === 0n || isPending || isConfirming}
                            >
                                {isPending || isConfirming ? 'Processing...' : 'Claim All Rewards'}
                            </button>
                        </div>

                        {/* Emission Cap Explanation */}
                        <div className="info-section emission-cap">
                            <h3>🔒 Global Emission Cap</h3>
                            <div className="cap-highlight">
                                <span className="cap-value">2,000,000</span>
                                <span className="cap-label">DGNE per Year (Fixed Maximum)</span>
                            </div>
                            <div className="cap-details">
                                <p>
                                    The total DGNE that can be distributed through staking is <strong>capped at 2,000,000 DGNE per year</strong>.
                                    This emission is divided equally across 365 days.
                                </p>
                                <div className="formula-box">
                                    <code>Daily Emission = 2,000,000 ÷ 365 = <strong>~{formatNumber(DAILY_EMISSION)} DGNE</strong></code>
                                </div>
                            </div>
                        </div>

                        {/* Distribution Explanation */}
                        <div className="info-section distribution">
                            <h3>⚖️ How Distribution Works</h3>
                            <div className="distribution-grid">
                                <div className="distribution-item">
                                    <span className="dist-icon">1️⃣</span>
                                    <div>
                                        <strong>Fixed Daily Pool</strong>
                                        <p>Each day, exactly ~{formatNumber(DAILY_EMISSION)} DGNE is available for distribution</p>
                                    </div>
                                </div>
                                <div className="distribution-item">
                                    <span className="dist-icon">2️⃣</span>
                                    <div>
                                        <strong>Proportional Shares</strong>
                                        <p>All staked dragons share this pool based on their Talent Multiplier</p>
                                    </div>
                                </div>
                                <div className="distribution-item">
                                    <span className="dist-icon">3️⃣</span>
                                    <div>
                                        <strong>Talent Advantage</strong>
                                        <p>Higher talent = larger share of the daily pool (not more total emission)</p>
                                    </div>
                                </div>
                                <div className="distribution-item">
                                    <span className="dist-icon">4️⃣</span>
                                    <div>
                                        <strong>Dynamic Estimates</strong>
                                        <p>More dragons staking = smaller share per dragon. Fewer = larger share.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Rate Warning */}
                        <div className="info-section warning-box">
                            <h3>⚠️ Important: Estimates are Dynamic</h3>
                            <p>
                                The "DGNE per day" shown for a dragon is an <strong>estimate</strong> calculated using
                                the current number of staked dragons.
                            </p>
                            <ul>
                                <li>If more dragons enter staking → DGNE per dragon <strong>decreases</strong></li>
                                <li>If dragons leave staking → DGNE per dragon <strong>increases</strong></li>
                            </ul>
                            <p>The value updates dynamically based on global participation.</p>
                        </div>

                        {/* Manual Claim Explanation */}
                        <div className="info-section claim-info">
                            <h3>🎁 Manual Claim System</h3>
                            <div className="claim-grid">
                                <div className="claim-item">
                                    <span className="claim-icon">✓</span>
                                    <span>DGNE is <strong>not</strong> auto-distributed</span>
                                </div>
                                <div className="claim-item">
                                    <span className="claim-icon">✓</span>
                                    <span>You must <strong>manually claim</strong> your rewards</span>
                                </div>
                                <div className="claim-item">
                                    <span className="claim-icon">✓</span>
                                    <span>Claiming transfers DGNE to your wallet balance</span>
                                </div>
                                <div className="claim-item">
                                    <span className="claim-icon">✓</span>
                                    <span>Claiming does <strong>not</strong> affect other players</span>
                                </div>
                                <div className="claim-item">
                                    <span className="claim-icon">✓</span>
                                    <span>Unclaimed DGNE remains pending (no expiration)</span>
                                </div>
                                <div className="claim-item">
                                    <span className="claim-icon">✓</span>
                                    <span>No penalties, no auto-claim</span>
                                </div>
                            </div>
                        </div>

                        {/* Anti-Abuse Section */}
                        <div className="info-section anti-abuse">
                            <h3>🛡️ Anti-Abuse Design</h3>
                            <div className="abuse-grid">
                                <div className="abuse-item">
                                    <span className="abuse-icon">🔒</span>
                                    <span>Emission is <strong>capped</strong> — no infinite rewards</span>
                                </div>
                                <div className="abuse-item">
                                    <span className="abuse-icon">🚫</span>
                                    <span><strong>No compounding</strong> — rewards do not earn rewards</span>
                                </div>
                                <div className="abuse-item">
                                    <span className="abuse-icon">⏱️</span>
                                    <span><strong>No acceleration</strong> — time is the only factor</span>
                                </div>
                                <div className="abuse-item">
                                    <span className="abuse-icon">📊</span>
                                    <span>Staking <strong>redistributes</strong> DGNE over time, it does not create value</span>
                                </div>
                            </div>
                        </div>

                        {/* Staking Rules */}
                        <div className="info-section staking-rules">
                            <h3>📜 Staking Rules</h3>
                            <div className="rules-grid">
                                <div className="rule-item">
                                    <span className="rule-icon">🔓</span>
                                    <div>
                                        <strong>Staking is Optional</strong>
                                        <p>You choose which dragons to stake</p>
                                    </div>
                                </div>
                                <div className="rule-item">
                                    <span className="rule-icon">⚔️</span>
                                    <div>
                                        <strong>Staked Dragons Cannot Battle</strong>
                                        <p>Unstake first to use in combat</p>
                                    </div>
                                </div>
                                <div className="rule-item">
                                    <span className="rule-icon">🎯</span>
                                    <div>
                                        <strong>Talent Matters</strong>
                                        <p>Higher talent = larger share of daily pool</p>
                                    </div>
                                </div>
                                <div className="rule-item">
                                    <span className="rule-icon">🔄</span>
                                    <div>
                                        <strong>No Lock Period</strong>
                                        <p>Unstake anytime without penalty</p>
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
