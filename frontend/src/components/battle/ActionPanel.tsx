/**
 * ActionPanel Component
 *
 * Bottom panel for player actions - shows move buttons
 */
import { CreatureInstance, MoveDefinition, MOVE_BY_ID } from '@nft-autobattler/shared-types';
import './battle.css';

// Element type colors for move buttons
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

interface ActionPanelProps {
    activeCreature: CreatureInstance | null;
    moveDefinitions?: MoveDefinition[];
    onChooseMove: (moveId: string) => void;
    disabled: boolean;
}

export function ActionPanel({
    activeCreature,
    onChooseMove,
    disabled,
}: ActionPanelProps) {
    if (!activeCreature) {
        return (
            <div className="action-panel action-panel-disabled">
                <p>No active creature</p>
            </div>
        );
    }

    return (
        <div className={`action-panel ${disabled ? 'action-panel-disabled' : ''}`}>
            <div className="action-content">
                <MovesGrid
                    creature={activeCreature}
                    onChooseMove={onChooseMove}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface MovesGridProps {
    creature: CreatureInstance;
    onChooseMove: (moveId: string) => void;
    disabled: boolean;
}

function MovesGrid({ creature, onChooseMove, disabled }: MovesGridProps) {
    return (
        <div className="moves-grid">
            {creature.knownMoveIds.slice(0, 4).map(moveId => {
                const move = MOVE_BY_ID[moveId];
                const cooldown = creature.moveCooldowns[moveId] || 0;
                const isOnCooldown = cooldown > 0;
                const isDisabled = disabled || isOnCooldown;

                if (!move) {
                    return (
                        <button key={moveId} className="move-btn move-btn-unknown" disabled>
                            {moveId}
                        </button>
                    );
                }

                const elementColor = ELEMENT_COLORS[move.elementType] || ELEMENT_COLORS.NEUTRAL;

                return (
                    <button
                        key={moveId}
                        className={`move-btn ${isOnCooldown ? 'move-btn-cooldown' : ''}`}
                        onClick={() => onChooseMove(moveId)}
                        disabled={isDisabled}
                        style={{
                            '--move-element-color': elementColor,
                        } as React.CSSProperties}
                    >
                        <span className="move-name">{move.name}</span>
                        <span className="move-meta">
                            <span className="move-element">{move.elementType}</span>
                            <span className="move-power">
                                {move.category === 'STATUS' ? 'Status' : `Pwr: ${move.basePower}`}
                            </span>
                        </span>
                        {isOnCooldown && (
                            <span className="move-cooldown-badge">CD: {cooldown}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export default ActionPanel;
