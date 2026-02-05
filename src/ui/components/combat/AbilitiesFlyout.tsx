import React from 'react';
import styles from './AbilitiesFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Zap } from 'lucide-react';
import { CombatAbility } from '../../../ruleset/combat/AbilityParser';

interface AbilitiesFlyoutProps {
    abilities: CombatAbility[];
    onUse: (ability: CombatAbility) => void;
    onClose: () => void;
}

export const AbilitiesFlyout: React.FC<AbilitiesFlyoutProps> = ({
    abilities,
    onUse,
    onClose
}) => {
    return (
        <div className={`${styles.flyout} ${parchmentStyles.container}`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Zap size={18} className={styles.titleIcon} />
                    <h3>Class Abilities</h3>
                </div>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className={styles.abilityGrid}>
                {abilities.map(ability => {
                    const hasUsage = ability.usage !== undefined;
                    const canUse = !hasUsage || (ability.usage && ability.usage.current > 0);

                    return (
                        <button
                            key={ability.name}
                            className={`${styles.abilityItem} ${parchmentStyles.button}`}
                            onClick={() => canUse && onUse(ability)}
                            disabled={!canUse}
                            title={ability.description}
                        >
                            <div className={styles.abilityHeader}>
                                <span className={styles.abilityName}>{ability.name}</span>
                                <span className={styles.abilityCost}>{ability.actionCost.replace('_', ' ')}</span>
                            </div>
                            <div className={styles.abilityMeta}>
                                {hasUsage && (
                                    <span className={styles.usageInfo}>
                                        Uses: {ability.usage?.current} / {ability.usage?.max} ({ability.usage?.usageType.replace('_', ' ')})
                                    </span>
                                )}
                                {!hasUsage && <span className={styles.passiveTag}>Passive/Perpetual</span>}
                            </div>
                        </button>
                    );
                })}
                {abilities.length === 0 && (
                    <div className={styles.emptyState}>No class abilities available.</div>
                )}
            </div>
        </div>
    );
};

export default AbilitiesFlyout;
