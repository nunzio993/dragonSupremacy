/**
 * HpBar Component
 *
 * A reusable HP bar with dynamic coloring based on health percentage.
 * Green (>50%) → Yellow (20-50%) → Red (<20%)
 */
import './battle.css';

interface HpBarProps {
    current: number;
    max: number;
    size?: 'sm' | 'md';
    showText?: boolean;
}

export function HpBar({ current, max, size = 'md', showText = true }: HpBarProps) {
    const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

    const getColorClass = () => {
        if (percent > 50) return 'hp-green';
        if (percent > 20) return 'hp-yellow';
        return 'hp-red';
    };

    return (
        <div className={`hp-bar-wrapper hp-bar-${size}`}>
            <div className="hp-bar-track">
                <div
                    className={`hp-bar-fill ${getColorClass()}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            {showText && (
                <span className="hp-bar-text">
                    {current} / {max}
                </span>
            )}
        </div>
    );
}

export default HpBar;
