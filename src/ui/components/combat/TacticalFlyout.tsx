import React from 'react';
import styles from './TacticalFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Shield, Zap, Sword, Move, Target } from 'lucide-react';
import { TacticalOption } from '../../../ruleset/combat/grid/CombatAnalysisEngine';

interface TacticalFlyoutProps {
    options: TacticalOption[];
    onSelect: (option: TacticalOption) => void;
    onClose: () => void;
}

const getOptionIcon = (type: string) => {
    switch (type) {
        case 'SAFETY': return <Shield size={20} />;
        case 'FLANKING': return <Target size={20} />;
        case 'AGGRESSION': return <Sword size={20} />;
        case 'RETREAT': return <Zap size={20} />;
        default: return <Move size={20} />;
    }
};

export const TacticalFlyout: React.FC<TacticalFlyoutProps> = ({
    options,
    onSelect,
    onClose
}) => {
    return (
        <div className={`${styles.flyout} ${parchmentStyles.container}`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Move size={18} className={styles.titleIcon} />
                    <h3>Tactical Maneuvers</h3>
                </div>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className={styles.grid}>
                {options.map((option) => (
                    <div
                        key={option.id}
                        className={`${styles.item} ${parchmentStyles.button}`}
                        onClick={() => onSelect(option)}
                    >
                        <div className={styles.iconContainer}>
                            {getOptionIcon(option.type)}
                        </div>
                        <div className={styles.content}>
                            <div className={styles.optionHeader}>
                                <span className={styles.label}>{option.label}</span>
                                <span className={styles.typeTag}>{option.type}</span>
                            </div>
                            <p className={styles.description}>{option.description}</p>

                            {(option.pros || option.cons) && (
                                <div className={styles.badges}>
                                    {option.pros?.map((pro, i) => (
                                        <span key={`pro-${i}`} className={styles.proBadge}>+{pro}</span>
                                    ))}
                                    {option.cons?.map((con, i) => (
                                        <span key={`con-${i}`} className={styles.conBadge}>{con}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {options.length === 0 && (
                    <div className={styles.emptyState}>
                        No tactical maneuvers available in this position.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TacticalFlyout;
