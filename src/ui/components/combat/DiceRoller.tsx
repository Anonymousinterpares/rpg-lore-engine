import React, { useState, useEffect, useRef } from 'react';
import styles from './DiceRoller.module.css';

interface RollResult {
    value: number;
    modifier: number;
    total: number;
    label?: string;
}

interface DiceRollerProps {
    result?: number | RollResult;
    sides?: number;
    isRolling?: boolean;
    className?: string;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ result, sides = 20, isRolling = false, className = '' }) => {
    const [displayValue, setDisplayValue] = useState<number | null>(null);
    const [animating, setAnimating] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const prevResult = useRef<number | RollResult | undefined>(undefined);

    const getRawValue = (res: number | RollResult | undefined): number | undefined => {
        if (res === undefined) return undefined;
        return typeof res === 'number' ? res : res.value;
    };

    const rawResult = getRawValue(result);

    // Auto-trigger animation when result changes
    useEffect(() => {
        if (result !== undefined && JSON.stringify(result) !== JSON.stringify(prevResult.current)) {
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
                    setDisplayValue(getRawValue(result) ?? null);
                    setAnimating(false);
                    setShowResult(true);

                    // Hide glow after 3 seconds (slightly longer for reading math)
                    setTimeout(() => setShowResult(false), 3000);
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

    const isCrit = rawResult === sides; // Generic crit logic based on sides
    const isFumble = rawResult === 1;

    const renderBreakdown = () => {
        if (!showResult || typeof result === 'number' || !result) return null;
        const sign = result.modifier >= 0 ? '+' : '-';
        return (
            <div className={styles.breakdown}>
                <span className={styles.rollVal}>{result.value}</span>
                <span className={styles.mod}>{sign} {Math.abs(result.modifier)}</span>
                <span className={styles.equals}>=</span>
                <span className={styles.total}>{result.total}</span>
            </div>
        );
    };

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

            {showResult && typeof result !== 'number' && result ? (
                <div className={styles.label}>
                    {renderBreakdown()}
                    {isCrit && <div className={styles.critLabel}>CRITICAL!</div>}
                    {isFumble && <div className={styles.fumbleLabel}>FUMBLE!</div>}
                </div>
            ) : (
                <div className={styles.label}>
                    D{sides}
                    {isCrit && showResult && <span className={styles.critLabel}> CRITICAL!</span>}
                    {isFumble && showResult && <span className={styles.fumbleLabel}> FUMBLE!</span>}
                </div>
            )}
        </div>
    );
};

export default DiceRoller;
