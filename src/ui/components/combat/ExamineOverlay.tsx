import React, { useState, useEffect } from 'react';
import styles from './ExamineOverlay.module.css';
import DiceRoller from './DiceRoller';

interface SkillCheckData {
    id: string;
    dieValue: number;
    modifier: number;
    total: number;
    dc: number;
    success: boolean;
    skillName: string;
    label: string;
}

interface ExamineOverlayProps {
    skillCheck: SkillCheckData;
    onComplete: () => void;
}

// Phases: rolling → diceResult (DiceRoller shows value) → verdict (SUCCESS/FAILURE) → fadeout → destroy
type Phase = 'rolling' | 'diceResult' | 'verdict' | 'fadeout';

// DiceRoller internal animation: 15 cycles × 50ms = 750ms
// We wait 900ms (with margin) before showing the result prop
const ROLL_ANIMATION = 900;
// After DiceRoller shows its result, show breakdown for 800ms before verdict
const BREAKDOWN_HOLD = 800;
// Verdict (SUCCESS/FAILURE) stays for 1500ms
const VERDICT_HOLD = 1500;
const FADEOUT_DURATION = 400;

const ExamineOverlay: React.FC<ExamineOverlayProps> = ({ skillCheck, onComplete }) => {
    const [phase, setPhase] = useState<Phase>('rolling');

    useEffect(() => {
        // Phase 1: Rolling animation (DiceRoller shows random numbers)
        // Phase 2: DiceRoller receives result, shows final value + breakdown
        const t1 = setTimeout(() => setPhase('diceResult'), ROLL_ANIMATION);
        // Phase 3: Show SUCCESS/FAILURE verdict
        const t2 = setTimeout(() => setPhase('verdict'), ROLL_ANIMATION + BREAKDOWN_HOLD);
        // Phase 4: Fade out
        const t3 = setTimeout(() => setPhase('fadeout'), ROLL_ANIMATION + BREAKDOWN_HOLD + VERDICT_HOLD);
        // Phase 5: Destroy
        const t4 = setTimeout(() => onComplete(), ROLL_ANIMATION + BREAKDOWN_HOLD + VERDICT_HOLD + FADEOUT_DURATION);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [onComplete]);

    const rollResult = {
        value: skillCheck.dieValue,
        modifier: skillCheck.modifier,
        total: skillCheck.total,
        label: skillCheck.label,
    };

    const showDiceResult = phase !== 'rolling';
    const showBreakdown = phase !== 'rolling';
    const showVerdict = phase === 'verdict' || phase === 'fadeout';
    const modSign = skillCheck.modifier >= 0 ? '+' : '';

    return (
        <div className={`${styles.overlay} ${phase === 'fadeout' ? styles.fadeout : ''}`}>
            <div className={styles.panel}>
                <div className={styles.label}>{skillCheck.label}</div>

                <div className={styles.diceArea}>
                    <DiceRoller
                        result={showDiceResult ? rollResult : undefined}
                        sides={20}
                        isRolling={phase === 'rolling'}
                    />
                </div>

                {showBreakdown && (
                    <div className={styles.breakdown}>
                        <span className={styles.roll}>d20: {skillCheck.dieValue}</span>
                        <span className={styles.mod}>{modSign}{skillCheck.modifier}</span>
                        <span className={styles.equals}>=</span>
                        <span className={styles.total}>{skillCheck.total}</span>
                        <span className={styles.vs}>vs DC {skillCheck.dc}</span>
                    </div>
                )}

                {showVerdict && (
                    <div className={`${styles.verdict} ${skillCheck.success ? styles.success : styles.failure}`}>
                        {skillCheck.success ? 'SUCCESS' : 'FAILURE'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExamineOverlay;
