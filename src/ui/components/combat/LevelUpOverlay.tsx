import React, { useState, useEffect } from 'react';
import styles from './LevelUpOverlay.module.css';

interface LevelUpOverlayProps {
    level: number;
    className: string;
    spGained: number;
    hasASI: boolean;
    onComplete: () => void;
}

const DISPLAY_DURATION = 3500;
const FADEOUT_DURATION = 500;

const LevelUpOverlay: React.FC<LevelUpOverlayProps> = ({ level, className, spGained, hasASI, onComplete }) => {
    const [phase, setPhase] = useState<'enter' | 'display' | 'fadeout'>('enter');

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('display'), 100);
        const t2 = setTimeout(() => setPhase('fadeout'), DISPLAY_DURATION);
        const t3 = setTimeout(() => onComplete(), DISPLAY_DURATION + FADEOUT_DURATION);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [onComplete]);

    return (
        <div className={`${styles.overlay} ${phase === 'fadeout' ? styles.fadeout : ''}`}>
            <div className={styles.content}>
                <div className={styles.sparks} />
                <div className={styles.banner}>
                    <div className={styles.lineTop} />
                    <div className={styles.levelText}>LEVEL UP</div>
                    <div className={styles.levelNumber}>{level}</div>
                    <div className={styles.classText}>{className}</div>
                    <div className={styles.lineBottom} />
                </div>
                <div className={styles.details}>
                    <span className={styles.spGain}>+{spGained} Skill Points</span>
                    {hasASI && <span className={styles.asiGain}>Ability Score Improvement available!</span>}
                </div>
            </div>
        </div>
    );
};

export default LevelUpOverlay;
