import React, { useState, useEffect } from 'react';
import styles from './CharacterCreator.module.css';
import { DataManager } from '../../../ruleset/data/DataManager';
import { CharacterFactory } from '../../../ruleset/factories/CharacterFactory';
import { Race } from '../../../ruleset/schemas/RaceSchema';
import { CharacterClass } from '../../../ruleset/schemas/ClassSchema';
import { Background } from '../../../ruleset/schemas/BackgroundSchema';
import { GameState } from '../../../ruleset/schemas/FullSaveStateSchema';
import { ArrowRight, ArrowLeft, Check, Dice5 } from 'lucide-react';

interface CharacterCreatorProps {
    onComplete: (state: GameState) => void;
    onCancel: () => void;
}

const STEPS = ['Identity', 'Race', 'Class', 'Background', 'Abilities', 'Review'];

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);

    const [races, setRaces] = useState<Race[]>([]);
    const [classes, setClasses] = useState<CharacterClass[]>([]);
    const [backgrounds, setBackgrounds] = useState<Background[]>([]);

    // Form State
    const [name, setName] = useState('');
    const [selectedRace, setSelectedRace] = useState<Race | null>(null);
    const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
    const [selectedBackground, setSelectedBackground] = useState<Background | null>(null);
    const [abilities, setAbilities] = useState({
        STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
    });

    useEffect(() => {
        const init = async () => {
            await DataManager.initialize();
            setRaces(DataManager.getRaces());
            setClasses(DataManager.getClasses());
            setBackgrounds(DataManager.getBackgrounds());
            setLoading(false);
        };
        init();
    }, []);

    const handleNext = () => {
        if (step < STEPS.length - 1) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 0) setStep(step - 1);
    };

    const handleFinish = () => {
        if (!selectedRace || !selectedClass || !selectedBackground) return;

        const newState = CharacterFactory.createNewGameState({
            name: name || 'Traveler',
            race: selectedRace,
            characterClass: selectedClass,
            background: selectedBackground,
            abilityScores: abilities
        });

        onComplete(newState);
    };

    const rollStats = () => {
        // Simple 4d6 drop lowest generator
        const roll = () => {
            const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
            dice.sort((a, b) => a - b);
            return dice.slice(1).reduce((a, b) => a + b, 0);
        };
        setAbilities({
            STR: roll(), DEX: roll(), CON: roll(), INT: roll(), WIS: roll(), CHA: roll()
        });
    };

    const handleAbilityChange = (key: string, value: string) => {
        let val = parseInt(value) || 0;
        // Clamp between 3 and 20
        val = Math.max(3, Math.min(20, val));
        setAbilities({ ...abilities, [key]: val });
    };

    if (loading) return <div className={styles.overlay}><div className={styles.loader}>Opening the Rulebooks...</div></div>;

    const renderStepContent = () => {
        switch (step) {
            case 0: // Identity
                return (
                    <div className={styles.stepContainer}>
                        <h3>Who are you?</h3>
                        <div className={styles.inputGroup}>
                            <label>Character Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Enter name..."
                                className={styles.input}
                                autoFocus
                            />
                        </div>
                    </div>
                );
            case 1: // Race
                return (
                    <div className={styles.selectionLayout}>
                        <div className={styles.gridContainer}>
                            {races.map(r => (
                                <div
                                    key={r.name}
                                    className={`${styles.card} ${selectedRace?.name === r.name ? styles.selected : ''}`}
                                    onClick={() => setSelectedRace(r)}
                                >
                                    <h4>{r.name}</h4>
                                    <p className={styles.smallInfo}><strong>Speed:</strong> {r.speed}ft | <strong>Size:</strong> {r.size}</p>
                                    <p className={styles.smallInfo}>{r.traits.map(t => t.name).join(', ')}</p>
                                </div>
                            ))}
                        </div>
                        {selectedRace && (
                            <div className={styles.detailsPanel}>
                                <h3>{selectedRace.name} Traits</h3>
                                <div className={styles.detailsContent}>
                                    {selectedRace.traits.map(t => (
                                        <div key={t.name} className={styles.detailItem}>
                                            <div className={styles.detailName}>{t.name}</div>
                                            <div className={styles.detailDesc}>{t.description}</div>
                                        </div>
                                    ))}
                                    <div className={styles.detailItem}>
                                        <div className={styles.detailName}>Ability Score Increases</div>
                                        <div className={styles.detailDesc}>
                                            {Object.entries(selectedRace.abilityScoreIncreases).map(([stat, bonus]) => `${stat} +${bonus}`).join(', ')}
                                        </div>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <div className={styles.detailName}>Languages</div>
                                        <div className={styles.detailDesc}>{selectedRace.languages.join(', ')}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 2: // Class
                return (
                    <div className={styles.selectionLayout}>
                        <div className={styles.gridContainer}>
                            {classes.map(c => (
                                <div
                                    key={c.name}
                                    className={`${styles.card} ${selectedClass?.name === c.name ? styles.selected : ''}`}
                                    onClick={() => setSelectedClass(c)}
                                >
                                    <h4>{c.name}</h4>
                                    <p className={styles.smallInfo}><strong>Hit Die:</strong> {c.hitDie} | <strong>Primary:</strong> {c.primaryAbility.join(', ')}</p>
                                </div>
                            ))}
                        </div>
                        {selectedClass && (
                            <div className={styles.detailsPanel}>
                                <h3>{selectedClass.name} Features</h3>
                                <div className={styles.detailsContent}>
                                    {selectedClass.allFeatures.filter(f => f.level === 1).map(f => (
                                        <div key={f.name} className={styles.detailItem}>
                                            <div className={styles.detailName}>{f.name}</div>
                                            <div className={styles.detailDesc}>{f.description}</div>
                                        </div>
                                    ))}
                                    <div className={styles.detailItem}>
                                        <div className={styles.detailName}>Proficiencies</div>
                                        <div className={styles.detailDesc}>
                                            <strong>Armor:</strong> {selectedClass.armorProficiencies.join(', ') || 'None'}<br />
                                            <strong>Weapons:</strong> {selectedClass.weaponProficiencies.join(', ') || 'None'}<br />
                                            <strong>Saves:</strong> {selectedClass.savingThrowProficiencies.join(', ')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 3: // Background
                return (
                    <div className={styles.selectionLayout}>
                        <div className={styles.gridContainer}>
                            {backgrounds.map(b => (
                                <div
                                    key={b.name}
                                    className={`${styles.card} ${selectedBackground?.name === b.name ? styles.selected : ''}`}
                                    onClick={() => setSelectedBackground(b)}
                                >
                                    <h4>{b.name}</h4>
                                    <p className={styles.smallInfo}>{b.description.length > 100 ? b.description.substring(0, 100) + '...' : b.description}</p>
                                </div>
                            ))}
                        </div>
                        {selectedBackground && (
                            <div className={styles.detailsPanel}>
                                <h3>{selectedBackground.name} Background</h3>
                                <div className={styles.detailsContent}>
                                    <div className={styles.detailItem}>
                                        <div className={styles.detailName}>{selectedBackground.feature.name}</div>
                                        <div className={styles.detailDesc}>{selectedBackground.feature.description}</div>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <div className={styles.detailName}>Proficiencies & Languages</div>
                                        <div className={styles.detailDesc}>
                                            <strong>Skills:</strong> {selectedBackground.skillProficiencies.join(', ')}<br />
                                            {selectedBackground.toolProficiencies.length > 0 && <><strong>Tools:</strong> {selectedBackground.toolProficiencies.join(', ')}<br /></>}
                                            {selectedBackground.languages.length > 0 && <><strong>Languages:</strong> {selectedBackground.languages.join(', ')}</>}
                                        </div>
                                    </div>
                                    {selectedBackground.personalitySuggested && (
                                        <div className={styles.detailItem}>
                                            <div className={styles.detailName}>Sample Traits</div>
                                            <div className={styles.detailDesc}>{selectedBackground.personalitySuggested.traits[0]}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 4: // Abilities
                return (
                    <div className={styles.stepContainer}>
                        <div className={styles.statsHeader}>
                            <h3>Ability Scores</h3>
                            <button className={styles.rollButton} onClick={rollStats}><Dice5 size={18} /> Roll Stats</button>
                        </div>
                        <div className={styles.statsGrid}>
                            {Object.entries(abilities).map(([key, val]) => (
                                <div key={key} className={styles.statBox}>
                                    <label>{key}</label>
                                    <input
                                        type="number"
                                        value={val}
                                        onChange={e => handleAbilityChange(key, e.target.value)}
                                        min={3} max={20}
                                    />
                                    <span className={styles.mod}>{Math.floor((val - 10) / 2) >= 0 ? '+' : ''}{Math.floor((val - 10) / 2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 5: // Review
                return (
                    <div className={styles.summary}>
                        <h3>Review Character</h3>
                        <p><strong>Name:</strong> {name || 'Unknown'}</p>
                        <p><strong>Race:</strong> {selectedRace?.name}</p>
                        <p><strong>Class:</strong> {selectedClass?.name}</p>
                        <p><strong>Background:</strong> {selectedBackground?.name}</p>
                        <div className={styles.statsSummary}>
                            {Object.entries(abilities).map(([k, v]) => <span key={k}>{k}:{v}</span>)}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const isNextDisabled = () => {
        if (step === 0 && name.trim().length === 0) return true;
        if (step === 1 && !selectedRace) return true;
        if (step === 2 && !selectedClass) return true;
        if (step === 3 && !selectedBackground) return true;
        return false;
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Character Creation</h2>
                    <div className={styles.steps}>
                        {STEPS.map((s, i) => (
                            <span key={s} className={i === step ? styles.activeStep : (i < step ? styles.completedStep : styles.inactiveStep)}>
                                {s}
                            </span>
                        ))}
                    </div>
                </div>

                <div className={styles.content}>
                    {renderStepContent()}
                </div>

                <div className={styles.footer}>
                    <button className={styles.secondaryButton} onClick={step === 0 ? onCancel : handleBack}>
                        {step === 0 ? 'Cancel' : <><ArrowLeft size={16} /> Back</>}
                    </button>

                    {step < STEPS.length - 1 ? (
                        <button className={styles.primaryButton} onClick={handleNext} disabled={isNextDisabled()}>
                            Next <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button className={styles.primaryButton} onClick={handleFinish}>
                            Start Adventure <Check size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CharacterCreator;
