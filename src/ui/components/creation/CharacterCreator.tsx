import React, { useState, useEffect } from 'react';
import styles from './CharacterCreator.module.css';
import { DataManager } from '../../../ruleset/data/DataManager';
import { CharacterFactory } from '../../../ruleset/factories/CharacterFactory';
import { Race } from '../../../ruleset/schemas/RaceSchema';
import { CharacterClass } from '../../../ruleset/schemas/ClassSchema';
import { Background } from '../../../ruleset/schemas/BackgroundSchema';
import { GameState } from '../../../ruleset/schemas/FullSaveStateSchema';
import { ArrowRight, ArrowLeft, Check, Dice5 } from 'lucide-react';
import SkillLink from '../glossary/SkillLink';

interface CharacterCreatorProps {
    onComplete: (state: GameState) => void;
    onCancel: () => void;
}

const STEPS = ['Identity', 'Race', 'Class', 'Background', 'Abilities', 'Skills', 'Review'];

const ALL_SKILLS = [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
    "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
    "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"
];

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
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

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

    // Validate selected skills when race, class, or background changes
    useEffect(() => {
        if (!selectedRace || !selectedClass || !selectedBackground) return;

        const auto = getAutoSkills();
        const classOptions = getClassSkillOptions();
        const raceCount = getRaceSkillChoiceCount();
        const classCount = selectedClass.skillChoices.count;
        const totalMax = raceCount + classCount;

        // Is it a valid choice in current context?
        const isValidChoice = (skill: string) => {
            if (auto.includes(skill)) return false; // Already granted automatically
            if (selectedRace.name === 'Half-Elf') return true; // Half-elf can pick any non-auto skill
            return classOptions.includes(skill); // Others must pick from class list
        };

        const validated = selectedSkills.filter(isValidChoice);

        // Trim if we now have fewer slots than before
        if (validated.length > totalMax) {
            setSelectedSkills(validated.slice(0, totalMax));
        } else if (validated.length !== selectedSkills.length) {
            setSelectedSkills(validated);
        }
    }, [selectedRace, selectedClass, selectedBackground]);

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
            abilityScores: abilities,
            skillProficiencies: getFinalSkills()
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

    const POINT_BUY_COSTS: Record<number, number> = {
        8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
    };

    const calculatePointsSpent = (stats: typeof abilities) => {
        return Object.values(stats).reduce((total, val) => total + (POINT_BUY_COSTS[val] || 0), 0);
    };

    const handleAbilityChange = (key: string, delta: number) => {
        const currentVal = (abilities as any)[key];
        const newVal = currentVal + delta;

        if (newVal < 8 || newVal > 15) return;

        const newAbilities = { ...abilities, [key]: newVal };
        if (calculatePointsSpent(newAbilities) > 27) return;

        setAbilities(newAbilities);
    };

    const applyStandardArray = () => {
        setAbilities({
            STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8
        });
    };

    const getRacialBonus = (stat: string) => {
        const bonuses = selectedRace?.abilityScoreIncreases as any;
        return bonuses?.[stat] || 0;
    };

    const getTotalStat = (stat: string) => {
        return (abilities as any)[stat] + getRacialBonus(stat);
    };

    const getStatDescription = (stat: string) => {
        const descriptions: Record<string, string> = {
            STR: "Melee attacks, athletics checks, carrying capacity.",
            DEX: "Ranged attacks, finesse weapons, AC, initiative, acrobatics, stealth.",
            CON: "Hit points, concentration checks, stamina.",
            INT: "Arcana, history, investigation, nature, religion, wizard spells.",
            WIS: "Animal handling, insight, medicine, perception, survival, cleric/druid spells.",
            CHA: "Deception, intimidation, performance, persuasion, sorcerer/warlock/bard spells."
        };
        return descriptions[stat] || "";
    };

    const getAutoSkills = () => {
        const skills = new Set<string>();
        if (selectedBackground) {
            selectedBackground.skillProficiencies.forEach(s => skills.add(s));
        }
        if (selectedRace) {
            if (selectedRace.name.includes('Elf')) skills.add('Perception');
            if (selectedRace.name === 'Half-Orc') skills.add('Intimidation');
        }
        return Array.from(skills);
    };

    const getClassSkillOptions = () => {
        if (!selectedClass) return [];
        const auto = getAutoSkills();
        // Remove "Skill: " prefix and filter out already granted skills
        return selectedClass.skillChoices.options
            .map(opt => opt.replace('Skill: ', ''))
            .filter(opt => !auto.includes(opt));
    };

    const getRaceSkillChoiceCount = () => {
        if (selectedRace?.name === 'Half-Elf') return 2;
        return 0;
    };

    const getFinalSkills = () => {
        return Array.from(new Set([...getAutoSkills(), ...selectedSkills]));
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
                                            <p className={styles.smallInfo}>
                                                <strong>Proficiencies:</strong> {selectedBackground.skillProficiencies.map((s, i) => (
                                                    <React.Fragment key={s}>
                                                        <SkillLink skillName={s} />
                                                        {i < selectedBackground.skillProficiencies.length - 1 ? ', ' : ''}
                                                    </React.Fragment>
                                                ))}
                                            </p>
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
                const pointsSpent = calculatePointsSpent(abilities);
                return (
                    <div className={styles.stepContainer}>
                        <div className={styles.statsHeader}>
                            <h3>Ability Scores</h3>
                            <div className={styles.budgetDisplay}>
                                Points Remaining: <span className={pointsSpent > 27 ? styles.error : ''}>{27 - pointsSpent} / 27</span>
                            </div>
                            <button className={styles.secondaryButton} onClick={applyStandardArray}>Use Standard Array</button>
                        </div>
                        <div className={styles.statsGrid}>
                            {Object.entries(abilities).map(([key, val]) => {
                                const bonus = getRacialBonus(key);
                                const total = val + bonus;
                                const mod = Math.floor((total - 10) / 2);
                                return (
                                    <div key={key} className={styles.statBox}>
                                        <div className={styles.statLabelRow}>
                                            <label>{key}</label>
                                            <div className={styles.statTooltip}>?
                                                <span className={styles.tooltipText}>{getStatDescription(key)}</span>
                                            </div>
                                        </div>
                                        <div className={styles.pointBuyControls}>
                                            <button
                                                className={styles.pBtn}
                                                onClick={() => handleAbilityChange(key, -1)}
                                                disabled={val <= 8}
                                            >-</button>
                                            <div className={styles.baseVal}>{val}</div>
                                            <button
                                                className={styles.pBtn}
                                                onClick={() => handleAbilityChange(key, 1)}
                                                disabled={val >= 15 || pointsSpent + (POINT_BUY_COSTS[val + 1] - POINT_BUY_COSTS[val]) > 27}
                                            >+</button>
                                        </div>
                                        {bonus > 0 && <div className={styles.racialBonus}>+{bonus} ({selectedRace?.name})</div>}
                                        <div className={styles.finalStat}>Total: {total}</div>
                                        <span className={styles.mod}>{mod >= 0 ? '+' : ''}{mod}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 5: // Skills
                const autoSkills = getAutoSkills();
                const classOptions = getClassSkillOptions();
                const classCount = selectedClass?.skillChoices.count || 0;
                const raceCount = getRaceSkillChoiceCount();
                const totalChoicesNeeded = classCount + raceCount;

                const toggleSkill = (skill: string) => {
                    if (selectedSkills.includes(skill)) {
                        setSelectedSkills(selectedSkills.filter(s => s !== skill));
                    } else if (selectedSkills.length < totalChoicesNeeded) {
                        setSelectedSkills([...selectedSkills, skill]);
                    }
                };

                return (
                    <div className={styles.selectionLayout}>
                        <div className={styles.skillsContainer}>
                            <h3>Select Proficiencies</h3>
                            <p className={styles.instruction}>
                                You gain <strong>{classCount}</strong> skills from your class
                                {raceCount > 0 && <> and <strong>{raceCount}</strong> from your race</>}.
                            </p>

                            <div className={styles.skillSourceGroup}>
                                <h4>Automatic Proficiencies</h4>
                                <div className={styles.skillBadges}>
                                    {autoSkills.map(s => <span key={s} className={styles.skillBadgeFixed}><SkillLink skillName={s} /></span>)}
                                </div>
                            </div>

                            <div className={styles.skillSourceGroup}>
                                <h4>Available Choices ({selectedSkills.length} / {totalChoicesNeeded})</h4>
                                <div className={styles.skillGrid}>
                                    {raceCount > 0 ? (
                                        // Half-Elf can pick ANY skill not already granted
                                        ALL_SKILLS.filter(s => !autoSkills.includes(s)).map(s => (
                                            <button
                                                key={s}
                                                className={`${styles.skillBtn} ${selectedSkills.includes(s) ? styles.selected : ''}`}
                                                onClick={() => toggleSkill(s)}
                                                disabled={!selectedSkills.includes(s) && selectedSkills.length >= totalChoicesNeeded}
                                            >
                                                <SkillLink skillName={s} inheritColor={selectedSkills.includes(s)} />
                                            </button>
                                        ))
                                    ) : (
                                        // Others pick from class list
                                        classOptions.map(s => (
                                            <button
                                                key={s}
                                                className={`${styles.skillBtn} ${selectedSkills.includes(s) ? styles.selected : ''}`}
                                                onClick={() => toggleSkill(s)}
                                                disabled={!selectedSkills.includes(s) && selectedSkills.length >= totalChoicesNeeded}
                                            >
                                                <SkillLink skillName={s} inheritColor={selectedSkills.includes(s)} />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className={styles.detailsPanel}>
                            <h3>About Skills</h3>
                            <div className={styles.detailsContent}>
                                <div className={styles.detailItem}>
                                    <div className={styles.detailName}>What are Proficiencies?</div>
                                    <div className={styles.detailDesc}>Proficiency represents your training in a specific area. When you make an ability check with a proficient skill, you add your Proficiency Bonus (+2 at level 1) to the roll.</div>
                                </div>
                                <div className={styles.detailItem}>
                                    <div className={styles.detailName}>Background Skills</div>
                                    <div className={styles.detailDesc}>Your background as a <strong>{selectedBackground?.name}</strong> provides specialized training from your past life.</div>
                                </div>
                                <div className={styles.detailItem}>
                                    <div className={styles.detailName}>Class Skills</div>
                                    <div className={styles.detailDesc}>Your life as a <strong>{selectedClass?.name}</strong> has taught you specific skills necessary for survival and excellence in your field.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 6: // Review
                const finalSkills = getFinalSkills();
                return (
                    <div className={styles.selectionLayout}>
                        <div className={styles.summaryScroll}>
                            <h3>Review Character</h3>
                            <div className={styles.reviewMain}>
                                <div className={styles.reviewIdentity}>
                                    <p><strong>Name:</strong> {name || 'Traveler'}</p>
                                    <p><strong>Race:</strong> {selectedRace?.name}</p>
                                    <p><strong>Class:</strong> {selectedClass?.name}</p>
                                    <p><strong>Background:</strong> {selectedBackground?.name}</p>
                                </div>

                                <h4 className={styles.reviewSubhead}>Final Stats</h4>
                                <div className={styles.statsSummary}>
                                    {Object.entries(abilities).map(([k, v]) => {
                                        const total = getTotalStat(k);
                                        const mod = Math.floor((total - 10) / 2);
                                        return (
                                            <div key={k} className={styles.reviewStat}>
                                                <span className={styles.reviewStatName}>{k}</span>
                                                <span className={styles.reviewStatVal}>{total}</span>
                                                <span className={styles.reviewStatMod}>({mod >= 0 ? '+' : ''}{mod})</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <h4 className={styles.reviewSubhead}>Proficiencies</h4>
                                <div className={styles.skillBadges}>
                                    {finalSkills.sort().map(s => (
                                        <span key={s} className={styles.skillBadgeFinal}><SkillLink skillName={s} /></span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className={styles.detailsPanel}>
                            <h3>Detailed Summary</h3>
                            <div className={styles.detailsContent}>
                                <div className={styles.summarySection}>
                                    <div className={styles.summarySectionTitle}>RACIAL TRAITS</div>
                                    {selectedRace?.traits.map(t => (
                                        <div key={t.name} className={styles.summaryItem}>
                                            <div className={styles.summaryItemName}>{t.name}</div>
                                            <div className={styles.summaryItemDesc}>{t.description}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.summarySection}>
                                    <div className={styles.summarySectionTitle}>CLASS FEATURES</div>
                                    {selectedClass?.allFeatures.filter(f => f.level === 1).map(f => (
                                        <div key={f.name} className={styles.summaryItem}>
                                            <div className={styles.summaryItemName}>{f.name}</div>
                                            <div className={styles.summaryItemDesc}>{f.description}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.summarySection}>
                                    <div className={styles.summarySectionTitle}>BACKGROUND: {selectedBackground?.name}</div>
                                    <div className={styles.summaryItem}>
                                        <div className={styles.summaryItemName}>{selectedBackground?.feature.name}</div>
                                        <div className={styles.summaryItemDesc}>{selectedBackground?.feature.description}</div>
                                    </div>
                                    <div className={styles.summaryItem}>
                                        <div className={styles.summaryItemName}>Starting Gear</div>
                                        <div className={styles.summaryItemDesc}>
                                            {selectedBackground?.startingEquipment.map(e => `${e.quantity}x ${e.id}`).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
        if (step === 5) { // Skills
            const classCount = selectedClass?.skillChoices.count || 0;
            const raceCount = getRaceSkillChoiceCount();
            return selectedSkills.length < (classCount + raceCount);
        }
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
