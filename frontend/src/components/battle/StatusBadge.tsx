/**
 * StatusBadge Component
 *
 * Displays status effects as color-coded pills with icons.
 */
import { StatusEffectType } from '@nft-autobattler/shared-types';
import './battle.css';

interface StatusBadgeProps {
    status: StatusEffectType;
}

const STATUS_CONFIG: Record<StatusEffectType, { icon: string; color: string; label: string }> = {
    NONE: { icon: '', color: 'transparent', label: '' },
    POISON: { icon: '☠️', color: '#9b59b6', label: 'Poison' },
    BURN: { icon: '🔥', color: '#e74c3c', label: 'Burn' },
    SLEEP: { icon: '💤', color: '#3498db', label: 'Sleep' },
    PARALYSIS: { icon: '⚡', color: '#f1c40f', label: 'Paralyzed' },
    FREEZE: { icon: '❄️', color: '#81d4fa', label: 'Frozen' },
    SHIELD: { icon: '🛡️', color: '#27ae60', label: 'Shield' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
    if (status === 'NONE') return null;

    const config = STATUS_CONFIG[status] || STATUS_CONFIG.NONE;

    return (
        <span
            className="status-badge"
            style={{ backgroundColor: config.color }}
        >
            {config.icon} {config.label}
        </span>
    );
}

export default StatusBadge;
