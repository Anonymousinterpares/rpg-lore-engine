import React from 'react';
import styles from './CharacterPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import HealthBar from './HealthBar';
import ConditionDisplay from './ConditionDisplay';
import SpellSlotTracker from './SpellSlotTracker';
import { Sword, Shield, Zap } from 'lucide-react';

import { useGameState } from '../../hooks/useGameState';

const CharacterPanel: React.FC = () => {
    const { state } = useGameState();

    if (!state || !state.character) {
        return <div className={styles.loading}>No character active</div>;
    }

    const char = state.character;

    // Helper to format initiative
    const dex = char.stats.DEX ?? 10;
    const initiative = Math.floor((dex - 10) / 2);
    const initiativeStr = (initiative >= 0 ? '+' : '') + initiative;

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
                    <span className={styles.statValue}>{initiativeStr}</span>
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

            {char.spellSlots && Object.keys(char.spellSlots).length > 0 && (
                <SpellSlotTracker slots={char.spellSlots} />
            )}
        </div>
    );
};

export default CharacterPanel;
