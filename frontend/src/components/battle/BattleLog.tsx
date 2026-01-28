/**
 * BattleLog Component
 *
 * Displays a scrollable log of battle events.
 * Shows last N events with color-coding based on event type.
 */
import { BattleEvent } from '@nft-autobattler/shared-types';
import './battle.css';

interface BattleLogProps {
    events: BattleEvent[];
    maxEvents?: number;
}

// Event type styling
const EVENT_STYLES: Record<string, string> = {
    DAMAGE: 'event-damage',
    CRITICAL_HIT: 'event-critical',
    SUPER_EFFECTIVE: 'event-super',
    NOT_EFFECTIVE: 'event-resist',
    MISS: 'event-miss',
    FAINT: 'event-faint',
    SWITCH: 'event-switch',
    STATUS_APPLIED: 'event-status',
    STATUS_DAMAGE: 'event-status-damage',
    MOVE_USED: 'event-move',
    TURN_START: 'event-turn',
    TURN_END: 'event-turn',
};

export function BattleLog({ events, maxEvents = 10 }: BattleLogProps) {
    // Filter out turn markers and get last N events
    const filteredEvents = events
        .filter(e => e.type !== 'TURN_START' && e.type !== 'TURN_END')
        .slice(-maxEvents);

    if (filteredEvents.length === 0) {
        return (
            <div className="battle-log battle-log-empty">
                <p>Battle started...</p>
            </div>
        );
    }

    return (
        <div className="battle-log">
            <h4 className="battle-log-title">📜 Battle Log</h4>
            <div className="battle-log-scroll">
                {filteredEvents.map((event, idx) => {
                    const styleClass = EVENT_STYLES[event.type] || 'event-default';
                    const isPlayer = event.sourcePlayer === 1;

                    return (
                        <div
                            key={idx}
                            className={`battle-log-item ${styleClass} ${isPlayer ? 'event-player' : 'event-opponent'}`}
                        >
                            <span className="event-turn-num">T{event.turn}</span>
                            <span className="event-text">{event.description || formatEvent(event)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Fallback event formatting if description is not set
function formatEvent(event: BattleEvent): string {
    switch (event.type) {
        case 'DAMAGE':
            return `Hit for ${event.payload?.damage || '?'} damage!`;
        case 'FAINT':
            return 'Creature fainted!';
        case 'SWITCH':
            return 'Switched creature!';
        case 'MISS':
            return 'Attack missed!';
        default:
            return event.type.replace(/_/g, ' ').toLowerCase();
    }
}

export default BattleLog;
