import React, { useState, useEffect } from 'react';
import styles from './DiceRoller.module.css';
import { Dices } from 'lucide-react';

interface DiceRollerProps {
    result?: number;
    sides?: number;
    isRolling?: boolean;
    className?: string;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ result, sides = 20, isRolling = false, className = '' }) => {
    const [displayValue, setDisplayValue] = useState(result || sides);

    useEffect(() => {
        let interval: any;
        if (isRolling) {
            interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * sides) + 1);
            }, 50);
        } else {
            setDisplayValue(result || displayValue);
        }
        return () => clearInterval(interval);
    }, [isRolling, result, sides, displayValue]);

    return (
        <div className={`${styles.container} ${className}`}>
            <div className={`${styles.die} ${isRolling ? styles.rolling : ''}`}>
                <Dices size={24} className={styles.icon} />
                <span className={styles.value}>{displayValue}</span>
            </div>
            <div className={styles.label}>D{sides}</div>
        </div>
    );
};

export default DiceRoller;
