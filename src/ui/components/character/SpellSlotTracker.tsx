import React from 'react';
import styles from './SpellSlotTracker.module.css';

interface SpellSlot {
    current: number;
    max: number;
}

interface SpellSlotTrackerProps {
    slots: Record<string, SpellSlot>;
    className?: string;
}

const SpellSlotTracker: React.FC<SpellSlotTrackerProps> = ({ slots, className = '' }) => {
    const levels = Object.keys(slots).sort();

    if (levels.length === 0) return null;

    return (
        <div className={`${styles.container} ${className}`}>
            <h5 className={styles.label}>Spell Slots</h5>
            <div className={styles.grid}>
                {levels.map((level) => (
                    <div key={level} className={styles.slotRow}>
                        <span className={styles.level}>Lvl {level}</span>
                        <div className={styles.dots}>
                            {[...Array(slots[level].max)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`${styles.dot} ${i < slots[level].current ? styles.active : ''}`}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SpellSlotTracker;
