import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { CONTRACTS } from '../contracts/config';
import './AirdropScreen.css';

// AirdropVault ABI
const AIRDROP_VAULT_ABI = [
    {
        inputs: [],
        name: 'claim',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'hasUserClaimed',
        outputs: [{ name: 'claimed', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getLockedBalance',
        outputs: [{ name: 'balance', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getPoolBalance',
        outputs: [{ name: 'available', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getStats',
        outputs: [
            { name: 'distributed', type: 'uint256' },
            { name: 'recycled', type: 'uint256' },
            { name: 'sentToWinBoost', type: 'uint256' },
            { name: 'claimers', type: 'uint256' },
            { name: 'poolBalance', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'CLAIM_AMOUNT',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

function AirdropScreen() {
    const { address, isConnected } = useAccount();
    const [claimError, setClaimError] = useState<string | null>(null);

    const isVaultDeployed = CONTRACTS.AIRDROP_VAULT !== '0x0000000000000000000000000000000000000000';

    // Read contract data
    const { data: hasClaimed, refetch: refetchClaimed } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT,
        abi: AIRDROP_VAULT_ABI,
        functionName: 'hasUserClaimed',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && isVaultDeployed && !!address },
    });

    const { data: lockedBalance, refetch: refetchBalance } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT,
        abi: AIRDROP_VAULT_ABI,
        functionName: 'getLockedBalance',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && isVaultDeployed && !!address },
    });

    const { data: poolBalance } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT,
        abi: AIRDROP_VAULT_ABI,
        functionName: 'getPoolBalance',
        query: { enabled: isVaultDeployed },
    });

    const { data: stats } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT,
        abi: AIRDROP_VAULT_ABI,
        functionName: 'getStats',
        query: { enabled: isVaultDeployed },
    });

    // Write contract
    const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Refresh data after successful claim
    useEffect(() => {
        if (isConfirmed) {
            refetchClaimed();
            refetchBalance();
            setClaimError(null);
        }
    }, [isConfirmed, refetchClaimed, refetchBalance]);

    useEffect(() => {
        if (writeError) {
            setClaimError(writeError.message);
        }
    }, [writeError]);

    const handleClaim = () => {
        setClaimError(null);
        writeContract({
            address: CONTRACTS.AIRDROP_VAULT,
            abi: AIRDROP_VAULT_ABI,
            functionName: 'claim',
        });
    };

    const formatNumber = (value: bigint | undefined) => {
        if (!value) return '0';
        return Number(formatEther(value)).toLocaleString();
    };

    return (
        <div className="airdrop-screen">
            <div className="airdrop-container">
                {/* Header */}
                <header className="airdrop-header">
                    <h1><span className="header-icon">🪂</span> <span className="header-text">Airdrop / Initial Access Distribution</span></h1>
                    <p className="airdrop-subtitle">
                        Access mechanism for new players entering Dragon Supremacy
                    </p>
                </header>

                {/* Claim Section */}
                <section className="airdrop-section claim-section">
                    <h2>🎁 Claim Your DGNE</h2>

                    {!isVaultDeployed ? (
                        <div className="claim-box not-deployed">
                            <span className="claim-icon">⏳</span>
                            <h3>Coming Soon</h3>
                            <p>The airdrop contract is not yet deployed. Check back soon!</p>
                        </div>
                    ) : !isConnected ? (
                        <div className="claim-box not-connected">
                            <span className="claim-icon">🔗</span>
                            <h3>Connect Your Wallet</h3>
                            <p>Connect your wallet to check eligibility and claim your DGNE.</p>
                        </div>
                    ) : hasClaimed ? (
                        <div className="claim-box already-claimed">
                            <span className="claim-icon">✅</span>
                            <h3>Already Claimed</h3>
                            <p>You have already claimed your airdrop allocation.</p>
                            <div className="locked-balance-display">
                                <span className="balance-label">Your Locked Balance:</span>
                                <span className="balance-value">{formatNumber(lockedBalance)} DGNE</span>
                            </div>
                        </div>
                    ) : (
                        <div className="claim-box eligible">
                            <span className="claim-icon">🎉</span>
                            <h3>You're Eligible!</h3>
                            <p>Claim <strong>5,100 DGNE</strong> to start your Dragon Supremacy journey.</p>

                            <button
                                className="claim-button"
                                onClick={handleClaim}
                                disabled={isPending || isConfirming}
                            >
                                {isPending ? 'Confirm in Wallet...' :
                                    isConfirming ? 'Claiming...' :
                                        '🪂 Claim 5,100 DGNE'}
                            </button>

                            {claimError && (
                                <div className="claim-error">
                                    <span>⚠️</span> {claimError}
                                </div>
                            )}

                            {isConfirmed && (
                                <div className="claim-success">
                                    <span>✅</span> Successfully claimed! Check your locked balance above.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pool Stats */}
                    {isVaultDeployed && stats && (
                        <div className="pool-stats">
                            <div className="stat-item">
                                <span className="stat-label">Pool Balance</span>
                                <span className="stat-value">{formatNumber(poolBalance)} DGNE</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Total Claimed</span>
                                <span className="stat-value">{stats[3]?.toString() || '0'} users</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Recycled</span>
                                <span className="stat-value">{formatNumber(stats[1])} DGNE</span>
                            </div>
                        </div>
                    )}
                </section>

                {/* Section 1: What the Airdrop Is */}
                <section className="airdrop-section">
                    <h2>1. What the Airdrop Is</h2>
                    <p className="section-intro">
                        The airdrop is an initial access mechanism designed to enable new players to enter the game.
                        It is not a reward, giveaway, or promotional distribution.
                    </p>

                    <div className="purpose-grid">
                        <div className="purpose-card">
                            <span className="purpose-icon">🐉</span>
                            <h3>Mint First Dragon</h3>
                            <p>Receive enough DGNE to generate your first dragon NFT</p>
                        </div>
                        <div className="purpose-card">
                            <span className="purpose-icon">🎮</span>
                            <h3>Enter the Game</h3>
                            <p>Access the in-game economy and core features</p>
                        </div>
                        <div className="purpose-card">
                            <span className="purpose-icon">⚔️</span>
                            <h3>Participate in Battles</h3>
                            <p>Start competing in PvP matches immediately</p>
                        </div>
                    </div>

                    <div className="clarification-box">
                        <span className="clarification-icon">ℹ️</span>
                        <div className="clarification-content">
                            <p>
                                The airdrop exists to grant access to gameplay, not to distribute liquid assets.
                                It is strictly an onboarding tool.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 2: Airdrop Amount */}
                <section className="airdrop-section">
                    <h2>2. Airdrop Amount</h2>

                    <div className="highlight-box primary">
                        <div className="highlight-number">5,100</div>
                        <div className="highlight-label">DGNE per Eligible User</div>
                    </div>

                    <div className="token-status">
                        <div className="status-badge locked">🔒 Locked</div>
                        <div className="status-badge locked">📵 Non-transferable</div>
                        <div className="status-badge locked">🚫 Cannot be sold</div>
                        <div className="status-badge active">🎮 Usable only in-game</div>
                    </div>

                    <h3 className="subsection-title">Calibration Purpose</h3>
                    <div className="calibration-list">
                        <div className="calibration-item">
                            <span className="calibration-icon">🎯</span>
                            <span>Mint exactly one dragon (5,000 DGNE cost)</span>
                        </div>
                        <div className="calibration-item">
                            <span className="calibration-icon">💎</span>
                            <span>Leave a small balance (100 DGNE) for initial battles and fees</span>
                        </div>
                    </div>
                </section>

                {/* Section 3: Mint Flow and Recycling Mechanism */}
                <section className="airdrop-section">
                    <h2>3. Mint Flow and Recycling Mechanism</h2>
                    <p className="section-intro">
                        When a user mints a dragon (cost: 5,000 DGNE), the funds are distributed as follows:
                    </p>

                    <div className="flow-diagram">
                        <div className="flow-step">
                            <div className="flow-amount">3,500 DGNE</div>
                            <div className="flow-arrow">→</div>
                            <div className="flow-destination">
                                <strong>Airdrop Pool</strong>
                                <span>Used to fund future airdrop access</span>
                                <span className="flow-detail">Enables recursive onboarding of new players</span>
                            </div>
                        </div>
                        <div className="flow-step">
                            <div className="flow-amount">1,600 DGNE</div>
                            <div className="flow-arrow">→</div>
                            <div className="flow-destination">
                                <strong>Win Boost Pool</strong>
                                <span>Used to temporarily increase battle rewards</span>
                            </div>
                        </div>
                    </div>

                    <div className="note-box">
                        <span className="note-icon">♻️</span>
                        <p>
                            <strong>Conservation principle:</strong> No DGNE disappears and no new DGNE is created.
                            The total supply remains fixed at 100,000,000 DGNE.
                        </p>
                    </div>
                </section>

                {/* Section 4: Recursive Airdrop Logic */}
                <section className="airdrop-section">
                    <h2>4. Recursive Airdrop Logic</h2>
                    <p className="section-intro">
                        The airdrop mechanism is designed to be recyclable, creating a self-sustaining onboarding system.
                    </p>

                    <div className="recursive-grid">
                        <div className="recursive-card">
                            <span className="recursive-icon">🔄</span>
                            <h3>Self-Funding</h3>
                            <p>Each dragon minted returns 3,500 DGNE to the Airdrop Pool</p>
                        </div>
                        <div className="recursive-card">
                            <span className="recursive-icon">📊</span>
                            <h3>Multiple Waves</h3>
                            <p>The system can onboard multiple waves of users over time</p>
                        </div>
                        <div className="recursive-card">
                            <span className="recursive-icon">📉</span>
                            <h3>Gradual Depletion</h3>
                            <p>The airdrop pool depletes gradually, not instantly</p>
                        </div>
                    </div>

                    <div className="capacity-box">
                        <div className="capacity-number">~12,500</div>
                        <div className="capacity-label">Maximum Users</div>
                        <p>Under full participation, the system can onboard approximately 12,500 users through the recursive mechanism</p>
                    </div>
                </section>

                {/* Section 5: Win Boost Pool */}
                <section className="airdrop-section">
                    <h2>5. Win Boost Pool</h2>
                    <p className="section-intro">
                        The Win Boost Pool enhances battle rewards temporarily during the early phases of the game.
                    </p>

                    <div className="boost-mechanics">
                        <div className="boost-card">
                            <span className="boost-icon">🚀</span>
                            <h3>Increased Rewards</h3>
                            <p>Battle rewards can be up to <strong>50% higher</strong> while the pool has balance</p>
                        </div>
                        <div className="boost-card">
                            <span className="boost-icon">📉</span>
                            <h3>Natural Decrease</h3>
                            <p>The boost decreases naturally as the pool is consumed through gameplay</p>
                        </div>
                    </div>

                    <h3 className="subsection-title">When the Pool is Empty</h3>
                    <div className="pool-empty-list">
                        <div className="pool-empty-item">
                            <span className="check-icon">✓</span>
                            <span>Rewards return to their standard level</span>
                        </div>
                        <div className="pool-empty-item">
                            <span className="check-icon">✓</span>
                            <span>Gameplay continues normally without interruption</span>
                        </div>
                        <div className="pool-empty-item">
                            <span className="check-icon">✓</span>
                            <span>No dependency on pool balance for core functionality</span>
                        </div>
                        <div className="pool-empty-item">
                            <span className="check-icon">✓</span>
                            <span>No lockups or restrictions when depleted</span>
                        </div>
                    </div>
                </section>

                {/* Section 6: Anti-Abuse Properties */}
                <section className="airdrop-section">
                    <h2>6. Anti-Abuse Properties</h2>
                    <p className="section-intro">
                        The airdrop system is designed with built-in protections that make exploitation economically pointless.
                    </p>

                    <div className="protection-grid">
                        <div className="protection-item">
                            <span className="protection-icon">🔒</span>
                            <div className="protection-content">
                                <strong>Locked and Non-transferable</strong>
                                <p>DGNE from the airdrop cannot be moved or traded</p>
                            </div>
                        </div>
                        <div className="protection-item">
                            <span className="protection-icon">💸</span>
                            <div className="protection-content">
                                <strong>Full Consumption at Mint</strong>
                                <p>Minting a dragon consumes almost the entire airdrop amount (5,000 of 5,100 DGNE)</p>
                            </div>
                        </div>
                        <div className="protection-item">
                            <span className="protection-icon">🚫</span>
                            <div className="protection-content">
                                <strong>No Automatic Income</strong>
                                <p>Dragons created via airdrop do not generate passive income by default</p>
                            </div>
                        </div>
                        <div className="protection-item">
                            <span className="protection-icon">⛔</span>
                            <div className="protection-content">
                                <strong>No Immediate Extraction</strong>
                                <p>There is no immediate way to extract the airdrop outside of gameplay</p>
                            </div>
                        </div>
                    </div>

                    <div className="anti-abuse-summary">
                        <span className="summary-icon">🛡️</span>
                        <p>
                            Multi-account abuse is economically pointless: the cost of creating and maintaining multiple accounts
                            exceeds any potential benefit within the game system.
                        </p>
                    </div>
                </section>

                {/* Section 7: What the Airdrop Is NOT */}
                <section className="airdrop-section not-section">
                    <h2>7. What the Airdrop Is NOT</h2>

                    <div className="not-grid">
                        <div className="not-item">
                            <span className="not-icon">✖</span>
                            <span>Not a token sale</span>
                        </div>
                        <div className="not-item">
                            <span className="not-icon">✖</span>
                            <span>Not a financial incentive</span>
                        </div>
                        <div className="not-item">
                            <span className="not-icon">✖</span>
                            <span>Not a reward for holding</span>
                        </div>
                        <div className="not-item">
                            <span className="not-icon">✖</span>
                            <span>Not a speculative mechanism</span>
                        </div>
                    </div>

                    <div className="is-box">
                        <span className="is-icon">✓</span>
                        <p>
                            <strong>It is purely an access and onboarding tool</strong> — designed to let new players
                            enter the game and participate in its mechanics.
                        </p>
                    </div>
                </section>

                {/* Section 8: Transparency and Predictability */}
                <section className="airdrop-section">
                    <h2>8. Transparency and Predictability</h2>
                    <p className="section-intro">
                        The airdrop system is fully deterministic. All parameters are fixed and publicly verifiable.
                    </p>

                    <div className="transparency-grid">
                        <div className="transparency-item">
                            <span className="transparency-icon">📋</span>
                            <span>Fixed airdrop amount: 5,100 DGNE per user</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">🏷️</span>
                            <span>Fixed mint cost: 5,000 DGNE per dragon</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">📊</span>
                            <span>Public pools and balances visible on-chain</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">🔢</span>
                            <span>No discretionary or manual distribution</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">🔍</span>
                            <span>All flow splits are predetermined and auditable</span>
                        </div>
                        <div className="transparency-item">
                            <span className="transparency-icon">📐</span>
                            <span>System behavior is mathematically predictable</span>
                        </div>
                    </div>
                </section>

                {/* Section 9: Disclaimer */}
                <section className="airdrop-section disclaimer-section">
                    <h2>9. Disclaimer</h2>
                    <div className="disclaimer-box">
                        <p>
                            <strong>DGNE distributed via the airdrop is a locked game credit.</strong>
                        </p>
                        <p>
                            It can only be used inside the game and does not represent a financial asset of any kind.
                        </p>
                    </div>
                </section>

                {/* Footer Notice */}
                <footer className="airdrop-footer">
                    <p className="footer-notice">
                        <strong>Summary:</strong> The airdrop is an access mechanism, not a distribution of assets.
                        DGNE received via airdrop is locked, non-transferable, and can only be spent within the game economy.
                    </p>
                </footer>
            </div>
        </div>
    );
}

export default AirdropScreen;
