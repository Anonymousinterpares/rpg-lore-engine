import React, { useState, useEffect, useRef } from 'react';
import styles from './DiceRoller.module.css';

interface DiceRollerProps {
    result?: number;
    sides?: number;
    isRolling?: boolean;
    className?: string;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ result, sides = 20, isRolling = false, className = '' }) => {
    const [displayValue, setDisplayValue] = useState<number | null>(null);
    const [animating, setAnimating] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const prevResult = useRef<number | undefined>(undefined);

    // Auto-trigger animation when result changes
    useEffect(() => {
        if (result !== undefined && result !== prevResult.current) {
            prevResult.current = result;
            setAnimating(true);
            setShowResult(false);

            // Simulate dice roll animation
            let count = 0;
            const interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * sides) + 1);
                count++;
                if (count >= 15) { // ~0.75 seconds of rolling
                    clearInterval(interval);
                    setDisplayValue(result);
                    setAnimating(false);
                    setShowResult(true);

                    // Hide glow after 2 seconds
                    setTimeout(() => setShowResult(false), 2000);
                }
            }, 50);

            return () => clearInterval(interval);
        }
    }, [result, sides]);

    // Also respond to external isRolling prop
    useEffect(() => {
        if (isRolling && !animating) {
            setAnimating(true);
            const interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * sides) + 1);
            }, 50);
            return () => clearInterval(interval);
        }
    }, [isRolling, animating, sides]);

    const isCrit = result === 20;
    const isFumble = result === 1;

    return (
        <div className={`${styles.container} ${className} ${showResult ? styles.resultGlow : ''}`}>
            <div className={`${styles.die} ${animating ? styles.rolling : ''} ${isCrit && showResult ? styles.crit : ''} ${isFumble && showResult ? styles.fumble : ''}`}>
                <svg className={styles.d20Svg} viewBox="0 0 100 100">
                    <polygon
                        points="50,5 95,30 95,70 50,95 5,70 5,30"
                        className={styles.d20Shape}
                    />
                </svg>
                <span className={styles.value}>{displayValue ?? '--'}</span>
            </div>
            <div className={styles.label}>
                D{sides}
                {isCrit && showResult && <span className={styles.critLabel}> CRITICAL!</span>}
                {isFumble && showResult && <span className={styles.fumbleLabel}> FUMBLE!</span>}
            </div>
        </div>
    );
};

export default DiceRoller;
