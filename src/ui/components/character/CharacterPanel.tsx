import React from 'react';
import styles from './CharacterPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import HealthBar from './HealthBar';
import ConditionDisplay from './ConditionDisplay';
import SpellSlotTracker from './SpellSlotTracker';
import { Sword, Shield, Zap } from 'lucide-react';

const CharacterPanel: React.FC = () => {
    // Mock data for initial visualization
    const char = {
        name: "Lirael",
        class: "Ranger",
        level: 3,
        hp: { current: 24, max: 28, temp: 0 },
        ac: 15,
        initiative: "+3",
        stats: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 14, CHA: 10 },
        conditions: ["Poisoned", "Inspired"],
        spellSlots: {
            "1": { current: 3, max: 4 },
            "2": { current: 1, max: 2 }
        }
    };

    return (
        <div className={`${parchmentStyles.panel} ${styles.panel}`}>
            <div className={styles.header}>
                <h2 className={styles.name}>{char.name}</h2>
                <div className={styles.level}>Level {char.level} {char.class}</div>
            </div>

            <div className={styles.statsRow}>
                <div className={styles.statBox}>
                    <Shield size={16} />
                    <span className={styles.statValue}>{char.ac}</span>
                    <span className={styles.statLabel}>AC</span>
                </div>
                <div className={styles.statBox}>
                    <Zap size={16} />
                    <span className={styles.statValue}>{char.initiative}</span>
                    <span className={styles.statLabel}>INIT</span>
                </div>
            </div>

            <HealthBar current={char.hp.current} max={char.hp.max} />

            <ConditionDisplay conditions={char.conditions} />

            <div className={styles.abilityGrid}>
                {Object.entries(char.stats).map(([stat, val]) => (
                    <div key={stat} className={styles.abilityBox}>
                        <div className={styles.abilityLabel}>{stat}</div>
                        <div className={styles.abilityValue}>{val}</div>
                    </div>
                ))}
            </div>

            <SpellSlotTracker slots={char.spellSlots} />
        </div>
    );
};

export default CharacterPanel;
