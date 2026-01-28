/**
 * CreatureSelector Component
 * Horizontal scrollable dragon selector for battle
 */

import { useAccount } from 'wagmi';
import { useOwnedCreatures, CreatureInfo } from '../../hooks/useCreatureContract';
import './CreatureSelector.css';

const ELEMENT_CONFIG: Record<string, { emoji: string; gradient: string }> = {
    FIRE: { emoji: '🔥', gradient: 'linear-gradient(135deg, #ff6b35, #f72585)' },
    WATER: { emoji: '💧', gradient: 'linear-gradient(135deg, #4cc9f0, #4361ee)' },
    GRASS: { emoji: '🌿', gradient: 'linear-gradient(135deg, #80ed99, #38b000)' },
    ELECTRIC: { emoji: '⚡', gradient: 'linear-gradient(135deg, #ffd60a, #ffc300)' },
    ICE: { emoji: '❄️', gradient: 'linear-gradient(135deg, #a2d2ff, #bde0fe)' },
    EARTH: { emoji: '🪨', gradient: 'linear-gradient(135deg, #bc6c25, #606c38)' },
    DARK: { emoji: '🌑', gradient: 'linear-gradient(135deg, #6c757d, #343a40)' },
    LIGHT: { emoji: '✨', gradient: 'linear-gradient(135deg, #ffd700, #fff3cd)' },
};

interface CreatureSelectorProps {
    selectedCreatureId: string | null;
    onSelect: (creatureId: string, creature: CreatureInfo) => void;
}

export function CreatureSelector({ selectedCreatureId, onSelect }: CreatureSelectorProps) {
    const { address } = useAccount();
    const { creatures, isLoading, error } = useOwnedCreatures(address);

    // Calculate power rating
    const getPowerRating = (creature: CreatureInfo) => {
        if (!creature.stats) return 0;
        return Object.values(creature.stats).reduce((sum, val) => sum + val, 0);
    };

    if (isLoading) {
        return (
            <div className="creature-selector">
                <div className="selector-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading your dragons...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="creature-selector">
                <div className="selector-error">
                    <span className="error-icon">⚠️</span>
                    <span>Error loading creatures</span>
                </div>
            </div>
        );
    }

    if (creatures.length === 0) {
        return (
            <div className="creature-selector">
                <div className="selector-empty">
                    <span className="empty-icon">🥚</span>
                    <p>No dragons yet!</p>
                    <a href="/mint" className="mint-link">Mint Your First Dragon</a>
                </div>
            </div>
        );
    }

    return (
        <div className="creature-selector">
            <div className="dragon-scroll-container">
                <div className="dragon-row">
                    {creatures.map((creature) => {
                        const config = ELEMENT_CONFIG[creature.elementType] || ELEMENT_CONFIG.FIRE;
                        const isSelected = selectedCreatureId === creature.tokenId.toString();
                        const powerRating = getPowerRating(creature);

                        return (
                            <div
                                key={creature.tokenId.toString()}
                                className={`dragon-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => onSelect(creature.tokenId.toString(), creature)}
                                style={{ '--element-gradient': config.gradient } as React.CSSProperties}
                            >
                                {/* Selection indicator */}
                                {isSelected && <div className="selected-check">✓</div>}

                                {/* Element & Avatar */}
                                <div className="dragon-avatar">
                                    <span className="dragon-emoji">{config.emoji}</span>
                                </div>

                                {/* ID Badge */}
                                <div className="dragon-id">#{creature.tokenId.toString()}</div>

                                {/* HP Bar - from creature data */}
                                {(() => {
                                    const hpPercent = creature.maxHp > 0
                                        ? (creature.currentHp / creature.maxHp) * 100
                                        : 100;
                                    const hpClass = hpPercent > 50 ? 'hp-high' : hpPercent > 25 ? 'hp-medium' : 'hp-low';
                                    return (
                                        <div className="hp-row">
                                            <span className="hp-label">HP</span>
                                            <div className="hp-bar">
                                                <div className={`hp-fill ${hpClass}`} style={{ width: `${hpPercent}%` }}></div>
                                            </div>
                                            <span className={`hp-val ${hpClass}`}>{creature.currentHp}/{creature.maxHp}</span>
                                        </div>
                                    );
                                })()}

                                {/* Power Rating - Prominent */}
                                <div className="power-display">
                                    <span className="power-label">Power</span>
                                    <span className="power-value">{powerRating}</span>
                                </div>

                                {/* Level Badge */}
                                <div className="level-badge">
                                    <span>Lv.</span>
                                    <span>{creature.level.toString()}</span>
                                </div>

                                {/* Talent Bar */}
                                <div className="talent-row">
                                    <span className="talent-label">Talent</span>
                                    <div className="talent-bar">
                                        <div className="talent-fill" style={{ width: `${creature.talent}%` }}></div>
                                    </div>
                                    <span className="talent-val">{creature.talent}</span>
                                </div>

                                {/* Traits */}
                                <div className="dragon-traits">
                                    <span className="trait-badge">{creature.personality}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default CreatureSelector;
