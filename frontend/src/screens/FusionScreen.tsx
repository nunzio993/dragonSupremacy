/**
 * Fusion Screen
 *
 * Allows players to fuse creatures and moves into higher-rarity variants.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuseCreatures, fuseMoves, CreatureFusionResponse, MoveFusionResponse } from '../services/fusionApi';
import { CreatureRarity, ElementType, CREATURE_BY_ID } from '@nft-autobattler/shared-types';
import './FusionScreen.css';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
    COMMON: '#9e9e9e',
    RARE: '#4fc3f7',
    EPIC: '#ba68c8',
    LEGENDARY: '#ffd54f',
};

// Element colors
const ELEMENT_COLORS: Record<string, string> = {
    FIRE: '#ff6b35',
    WATER: '#4ecdc4',
    GRASS: '#7cb342',
    ELECTRIC: '#ffd93d',
    ICE: '#81d4fa',
    EARTH: '#8d6e63',
    DARK: '#5c4d7d',
    LIGHT: '#fff59d',
    NEUTRAL: '#9e9e9e',
};

type FusionTab = 'creatures' | 'moves';

interface PlayerCreature {
    instanceId: string;
    unitDefinitionId: string;
    name: string;
    rarity: CreatureRarity;
    elementType: ElementType;
}

function FusionScreen() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<FusionTab>('creatures');
    const [creatures, setCreatures] = useState<PlayerCreature[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [fusing, setFusing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CreatureFusionResponse | MoveFusionResponse | null>(null);

    // Load player's creatures
    const loadCreatures = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('autobattler_token') || '';
            const response = await fetch('/api/v1/roster', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (data.success && data.data?.units) {
                const mapped: PlayerCreature[] = data.data.units.map((unit: any) => {
                    const def = CREATURE_BY_ID[unit.unitDefinitionId];
                    return {
                        instanceId: unit.instanceId,
                        unitDefinitionId: unit.unitDefinitionId,
                        name: def?.name || unit.unitDefinitionId,
                        rarity: def?.rarity || 'COMMON',
                        elementType: def?.elementType || 'NEUTRAL',
                    };
                });
                setCreatures(mapped);
            }
        } catch (err) {
            console.error('Failed to load creatures:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCreatures();
    }, [loadCreatures]);

    // Reset selection when changing tabs
    useEffect(() => {
        setSelectedIds([]);
        setError(null);
    }, [activeTab]);

    // Group creatures by rarity + element
    const creatureGroups = useMemo(() => {
        const groups: Record<string, PlayerCreature[]> = {};
        creatures.forEach((item) => {
            const key = `${item.rarity}-${item.elementType}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [creatures]);

    // Check if current selection is valid
    const selectionValid = useMemo(() => {
        if (selectedIds.length !== 3) return false;

        const items = creatures.filter((i) => selectedIds.includes(i.instanceId));
        if (items.length !== 3) return false;

        // Check same rarity and element
        const rarities = items.map((i) => i.rarity);
        const elements = items.map((i) => i.elementType);

        return (
            rarities.every((r) => r === rarities[0]) &&
            elements.every((e) => e === elements[0]) &&
            rarities[0] !== 'LEGENDARY'
        );
    }, [selectedIds, creatures]);

    const handleItemClick = (id: string) => {
        setSelectedIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((i) => i !== id);
            }
            if (prev.length >= 3) {
                return prev;
            }
            return [...prev, id];
        });
    };

    const handleFuse = async () => {
        if (!selectionValid) return;

        setFusing(true);
        setError(null);

        try {
            if (activeTab === 'creatures') {
                const response = await fuseCreatures(selectedIds);
                setResult(response);
            } else {
                const response = await fuseMoves(selectedIds);
                setResult(response);
            }
            setSelectedIds([]);
            loadCreatures(); // Refresh roster
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Fusion failed');
        } finally {
            setFusing(false);
        }
    };

    const handleCloseResult = () => {
        setResult(null);
    };

    // Get selected item info
    const selectedInfo = useMemo(() => {
        if (selectedIds.length === 0) return null;
        const items = creatures.filter((i) => selectedIds.includes(i.instanceId));
        if (items.length === 0) return null;
        return {
            count: items.length,
            rarity: items[0]?.rarity,
            element: items[0]?.elementType,
        };
    }, [selectedIds, creatures]);

    return (
        <div className="fusion-screen screen">
            <div className="fusion-header">
                <button className="btn-back" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <h1>🔮 Fusion</h1>
                <div className="fusion-info">
                    3 same → 1 higher
                </div>
            </div>

            {/* Tabs */}
            <div className="fusion-tabs">
                <button
                    className={`tab ${activeTab === 'creatures' ? 'active' : ''}`}
                    onClick={() => setActiveTab('creatures')}
                >
                    🐲 Creatures
                </button>
                <button
                    className={`tab ${activeTab === 'moves' ? 'active' : ''}`}
                    onClick={() => setActiveTab('moves')}
                    disabled
                    title="Coming soon"
                >
                    ⚔️ Moves
                </button>
            </div>

            {/* Selection Status */}
            <div className="selection-status">
                <span className="selection-count">
                    Selected: {selectedIds.length}/3
                </span>
                {selectedInfo && selectedIds.length > 0 && (
                    <span
                        className="selection-info"
                        style={{ color: RARITY_COLORS[selectedInfo.rarity] }}
                    >
                        {selectedInfo.rarity} {selectedInfo.element}
                    </span>
                )}
            </div>

            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading creatures...</p>
                </div>
            )}

            {/* Creature Grid */}
            {!loading && activeTab === 'creatures' && (
                <div className="fusion-content">
                    {Object.keys(creatureGroups).length === 0 ? (
                        <div className="empty-state">
                            <p>No creatures available for fusion.</p>
                            <p>Buy packs from the Shop to get started!</p>
                        </div>
                    ) : (
                        Object.entries(creatureGroups).map(([key, items]) => {
                            if (items.length < 3) return null;
                            const [rarity, element] = key.split('-') as [CreatureRarity, ElementType];
                            if (rarity === 'LEGENDARY') return null;

                            return (
                                <div key={key} className="fusion-group">
                                    <div className="group-header">
                                        <span
                                            className="rarity-badge"
                                            style={{ backgroundColor: RARITY_COLORS[rarity] }}
                                        >
                                            {rarity}
                                        </span>
                                        <span
                                            className="element-badge"
                                            style={{ backgroundColor: ELEMENT_COLORS[element] }}
                                        >
                                            {element}
                                        </span>
                                        <span className="group-count">({items.length})</span>
                                    </div>
                                    <div className="group-items">
                                        {items.map((item) => (
                                            <div
                                                key={item.instanceId}
                                                className={`fusion-item ${selectedIds.includes(item.instanceId) ? 'selected' : ''
                                                    }`}
                                                onClick={() => handleItemClick(item.instanceId)}
                                            >
                                                <span className="item-icon">🐲</span>
                                                <span className="item-name">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Fuse Button */}
            <div className="fusion-footer">
                <button
                    className={`btn-fuse ${selectionValid ? 'valid' : 'invalid'}`}
                    disabled={!selectionValid || fusing}
                    onClick={handleFuse}
                >
                    {fusing ? '⏳ Fusing...' : '🔮 Fuse (3 → 1)'}
                </button>
            </div>

            {/* Result Modal */}
            {result && (
                <FusionResultModal result={result} onClose={handleCloseResult} />
            )}
        </div>
    );
}

// ============================================
// RESULT MODAL
// ============================================

interface FusionResultModalProps {
    result: CreatureFusionResponse | MoveFusionResponse;
    onClose: () => void;
}

function FusionResultModal({ result, onClose }: FusionResultModalProps) {
    const isCreature = 'newCreature' in result;
    const item = isCreature ? result.newCreature : result.newMove;
    const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.COMMON;
    const elementColor = ELEMENT_COLORS[item.elementType] || ELEMENT_COLORS.NEUTRAL;

    return (
        <div className="fusion-result-overlay" onClick={onClose}>
            <div className="fusion-result-modal" onClick={(e) => e.stopPropagation()}>
                <div className="result-header">
                    <h2>🎉 Fusion Complete!</h2>
                </div>

                <div className="result-content">
                    <div className="result-icon">{isCreature ? '🐲' : '⚔️'}</div>
                    <h3 className="result-name">{item.name}</h3>
                    <div className="result-badges">
                        <span className="badge" style={{ backgroundColor: rarityColor }}>
                            {item.rarity}
                        </span>
                        <span className="badge" style={{ backgroundColor: elementColor }}>
                            {item.elementType}
                        </span>
                    </div>

                    {isCreature && 'stats' in item && (
                        <div className="result-stats">
                            <div className="stat">
                                <span className="stat-label">HP</span>
                                <span className="stat-value">{item.stats.hp}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">ATK</span>
                                <span className="stat-value">{item.stats.atk}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">DEF</span>
                                <span className="stat-value">{item.stats.def}</span>
                            </div>
                            <div className="stat">
                                <span className="stat-label">SPD</span>
                                <span className="stat-value">{item.stats.spd}</span>
                            </div>
                        </div>
                    )}
                </div>

                <button className="btn btn-primary" onClick={onClose}>
                    Awesome!
                </button>
            </div>
        </div>
    );
}

export default FusionScreen;
