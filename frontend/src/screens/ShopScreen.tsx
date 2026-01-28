/**
 * Shop Screen
 *
 * Displays available packs and handles pack purchases.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEconomy } from '../contexts/EconomyContext';
import { getPacks, openPack, PackInfo, OpenPackResponse } from '../services/shopApi';
import './ShopScreen.css';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
    COMMON: '#9e9e9e',
    RARE: '#4fc3f7',
    EPIC: '#ba68c8',
    LEGENDARY: '#ffd54f',
};

// Type icons
const TYPE_ICONS: Record<string, string> = {
    CREATURE: '🐲',
    MOVE: '⚔️',
};

function ShopScreen() {
    const navigate = useNavigate();
    const { economy, refreshEconomy } = useEconomy();
    const [packs, setPacks] = useState<PackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [result, setResult] = useState<OpenPackResponse | null>(null);

    // Load packs on mount
    useEffect(() => {
        loadPacks();
    }, []);

    const loadPacks = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getPacks();
            setPacks(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load packs');
        } finally {
            setLoading(false);
        }
    };

    const handleBuyPack = async (packId: string) => {
        try {
            setPurchasing(packId);
            setError(null);
            const response = await openPack(packId);
            setResult(response);
            refreshEconomy();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to open pack');
        } finally {
            setPurchasing(null);
        }
    };

    const handleCloseResult = () => {
        setResult(null);
    };

    const canAfford = (cost: number) => (economy?.coins ?? 0) >= cost;

    return (
        <div className="shop-screen screen">
            <div className="shop-header">
                <button className="btn-back" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <h1>🛒 Shop</h1>
                <div className="coins-display">
                    <span className="coins-icon">🪙</span>
                    <span className="coins-value">{economy?.coins ?? 0}</span>
                </div>
            </div>

            {loading && (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading packs...</p>
                </div>
            )}

            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {!loading && packs.length > 0 && (
                <div className="packs-grid">
                    {packs.map((pack) => (
                        <PackCard
                            key={pack.id}
                            pack={pack}
                            canAfford={canAfford(pack.costCoins)}
                            isPurchasing={purchasing === pack.id}
                            onBuy={() => handleBuyPack(pack.id)}
                        />
                    ))}
                </div>
            )}

            {/* Result Modal */}
            {result && (
                <ResultModal result={result} onClose={handleCloseResult} />
            )}
        </div>
    );
}

// ============================================
// PACK CARD COMPONENT
// ============================================

interface PackCardProps {
    pack: PackInfo;
    canAfford: boolean;
    isPurchasing: boolean;
    onBuy: () => void;
}

function PackCard({ pack, canAfford, isPurchasing, onBuy }: PackCardProps) {
    const typeIcon = TYPE_ICONS[pack.type] || '📦';

    return (
        <div className={`pack-card ${pack.type.toLowerCase()}`}>
            <div className="pack-icon">{typeIcon}</div>
            <h3 className="pack-name">{pack.name}</h3>
            <p className="pack-description">{pack.description}</p>
            <div className="pack-cost">
                <span className="cost-icon">🪙</span>
                <span className="cost-value">{pack.costCoins}</span>
            </div>
            <button
                className={`btn-buy ${canAfford ? 'affordable' : 'unaffordable'}`}
                disabled={!canAfford || isPurchasing}
                onClick={onBuy}
            >
                {isPurchasing ? '⏳ Opening...' : canAfford ? '🛒 Buy' : '🚫 Not enough'}
            </button>
        </div>
    );
}

// ============================================
// RESULT MODAL COMPONENT
// ============================================

interface ResultModalProps {
    result: OpenPackResponse;
    onClose: () => void;
}

function ResultModal({ result, onClose }: ResultModalProps) {
    const { reward } = result;
    const rarityColor = RARITY_COLORS[reward.rarity] || RARITY_COLORS.COMMON;

    return (
        <div className="result-modal-overlay" onClick={onClose}>
            <div className="result-modal" onClick={(e) => e.stopPropagation()}>
                <div className="result-header">
                    <h2>🎁 Pack Opened!</h2>
                </div>

                <div className="result-content">
                    {reward.type === 'CREATURE' ? (
                        <CreatureResult reward={reward} rarityColor={rarityColor} />
                    ) : (
                        <MoveResult reward={reward} rarityColor={rarityColor} />
                    )}
                </div>

                <div className="result-economy">
                    <span>New Balance: </span>
                    <span className="coins-value">
                        🪙 {result.newEconomyState.coins}
                    </span>
                </div>

                <button className="btn btn-primary" onClick={onClose}>
                    Awesome!
                </button>
            </div>
        </div>
    );
}

function CreatureResult({ reward, rarityColor }: { reward: any; rarityColor: string }) {
    return (
        <div className="reward-creature">
            <div className="reward-icon">🐲</div>
            <h3 className="reward-name">{reward.definition.name}</h3>
            <div className="reward-badges">
                <span className="badge rarity" style={{ backgroundColor: rarityColor }}>
                    {reward.rarity}
                </span>
                <span className="badge element">{reward.definition.elementType}</span>
            </div>
            <div className="reward-stats">
                <div className="stat">
                    <span className="stat-label">HP</span>
                    <span className="stat-value">{reward.stats.hp}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">ATK</span>
                    <span className="stat-value">{reward.stats.atk}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">DEF</span>
                    <span className="stat-value">{reward.stats.def}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">SPD</span>
                    <span className="stat-value">{reward.stats.spd}</span>
                </div>
            </div>
        </div>
    );
}

function MoveResult({ reward, rarityColor }: { reward: any; rarityColor: string }) {
    return (
        <div className="reward-move">
            <div className="reward-icon">⚔️</div>
            <h3 className="reward-name">{reward.definition.name}</h3>
            <div className="reward-badges">
                <span className="badge rarity" style={{ backgroundColor: rarityColor }}>
                    {reward.rarity}
                </span>
                <span className="badge element">{reward.definition.elementType}</span>
            </div>
            <div className="reward-stats">
                <div className="stat">
                    <span className="stat-label">Power</span>
                    <span className="stat-value">{reward.definition.basePower}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Accuracy</span>
                    <span className="stat-value">{reward.definition.accuracy}%</span>
                </div>
            </div>
            <p className="move-description">{reward.definition.description}</p>
        </div>
    );
}

export default ShopScreen;
