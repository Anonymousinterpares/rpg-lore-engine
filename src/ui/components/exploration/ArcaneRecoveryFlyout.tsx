import React, { useState } from 'react';
import styles from './ArcaneRecoveryFlyout.module.css';
import { Sparkles, X, Check } from 'lucide-react';

interface ArcaneRecoveryFlyoutProps {
    budget: number; // Max total spell levels to recover
    spellSlots: Record<string, { current: number; max: number }>;
    onConfirm: (choices: Record<number, number>) => void;
    onSkip: () => void;
}

const ArcaneRecoveryFlyout: React.FC<ArcaneRecoveryFlyoutProps> = ({
    budget, spellSlots, onConfirm, onSkip
}) => {
    const [selected, setSelected] = useState<Record<number, number>>({});

    // Available slot levels: 1-5 only (Arcane Recovery caps at 5th), must have missing slots
    const recoverableLevels = Object.entries(spellSlots)
        .map(([k, v]) => ({ level: Number(k), current: v.current, max: v.max }))
        .filter(s => s.level >= 1 && s.level <= 5 && s.current < s.max)
        .sort((a, b) => a.level - b.level);

    const usedLevels = Object.entries(selected).reduce((sum, [lv, count]) => sum + Number(lv) * count, 0);
    const remaining = budget - usedLevels;

    const handleToggle = (level: number) => {
        setSelected(prev => {
            const current = prev[level] || 0;
            const slotData = spellSlots[level.toString()];
            const maxRecoverable = slotData ? slotData.max - slotData.current : 0;

            if (current >= maxRecoverable) {
                // Reset this level
                const next = { ...prev };
                delete next[level];
                return next;
            }

            // Check if adding one more would exceed budget
            if (remaining < level) return prev;

            return { ...prev, [level]: current + 1 };
        });
    };

    const handleConfirm = () => {
        const choices: Record<number, number> = {};
        for (const [lv, count] of Object.entries(selected)) {
            if (count > 0) choices[Number(lv)] = count;
        }
        onConfirm(choices);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <Sparkles size={18} className={styles.icon} />
                    <h3>Arcane Recovery</h3>
                    <button className={styles.closeBtn} onClick={onSkip}><X size={18} /></button>
                </div>

                <p className={styles.desc}>
                    Recover expended spell slots. Budget: <strong>{budget}</strong> total levels (max 5th level).
                </p>

                <div className={styles.budget}>
                    <span>Used: {usedLevels} / {budget}</span>
                    <span className={remaining > 0 ? styles.remaining : styles.spent}>
                        {remaining > 0 ? `${remaining} remaining` : 'Budget spent'}
                    </span>
                </div>

                <div className={styles.slotGrid}>
                    {recoverableLevels.map(({ level, current, max }) => {
                        const chosen = selected[level] || 0;
                        const canAdd = remaining >= level && current + chosen < max;
                        return (
                            <button
                                key={level}
                                className={`${styles.slotBtn} ${chosen > 0 ? styles.slotSelected : ''} ${!canAdd && chosen === 0 ? styles.slotDisabled : ''}`}
                                onClick={() => handleToggle(level)}
                            >
                                <span className={styles.slotLevel}>L{level}</span>
                                <span className={styles.slotCount}>{current + chosen}/{max}</span>
                                {chosen > 0 && <span className={styles.slotChosen}>+{chosen}</span>}
                            </button>
                        );
                    })}
                </div>

                {recoverableLevels.length === 0 && (
                    <p className={styles.empty}>All spell slots are full.</p>
                )}

                <div className={styles.footer}>
                    <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
                    <button
                        className={styles.confirmBtn}
                        onClick={handleConfirm}
                        disabled={usedLevels === 0}
                    >
                        <Check size={16} /> Recover
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArcaneRecoveryFlyout;
