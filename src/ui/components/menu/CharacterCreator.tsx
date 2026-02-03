import React, { useState } from 'react';
import styles from './CharacterCreator.module.css';
import glassStyles from '../../styles/glass.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { User, Shield, Zap, BookOpen, Wand2, ArrowRight, ArrowLeft, Check } from 'lucide-react';

const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc'];
const CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Paladin'];

const CharacterCreator: React.FC<{ onComplete: (char: any) => void; onCancel: () => void }> = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState(1);
    const [char, setChar] = useState({
        name: '',
        race: 'Human',
        class: 'Fighter',
        stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        background: 'Soldier'
    });

    const nextStep = () => setStep(s => Math.min(s + 1, 5));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const updateStat = (stat: string, val: number) => {
        setChar({ ...char, stats: { ...char.stats, [stat]: val } });
    };

    return (
        <div className={styles.overlay}>
            <div className={`${parchmentStyles.panel} ${styles.modal}`}>
                <div className={styles.header}>
                    <h2>Character Creation - Step {step} of 5</h2>
                    <div className={styles.progress}>
                        {[1, 2, 3, 4, 5].map(s => (
                            <div key={s} className={`${styles.dot} ${s <= step ? styles.activeDot : ''}`} />
                        ))}
                    </div>
                </div>

                <div className={styles.content}>
                    {step === 1 && (
                        <div className={styles.step}>
                            <h3>Select Your Race</h3>
                            <div className={styles.optionsGrid}>
                                {RACES.map(r => (
                                    <button
                                        key={r}
                                        className={`${styles.optionCard} ${char.race === r ? styles.selected : ''}`}
                                        onClick={() => setChar({ ...char, race: r })}
                                    >
                                        <span>{r}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className={styles.step}>
                            <h3>Choose Your Path</h3>
                            <div className={styles.optionsGrid}>
                                {CLASSES.map(c => (
                                    <button
                                        key={c}
                                        className={`${styles.optionCard} ${char.class === c ? styles.selected : ''}`}
                                        onClick={() => setChar({ ...char, class: c })}
                                    >
                                        <span>{c}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className={styles.step}>
                            <h3>Distribute Attributes</h3>
                            <div className={styles.statsEditor}>
                                {Object.entries(char.stats).map(([stat, val]) => (
                                    <div key={stat} className={styles.statRow}>
                                        <span className={styles.statLabel}>{stat}</span>
                                        <div className={styles.statControls}>
                                            <button onClick={() => updateStat(stat, val - 1)}>-</button>
                                            <span className={styles.statValue}>{val}</span>
                                            <button onClick={() => updateStat(stat, val + 1)}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className={styles.step}>
                            <h3>Define Your Origins</h3>
                            <select
                                className={styles.input}
                                value={char.background}
                                onChange={(e) => setChar({ ...char, background: e.target.value })}
                            >
                                <option value="Soldier">Soldier</option>
                                <option value="Acolyte">Acolyte</option>
                                <option value="Criminal">Criminal</option>
                                <option value="Sage">Sage</option>
                            </select>
                        </div>
                    )}

                    {step === 5 && (
                        <div className={styles.step}>
                            <h3>Finalize</h3>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Hero Name..."
                                value={char.name}
                                onChange={(e) => setChar({ ...char, name: e.target.value })}
                            />
                            <div className={styles.summary}>
                                <p><strong>{char.name || 'Unnamed Hero'}</strong></p>
                                <p>{char.race} {char.class}</p>
                                <p>Background: {char.background}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={onCancel}>Cancel</button>
                    <div className={styles.navButtons}>
                        {step > 1 && <button onClick={prevStep}><ArrowLeft size={18} /> Back</button>}
                        {step < 5 ? (
                            <button className={styles.primaryButton} onClick={nextStep}>Next <ArrowRight size={18} /></button>
                        ) : (
                            <button className={styles.primaryButton} onClick={() => onComplete(char)}>Create <Check size={18} /></button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterCreator;
