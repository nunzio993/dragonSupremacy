import { UnitDefinition } from '@nft-autobattler/shared-types';
import './UnitCard.css';

interface UnitCardProps {
    unit: UnitDefinition;
    compact?: boolean;
    showStats?: boolean;
}

const ROLE_ICONS: Record<string, string> = {
    frontline: '🛡️',
    backline: '🏹',
};

function UnitCard({ unit, compact = false, showStats = true }: UnitCardProps) {
    return (
        <div className={`unit-card ${compact ? 'compact' : ''} rarity-border-${unit.rarity}`}>
            <div className="unit-card-header">
                <span className={`rarity-badge rarity-${unit.rarity}`}>{unit.rarity}</span>
                <span className="role-icon" title={unit.role}>
                    {ROLE_ICONS[unit.role]}
                </span>
            </div>

            <div className="unit-avatar">
                {/* Placeholder avatar using first letter */}
                <span className="unit-avatar-letter">{unit.name[0]}</span>
            </div>

            <h3 className="unit-name">{unit.name}</h3>

            {showStats && (
                <div className="unit-stats">
                    <div className="stat">
                        <span className="stat-label">HP</span>
                        <span className="stat-value">{unit.baseHp}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">ATK</span>
                        <span className="stat-value">{unit.baseAtk}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">SPD</span>
                        <span className="stat-value">{unit.baseSpd}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UnitCard;
