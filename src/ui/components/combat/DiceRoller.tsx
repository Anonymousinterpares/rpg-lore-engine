import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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

    const renderEnhancedView = () => {
        if (!showResult || typeof result === 'number' || !result) return null;

        const isCrit = result.value === sides;
        const isFumble = result.value === 1;
        const sign = result.modifier >= 0 ? '+' : '-';

        let resultColorClass = '';
        if (isCrit) resultColorClass = styles.resGold;
        else if (isFumble) resultColorClass = styles.resRed;
        else if (result.modifier > 0) resultColorClass = styles.resGreen;
        else if (result.modifier < 0) resultColorClass = styles.resRed;

        // Enhanced: Breakdown visual
        // We look for 'details' in the result, or we might need to update the prop type?
        // The result prop is 'RollResult' or 'number'.
        // Let's assume result might extend RollResult with breakdown data or we update the interface in this file.
        const breakdown = (result as any).breakdown || (result as any).rollDetails?.modifiers;

        return (
            <div className={styles.enhancedContainer}>
                <div className={styles.dieSection}>
                    <div className={`${styles.die} ${isCrit ? styles.crit : ''} ${isFumble ? styles.fumble : ''}`} style={{ width: '50px', height: '50px' }}>
                        <svg className={styles.d20Svg} viewBox="0 0 100 100">
                            <polygon points="50,5 95,30 95,70 50,95 5,70 5,30" className={styles.d20Shape} />
                        </svg>
                        <span className={styles.value} style={{ fontSize: '1.4rem' }}>{result.value}</span>
                    </div>
                    <div className={styles.calculationRow}>
                        <span>{result.value}</span>
                        <span className={result.modifier >= 0 ? styles.modPositive : styles.modNegative}>
                            {sign} {Math.abs(result.modifier)}
                        </span>
                    </div>
                </div>

                {/* Subtle Breakdown Row */}
                {breakdown && Array.isArray(breakdown) && (
                    <div className={styles.breakdownRow} style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                        {breakdown.map((mod: any, i: number) => (
                            <span key={i}>
                                {i > 0 && ", "}
                                {mod.label} {mod.value >= 0 ? '+' : ''}{mod.value}
                            </span>
                        ))}
                    </div>
                )}

                <div className={styles.mathSection}>
                    <div className={`${styles.finalResult} ${resultColorClass}`}>
                        {result.total}
                    </div>
                    {isCrit && <div className={styles.critLabel} style={{ fontSize: '0.6rem' }}>CRIT!</div>}
                    {isFumble && <div className={styles.fumbleLabel} style={{ fontSize: '0.6rem' }}>FUMBLE!</div>}
                </div>
            </div>
        );
    };

    if (showResult && typeof result !== 'number' && result) {
        return renderEnhancedView();
    }

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
