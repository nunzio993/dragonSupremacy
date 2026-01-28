/**
 * CreaturePanel Component
 *
 * Displays a creature's information in battle:
 * - Sprite placeholder, name, element type
 * - HP bar with current/max
 * - Status effects
 * - Fainted state (visible but marked as KO)
 * - Hit animation when taking damage
 */
import { CreatureInstance, CreatureDefinition, CREATURE_BY_ID } from '@nft-autobattler/shared-types';
import { HpBar } from './HpBar';
import { StatusBadge } from './StatusBadge';
import './battle.css';

// Preload images on module load
const preloadImages = ['/creature-mock.png', '/creature-attack.png', '/creature-dead.png'];
preloadImages.forEach(src => {
    const img = new Image();
    img.src = src;
});

interface CreaturePanelProps {
    side: 'PLAYER' | 'OPPONENT';
    creature: CreatureInstance | null;
    definition?: CreatureDefinition | null;
    isActive?: boolean;
    size?: 'sm' | 'md';
    isBeingHit?: boolean;
    isAttacking?: boolean;
}

export function CreaturePanel({ side, creature, definition, isActive = true, size = 'md', isBeingHit = false, isAttacking = false }: CreaturePanelProps) {
    // Get definition from global lookup if not provided
    const def = creature ? (definition || CREATURE_BY_ID[creature.creatureDefinitionId]) : null;

    // Format name
    const formatName = (id: string): string => {
        return id
            .replace(/_/g, ' ')
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const name = creature ? (def?.name || formatName(creature.creatureDefinitionId)) : 'Empty';
    const isFainted = creature?.isFainted ?? false;

    // Build class names
    const classNames = [
        'creature-panel',
        `creature-panel-${side.toLowerCase()}`,
        `creature-panel-${size}`,
        isActive ? 'is-active' : 'is-bench',
        isFainted ? 'is-fainted' : '',
        isBeingHit ? 'is-hit' : '',
        !creature ? 'creature-panel-empty' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={classNames}>
            {/* Big Sprite - Main Focus */}
            <div className={`creature-sprite-container ${isFainted ? 'fainted' : ''}`}>
                {isFainted ? (
                    <img
                        src="/creature-dead.png"
                        alt={`${name} (KO)`}
                        className="creature-sprite-img dead"
                    />
                ) : creature ? (
                    <img
                        src={isAttacking ? '/creature-attack.png' : '/creature-mock.png'}
                        alt={name}
                        className={`creature-sprite-img ${isAttacking ? 'attacking' : ''}`}
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <span className="sprite-emoji">❓</span>
                )}

                {/* Hit Effect */}
                {isBeingHit && <div className="hit-flash">💥</div>}
            </div>

            {/* Minimal Info Below Sprite */}
            <div className="creature-info-compact">
                <span className={`creature-name-compact ${isFainted ? 'ko' : ''}`}>
                    {isFainted ? 'KO' : name}
                </span>

                {creature && !isFainted && (
                    <HpBar current={creature.currentHp} max={creature.maxHp} size="sm" />
                )}

                {creature && creature.status !== 'NONE' && !isFainted && (
                    <StatusBadge status={creature.status} />
                )}
            </div>
        </div>
    );
}

export default CreaturePanel;
