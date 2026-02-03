import React from 'react';
import styles from './InitiativeTracker.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Shield, ChevronRight } from 'lucide-react';

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
    className?: string;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({ combatants, currentTurnId, className = '' }) => {
    return (
        <div className={`${styles.container} ${glassStyles.glassPanel} ${className}`}>
            <h3 className={styles.title}>Initiative</h3>
            <div className={styles.list}>
                {combatants.map((c) => (
                    <div
                        key={c.id}
                        className={`${styles.item} ${c.id === currentTurnId ? styles.active : ''} ${c.isPlayer ? styles.player : styles.enemy}`}
                    >
                        {c.id === currentTurnId && <ChevronRight className={styles.indicator} size={16} />}
                        <span className={styles.name}>{c.name}</span>
                        <div className={styles.details}>
                            <span className={styles.init}>{c.initiative}</span>
                            <div className={styles.miniHp}>
                                <div
                                    className={styles.hpBar}
                                    style={{ width: `${(c.hp.current / c.hp.max) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InitiativeTracker;
