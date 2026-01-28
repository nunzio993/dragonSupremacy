/**
 * My Creatures Screen
 * Premium gallery view of owned NFT creatures with detailed stats
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useOwnedCreatures, CreatureInfo } from '../hooks/useCreatureContract';
import { useInstantHeal } from '../hooks/useHPManager';
import { CONTRACTS } from '../contracts/config';
import './MyCreaturesScreen.css';

const ELEMENT_CONFIG: Record<string, { emoji: string; gradient: string; color: string }> = {
    FIRE: { emoji: '🔥', gradient: 'linear-gradient(135deg, #ff6b35, #f72585)', color: '#ff6b35' },
    WATER: { emoji: '💧', gradient: 'linear-gradient(135deg, #4cc9f0, #4361ee)', color: '#4cc9f0' },
    GRASS: { emoji: '🌿', gradient: 'linear-gradient(135deg, #80ed99, #38b000)', color: '#80ed99' },
    ELECTRIC: { emoji: '⚡', gradient: 'linear-gradient(135deg, #ffd60a, #ffc300)', color: '#ffd60a' },
    ICE: { emoji: '❄️', gradient: 'linear-gradient(135deg, #a2d2ff, #bde0fe)', color: '#a2d2ff' },
    EARTH: { emoji: '🪨', gradient: 'linear-gradient(135deg, #bc6c25, #606c38)', color: '#bc6c25' },
    DARK: { emoji: '🌑', gradient: 'linear-gradient(135deg, #6c757d, #343a40)', color: '#6c757d' },
    LIGHT: { emoji: '✨', gradient: 'linear-gradient(135deg, #ffd700, #fff3cd)', color: '#ffd700' },
};

const TEMPERAMENT_EMOJI: Record<string, string> = {
    CALM: '😌',
    FOCUSED: '🎯',
    NEUTRAL: '😐',
    NERVOUS: '😤',
    RECKLESS: '🔥',
};

function MyCreaturesScreen() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { creatures, isLoading, error, refetch } = useOwnedCreatures(address);
    const [selectedCreature, setSelectedCreature] = useState<CreatureInfo | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [healingCreatureId, setHealingCreatureId] = useState<string | null>(null);
    const [stakingCreatureId, setStakingCreatureId] = useState<string | null>(null);
    const [stakingPhase, setStakingPhase] = useState<'idle' | 'approving' | 'staking'>('idle');
    const [stakingTalent, setStakingTalent] = useState<number>(50);
    const [stakeModalOpen, setStakeModalOpen] = useState(false);
    const [pendingStakeCreature, setPendingStakeCreature] = useState<CreatureInfo | null>(null);

    // Staking hooks
    const { writeContract: stakeWrite, data: stakeTxHash, isPending: isStakePending, reset: resetStake } = useWriteContract();
    const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({ hash: stakeTxHash });

    // When approval is confirmed, call stake
    React.useEffect(() => {
        if (isStakeSuccess && stakingPhase === 'approving' && stakingCreatureId) {
            setStakingPhase('staking');
            // Now call stake on the staking contract
            stakeWrite({
                address: CONTRACTS.DRAGON_STAKING,
                abi: [{
                    name: 'stake',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'talent', type: 'uint8' }],
                    outputs: []
                }],
                functionName: 'stake',
                args: [BigInt(stakingCreatureId), stakingTalent]
            });
        } else if (isStakeSuccess && stakingPhase === 'staking') {
            // Stake complete! Reset and refetch
            setStakingPhase('idle');
            setStakingCreatureId(null);
            resetStake();
            setTimeout(() => refetch(), 2000);
        }
    }, [isStakeSuccess, stakingPhase, stakingCreatureId, stakingTalent, stakeWrite, refetch, resetStake]);

    // Heal hook
    const { heal, isHealing } = useInstantHeal();

    if (!isConnected) {
        return (
            <div className="my-creatures-screen">
                <div className="connect-prompt">
                    <div className="prompt-icon">🔗</div>
                    <h2>Connect Your Wallet</h2>
                    <p>Connect your wallet to view your creatures</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="my-creatures-screen">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading your creatures...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="my-creatures-screen">
                <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <h2>Something went wrong</h2>
                    <p>{error.message}</p>
                    <button className="retry-btn" onClick={() => refetch()}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const getElementConfig = (element: string) => ELEMENT_CONFIG[element] || ELEMENT_CONFIG.FIRE;

    return (
        <div className="my-creatures-screen">
            {/* Header */}
            <header className="creatures-header">
                <div className="header-left">
                    <h1>🐉 My Creatures</h1>
                    <span className="creature-count">{creatures.length} creatures</span>
                </div>
                <div className="header-actions">
                    <div className="view-toggle">
                        <button
                            className={viewMode === 'grid' ? 'active' : ''}
                            onClick={() => setViewMode('grid')}
                            title="Grid View"
                        >
                            ⊞
                        </button>
                        <button
                            className={viewMode === 'list' ? 'active' : ''}
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            ☰
                        </button>
                    </div>
                    <button className="mint-btn" onClick={() => navigate('/mint')}>
                        + Mint New
                    </button>
                </div>
            </header>

            {/* Empty State */}
            {creatures.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">🥚</div>
                    <h2>No Creatures Yet</h2>
                    <p>Mint your first creature to start battling!</p>
                    <button className="mint-btn-large" onClick={() => navigate('/mint')}>
                        🐉 Mint Your First Creature
                    </button>
                </div>
            )}

            {/* Creature Grid/List */}
            {creatures.length > 0 && (
                <div className={`creatures-container ${viewMode}`}>
                    {creatures.map((creature) => {
                        const config = getElementConfig(creature.elementType);
                        const isSelected = selectedCreature?.tokenId === creature.tokenId;

                        return (
                            <div
                                key={creature.tokenId.toString()}
                                className={`creature-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedCreature(isSelected ? null : creature)}
                                style={{ '--element-gradient': config.gradient, '--element-color': config.color } as React.CSSProperties}
                            >
                                {/* Element Badge */}
                                <div className="element-badge">
                                    {config.emoji}
                                </div>

                                {/* Creature Avatar */}
                                <div className="creature-avatar">
                                    <span className="avatar-emoji">{config.emoji}</span>
                                </div>

                                {/* Basic Info */}
                                <div className="creature-basic-info">
                                    <h3 className="creature-name">Creature #{creature.tokenId.toString()}</h3>
                                    <div className="creature-level">
                                        <span className="level-badge">Lv. {creature.level.toString()}</span>
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                <div className="creature-stats-bar">
                                    {/* HP Bar */}
                                    {(() => {
                                        const hpPercent = creature.maxHp > 0
                                            ? (creature.currentHp / creature.maxHp) * 100
                                            : 100;
                                        const hpClass = hpPercent > 50 ? 'hp-high' : hpPercent > 25 ? 'hp-medium' : 'hp-low';
                                        return (
                                            <div className="stat-item hp-stat" data-tooltip="Current HP - recovers 5% per hour or use Heal button">
                                                <span className="stat-label">❤️ HP</span>
                                                <div className="stat-bar-container hp-bar-container">
                                                    <div
                                                        className={`stat-bar-fill hp-fill ${hpClass}`}
                                                        style={{ width: `${hpPercent}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`stat-value ${hpClass}`}>
                                                    {creature.currentHp}/{creature.maxHp}
                                                </span>
                                                {hpPercent < 100 && (
                                                    <button
                                                        className={`heal-btn ${isHealing && healingCreatureId === creature.tokenId.toString() ? 'healing' : ''}`}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const tokenId = creature.tokenId.toString();
                                                            const hpToHeal = creature.maxHp - creature.currentHp;
                                                            const costPer10Percent = 1; // 1 DGNE per 10% HP
                                                            const estimatedCost = Math.ceil((hpToHeal / creature.maxHp) * 10 * costPer10Percent);

                                                            if (confirm(`Heal creature #${tokenId} for ~${estimatedCost} DGNE?`)) {
                                                                setHealingCreatureId(tokenId);
                                                                const healCost = BigInt(estimatedCost) * BigInt(10 ** 18);
                                                                const success = await heal(tokenId, healCost);
                                                                if (success) {
                                                                    setTimeout(() => refetch(), 2000);
                                                                }
                                                                setHealingCreatureId(null);
                                                            }
                                                        }}
                                                        title="Pay DGNE to instantly heal"
                                                        disabled={isHealing}
                                                    >
                                                        {isHealing && healingCreatureId === creature.tokenId.toString() ? '⏳' : '💊'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div className="stat-item power-rating" data-tooltip="Overall combat power - sum of all stats. Weaker dragons attack first!">
                                        <span className="stat-label">⚔️ Power</span>
                                        <span className="stat-value power-value">
                                            {creature.stats
                                                ? Object.values(creature.stats).reduce((sum, val) => sum + val, 0)
                                                : 0}
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Talent</span>
                                        <div className="stat-bar-container">
                                            <div
                                                className="stat-bar-fill"
                                                style={{ width: `${creature.talent}%` }}
                                            ></div>
                                        </div>
                                        <span className="stat-value">{creature.talent}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">XP</span>
                                        <span className="stat-value">{creature.xp.toString()}</span>
                                    </div>
                                </div>

                                {/* Traits */}
                                <div className="creature-traits">
                                    <span className="trait personality">{creature.personality}</span>
                                    <span className="trait temperament">
                                        {TEMPERAMENT_EMOJI[creature.temperament] || '😐'} {creature.temperament}
                                    </span>
                                </div>

                                {/* Stake Button */}
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                        className="stake-btn"
                                        style={{
                                            padding: '8px 16px',
                                            background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: '#000',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingStakeCreature(creature);
                                            setStakeModalOpen(true);
                                        }}
                                        disabled={(isStakePending || isStakeConfirming) && stakingCreatureId === creature.tokenId.toString()}
                                    >
                                        {(isStakePending || isStakeConfirming) && stakingCreatureId === creature.tokenId.toString()
                                            ? '⏳ Staking...'
                                            : '💰 Stake'}
                                    </button>
                                </div>

                                {/* Expanded Details (when selected) */}
                                {
                                    isSelected && (
                                        <div className="creature-details">
                                            {/* All 9 Stats Grid */}
                                            <div className="stats-grid">
                                                {[
                                                    { key: 'VIT', label: 'Vitality', icon: '❤️', desc: 'Your dragon\'s life force. Higher vitality means more HP to withstand enemy attacks.' },
                                                    { key: 'STR', label: 'Strength', icon: '💪', desc: 'Raw physical power. Increases damage dealt by physical attacks like bites and slashes.' },
                                                    { key: 'AGI', label: 'Agility', icon: '🏃', desc: 'Nimbleness and magical affinity. Boosts special attack damage and base dodge chance.' },
                                                    { key: 'SPD', label: 'Speed', icon: '⚡', desc: 'Movement and reaction speed. Affects dodge chance and certain combat mechanics.' },
                                                    { key: 'END', label: 'Endurance', icon: '🛡️', desc: 'Defensive resilience. Reduces all incoming damage, letting your dragon survive longer.' },
                                                    { key: 'REF', label: 'Reflex', icon: '🎯', desc: 'Quick reactions. Increases evasion chance and critical hit rate for devastating blows.' },
                                                    { key: 'INT', label: 'Intelligence', icon: '🧠', desc: 'Ancient wisdom. Unique stat that never decays and grows forever with age. Boosts dodge.' },
                                                    { key: 'PRC', label: 'Precision', icon: '🔍', desc: 'Keen accuracy. Higher precision means your attacks rarely miss their target.' },
                                                    { key: 'RGN', label: 'Regen', icon: '✨', desc: 'Natural healing. Restores HP at the end of each turn, sustaining through long battles.' },
                                                ].map(({ key, label, icon, desc }) => (
                                                    <div key={key} className="stat-cell" data-tooltip={desc}>
                                                        <span className="stat-icon">{icon}</span>
                                                        <div className="stat-info">
                                                            <span className="stat-name">{label}</span>
                                                            <span className="stat-number">
                                                                {creature.stats?.[key as keyof typeof creature.stats] || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Moves */}
                                            {creature.moves && creature.moves.length > 0 && (
                                                <div className="moves-section" style={{
                                                    marginTop: '16px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    width: '100%'
                                                }}>
                                                    <h4 style={{
                                                        margin: '0 0 12px 0',
                                                        fontSize: '14px',
                                                        color: '#fff',
                                                        textAlign: 'center',
                                                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                        paddingBottom: '8px'
                                                    }}>
                                                        ⚔️ Moves
                                                    </h4>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                                        gap: '10px'
                                                    }}>
                                                        {creature.moves.map((move, i) => {
                                                            const categoryStyle: Record<string, { bg: string; label: string }> = {
                                                                'PHYSICAL': { bg: '#c0392b', label: 'PHY' },
                                                                'SPECIAL': { bg: '#8e44ad', label: 'SPC' },
                                                                'STATUS': { bg: '#2980b9', label: 'STS' }
                                                            };
                                                            const typeColors: Record<string, string> = {
                                                                'FIRE': '#e74c3c', 'WATER': '#3498db', 'GRASS': '#27ae60',
                                                                'ELECTRIC': '#f39c12', 'ICE': '#74b9ff', 'EARTH': '#8b4513',
                                                                'DARK': '#34495e', 'LIGHT': '#f1c40f'
                                                            };
                                                            const cat = categoryStyle[move.category] || { bg: '#666', label: '?' };
                                                            const typeColor = typeColors[move.type] || '#666';

                                                            return (
                                                                <div key={i} style={{
                                                                    background: `linear-gradient(135deg, ${typeColor}22 0%, rgba(0,0,0,0.4) 100%)`,
                                                                    border: `1px solid ${typeColor}66`,
                                                                    borderRadius: '8px',
                                                                    padding: '10px',
                                                                    minHeight: '80px'
                                                                }}>
                                                                    {/* Header: Name + Category */}
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'flex-start',
                                                                        marginBottom: '8px'
                                                                    }}>
                                                                        <span style={{
                                                                            fontWeight: '600',
                                                                            fontSize: '13px',
                                                                            color: '#fff',
                                                                            lineHeight: '1.2'
                                                                        }}>
                                                                            {move.name}
                                                                        </span>
                                                                        <span style={{
                                                                            fontSize: '9px',
                                                                            padding: '2px 5px',
                                                                            borderRadius: '3px',
                                                                            background: cat.bg,
                                                                            color: '#fff',
                                                                            fontWeight: '500',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {cat.label}
                                                                        </span>
                                                                    </div>

                                                                    {/* Stats Row */}
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        gap: '8px',
                                                                        fontSize: '11px',
                                                                        color: '#ccc',
                                                                        marginBottom: '4px',
                                                                        flexWrap: 'wrap'
                                                                    }}>
                                                                        <span title="Power">PWR {move.power}</span>
                                                                        <span title="Accuracy">ACC {move.accuracy}%</span>
                                                                        {move.cooldownMax > 0 && (
                                                                            <span title="Cooldown">CD {move.cooldownMax}</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Status Effect */}
                                                                    {move.statusEffect && move.statusChance > 0 && (
                                                                        <div style={{
                                                                            fontSize: '10px',
                                                                            color: '#f39c12',
                                                                            marginTop: '4px'
                                                                        }}>
                                                                            {move.statusEffect} ({Math.round(move.statusChance * 100)}%)
                                                                        </div>
                                                                    )}

                                                                    {/* Footer: Type + Mastery */}
                                                                    <div style={{
                                                                        fontSize: '9px',
                                                                        color: '#888',
                                                                        marginTop: '6px',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between'
                                                                    }}>
                                                                        <span style={{ color: typeColor }}>{move.type}</span>
                                                                        <span>MST {Math.round(move.mastery * 100)}%</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="detail-row">
                                                <span className="detail-label">Element</span>
                                                <span className="detail-value">{config.emoji} {creature.elementType}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">Age</span>
                                                <span className="detail-value">{(creature.ageDays ?? 0).toString()} days</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">Token ID</span>
                                                <span className="detail-value mono">#{creature.tokenId.toString()}</span>
                                            </div>
                                            <div className="card-actions">
                                                <button
                                                    className="action-btn battle"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate('/lobby');
                                                    }}
                                                >
                                                    ⚔️ Battle
                                                </button>
                                            </div>
                                        </div>
                                    )
                                }
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Stake Confirmation Modal */}
            {stakeModalOpen && pendingStakeCreature && (
                <div
                    className="stake-modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(8px)'
                    }}
                    onClick={() => setStakeModalOpen(false)}
                >
                    <div
                        className="stake-modal"
                        style={{
                            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '420px',
                            width: '90%',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.1)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <span style={{ fontSize: '48px' }}>💰</span>
                        </div>
                        <h2 style={{
                            color: '#ffd700',
                            textAlign: 'center',
                            marginBottom: '16px',
                            fontSize: '24px',
                            fontWeight: '600'
                        }}>
                            Stake Dragon #{pendingStakeCreature.tokenId.toString()}?
                        </h2>
                        <p style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            textAlign: 'center',
                            marginBottom: '24px',
                            lineHeight: '1.6'
                        }}>
                            Your dragon will be transferred to the staking contract and will earn <strong style={{ color: '#ffd700' }}>DGNE tokens</strong> over time.
                        </p>
                        <div style={{
                            background: 'rgba(255, 215, 0, 0.1)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '24px',
                            border: '1px solid rgba(255, 215, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Talent</span>
                                <span style={{ color: '#ffd700', fontWeight: '600' }}>{pendingStakeCreature.talent}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Est. Daily Reward</span>
                                <span style={{ color: '#4ade80', fontWeight: '600' }}>~{(pendingStakeCreature.talent * 0.1).toFixed(1)} DGNE</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setStakeModalOpen(false)}
                                style={{
                                    flex: 1,
                                    padding: '14px 24px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '10px',
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const tokenId = pendingStakeCreature.tokenId.toString();
                                    setStakingCreatureId(tokenId);
                                    setStakingPhase('approving');
                                    setStakingTalent(pendingStakeCreature.talent);
                                    setStakeModalOpen(false);
                                    try {
                                        stakeWrite({
                                            address: CONTRACTS.RMRKCreature.address,
                                            abi: [{
                                                name: 'approve',
                                                type: 'function',
                                                stateMutability: 'nonpayable',
                                                inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }],
                                                outputs: []
                                            }],
                                            functionName: 'approve',
                                            args: [CONTRACTS.DRAGON_STAKING, BigInt(tokenId)]
                                        });
                                    } catch (err) {
                                        console.error('Stake error:', err);
                                        setStakingCreatureId(null);
                                        setStakingPhase('idle');
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '14px 24px',
                                    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: '#000',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)'
                                }}
                            >
                                🚀 Stake Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

export default MyCreaturesScreen;
