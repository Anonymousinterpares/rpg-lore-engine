import React from 'react';
import styles from './ConditionDisplay.module.css';

interface ConditionDisplayProps {
    conditions: string[];
    className?: string;
}

const ConditionDisplay: React.FC<ConditionDisplayProps> = ({ conditions, className = '' }) => {
    if (conditions.length === 0) return null;

    const getConditionColor = (condition: string) => {
        const c = condition.toLowerCase();
        if (['blinded', 'unconscious', 'paralyzed', 'stunned'].includes(c)) return styles.critical;
        if (['poisoned', 'frightened', 'exhaustion'].includes(c)) return styles.warning;
        return styles.info;
    };

    return (
        <div className={`${styles.container} ${className}`}>
            {conditions.map((condition) => (
                <span
                    key={condition}
                    className={`${styles.badge} ${getConditionColor(condition)}`}
                    title={condition}
                >
                    {condition}
                </span>
            ))}
        </div>
    );
};

export default ConditionDisplay;
