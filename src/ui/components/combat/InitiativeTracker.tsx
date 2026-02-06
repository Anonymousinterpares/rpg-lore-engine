import React from 'react';
import styles from './InitiativeTracker.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { ChevronRight } from 'lucide-react';

interface Combatant {
    id: string;
    name: string;
    initiative: number;
    hp: { current: number, max: number };
    isPlayer: boolean;
}

interface InitiativeTrackerProps {
    combatants: Combatant[];
    currentTurnId: string;
    selectedTargetId?: string;
    onSelectTarget?: (id: string) => void;
    className?: string;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    combatants,
    currentTurnId,
    selectedTargetId,
    onSelectTarget,
    className = ''
}) => {
    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.list}>
                {combatants.map((c) => {
                    const hpPercent = Math.max(0, Math.min(100, (c.hp.current / c.hp.max) * 100));
                    const isActive = c.id === currentTurnId;
                    const isSelected = c.id === selectedTargetId;

                    return (
                        <div
                            key={c.id}
                            className={`${styles.combatant} ${isActive ? styles.active : ''} ${c.isPlayer ? styles.player : styles.enemy} ${isSelected ? styles.selected : ''}`}
                            onClick={() => !c.isPlayer && onSelectTarget?.(c.id)}
                        >
                            {isActive && <ChevronRight className={styles.indicator} size={14} />}
                            <div className={styles.info}>
                                <span className={styles.name}>{c.name}</span>
                                <span className={styles.init}>({c.initiative})</span>
                            </div>
                            <div className={styles.hpContainer}>
                                <div className={styles.hpBar} style={{ width: `${hpPercent}%` }} />
                                <span className={styles.hpText}>{Math.floor(c.hp.current)}/{c.hp.max}</span>
                            </div>
                            {isSelected && <div className={styles.targetLabel}>TARGET</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InitiativeTracker;
