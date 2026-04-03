import React from 'react';
import styles from './ConditionDisplay.module.css';
import GameTooltip from '../common/GameTooltip';

interface ConditionItem {
    id: string;
    name: string;
    description?: string;
    duration?: number;
    sourceId?: string;
}

interface ConditionDisplayProps {
    conditions: (ConditionItem | string)[];
    className?: string;
}

const ConditionDisplay: React.FC<ConditionDisplayProps> = ({ conditions, className = '' }) => {
    if (conditions.length === 0) return null;

    const getName = (c: ConditionItem | string) => typeof c === 'string' ? c : c.name;
    const getDuration = (c: ConditionItem | string) => typeof c === 'string' ? undefined : c.duration;

    const getConditionColor = (condition: string) => {
        const c = condition.toLowerCase();
        if (['blinded', 'unconscious', 'paralyzed', 'stunned', 'dead'].includes(c)) return styles.critical;
        if (['poisoned', 'frightened', 'exhaustion'].includes(c)) return styles.warning;
        return styles.info;
    };

    return (
        <div className={`${styles.container} ${className}`}>
            {conditions.map((condition, i) => {
                const name = getName(condition);
                const dur = getDuration(condition);
                return (
                    <GameTooltip key={`${name}-${i}`} text={dur !== undefined ? `${name} (${dur} rounds)` : name}>
                    <span
                        className={`${styles.badge} ${getConditionColor(name)}`}
                    >
                        {name}{dur !== undefined ? ` (${dur})` : ''}
                    </span>
                    </GameTooltip>
                );
            })}
        </div>
    );
};

export default ConditionDisplay;
