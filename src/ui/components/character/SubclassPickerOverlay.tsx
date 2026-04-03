import React, { useState } from 'react';
import styles from './SubclassPickerOverlay.module.css';
import { Award, Check, X } from 'lucide-react';

interface SubclassOption {
    name: string;
    description: string;
    features: { level: number; name: string; description: string }[];
    spells?: Record<string, string[]>;
}

interface SubclassPickerOverlayProps {
    className: string; // "Wizard", "Fighter", etc.
    currentLevel: number;
    subclasses: SubclassOption[];
    onConfirm: (subclassName: string) => void;
    onClose: () => void;
}

const SubclassPickerOverlay: React.FC<SubclassPickerOverlayProps> = ({
    className: charClass, currentLevel, subclasses, onConfirm, onClose
}) => {
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <Award size={20} className={styles.icon} />
                    <h2>Choose Your Path</h2>
                    <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
                </div>
                <p className={styles.desc}>
                    As a {charClass}, you must choose your specialization. This choice shapes your abilities for the rest of your journey.
                </p>

                <div className={styles.list}>
                    {subclasses.map(sc => {
                        const isSelected = selected === sc.name;
                        const initialFeatures = sc.features.filter(f => f.level <= currentLevel);
                        return (
                            <div
                                key={sc.name}
                                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                                onClick={() => setSelected(isSelected ? null : sc.name)}
                            >
                                <div className={styles.cardHeader}>
                                    <strong className={styles.cardName}>{sc.name}</strong>
                                </div>
                                <p className={styles.cardDesc}>{sc.description}</p>
                                {initialFeatures.length > 0 && (
                                    <div className={styles.featurePreview}>
                                        <span className={styles.featureLabel}>Features at Level {currentLevel}:</span>
                                        {initialFeatures.map((f, i) => (
                                            <div key={i} className={styles.featureItem}>
                                                <span className={styles.featureName}>{f.name}</span>
                                                <span className={styles.featureDesc}>{f.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {sc.spells && Object.keys(sc.spells).length > 0 && (
                                    <div className={styles.spellPreview}>
                                        <span className={styles.featureLabel}>Domain Spells:</span>
                                        {Object.entries(sc.spells)
                                            .filter(([lv]) => parseInt(lv) <= currentLevel)
                                            .map(([lv, spells]) => (
                                                <span key={lv} className={styles.spellEntry}>
                                                    L{lv}: {(spells as string[]).join(', ')}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button
                        className={styles.confirmBtn}
                        disabled={!selected}
                        onClick={() => selected && onConfirm(selected)}
                    >
                        <Check size={16} /> Confirm Choice
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubclassPickerOverlay;
