import React from 'react';
import styles from './CombatantStatusCard.module.css';
import { Combatant, GridPosition } from '../../../ruleset/schemas/CombatSchema';

interface CombatantStatusCardProps {
    combatant: Combatant;
    playerPos: GridPosition;
    cover: string;
    lighting: string;
    onClose: () => void;
}

const CombatantStatusCard: React.FC<CombatantStatusCardProps> = ({
    combatant,
    playerPos,
    cover,
    lighting,
    onClose
}) => {
    // Calculate distance (Chebyshev)
    const distance = Math.max(
        Math.abs(combatant.position.x - playerPos.x),
        Math.abs(combatant.position.y - playerPos.y)
    );

    return (
        <div className={styles.card}>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
            <div className={styles.header}>
                <h3 className={styles.name}>{combatant.name}</h3>
                <span className={styles.tier}>Tier: {combatant.type}</span>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                    <span className={styles.label}>HP</span>
                    <div className={styles.hpBar}>
                        <div
                            className={styles.hpFill}
                            style={{ width: `${(combatant.hp.current / combatant.hp.max) * 100}%` }}
                        />
                    </div>
                </div>

                <div className={styles.statItem}>
                    <span className={styles.label}>AC</span>
                    <span className={styles.value}>{combatant.ac}</span>
                </div>

                <div className={styles.statItem}>
                    <span className={styles.label}>Distance</span>
                    <span className={styles.value}>{distance * 5}ft ({distance} cells)</span>
                </div>

                <div className={styles.statItem}>
                    <span className={styles.label}>Cover</span>
                    <span className={styles.value}>{cover}</span>
                </div>

                <div className={styles.statItem}>
                    <span className={styles.label}>Lighting</span>
                    <span className={styles.value}>{lighting}</span>
                </div>
            </div>

            <div className={styles.conditions}>
                {combatant.statusEffects.map((effect: { id: string }) => (
                    <span key={effect.id} className={styles.conditionTag}>
                        {effect.id}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default CombatantStatusCard;
