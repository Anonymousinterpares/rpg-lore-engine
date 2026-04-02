import React, { useState } from 'react';
import styles from './CharacterSheet.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Shield, Zap, Heart, Footprints, CheckCircle2 as Check, ChevronDown, ChevronUp, Info, Award, BookOpen, Users } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { useBook } from '../../context/BookContext';
import { AbilityParser } from '../../../ruleset/combat/AbilityParser';
import { MechanicsEngine } from '../../../ruleset/combat/MechanicsEngine';
import XPBar from './XPBar';
import Codex from '../codex/Codex';

const SKILLS = [
    { name: 'Acrobatics', ability: 'DEX' },
    { name: 'Animal Handling', ability: 'WIS' },
    { name: 'Arcana', ability: 'INT' },
    { name: 'Athletics', ability: 'STR' },
    { name: 'Deception', ability: 'CHA' },
    { name: 'History', ability: 'INT' },
    { name: 'Insight', ability: 'WIS' },
    { name: 'Intimidation', ability: 'CHA' },
    { name: 'Investigation', ability: 'INT' },
    { name: 'Medicine', ability: 'WIS' },
    { name: 'Nature', ability: 'INT' },
    { name: 'Perception', ability: 'WIS' },
    { name: 'Performance', ability: 'CHA' },
    { name: 'Persuasion', ability: 'CHA' },
    { name: 'Religion', ability: 'INT' },
    { name: 'Sleight of Hand', ability: 'DEX' },
    { name: 'Stealth', ability: 'DEX' },
    { name: 'Survival', ability: 'WIS' },
];

interface CharacterSheetProps {
    onClose: () => void;
    isPage?: boolean;
}

const CharacterSheet: React.FC<CharacterSheetProps> = ({ onClose, isPage = false }) => {
    const { state, updateState } = useGameState();
    const { pushPage } = useBook();
    const [showFeatures, setShowFeatures] = useState(false);
    const [showPersonality, setShowPersonality] = useState(false);

    if (!state || !state.character) return null;

    const char = state.character;
    const stats = char.stats;
    const bio = char.biography;
    const profBonus = Math.floor((char.level - 1) / 4) + 2;

    const getMod = (score: number) => Math.floor((score - 10) / 2);
    const formatMod = (mod: number) => (mod >= 0 ? `+${mod}` : mod.toString());

    const openCodex = (category: string, entryId?: string) => {
        pushPage({
            id: 'codex',
            label: 'Codex',
            content: <Codex isOpen={true} onClose={() => { }} initialDeepLink={{ category, entryId }} isPage={true} />
        });
    };

    const sheetContent = (
        <div
            className={`${parchmentStyles.panel} ${styles.modal} ${parchmentStyles.overflowVisible} ${isPage ? styles.isPage : ''}`}
            onClick={e => e.stopPropagation()}
        >
            {!isPage && (
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={28} />
                </button>
            )}

            <header className={styles.header}>
                <h1 className={styles.name}>{char.name}</h1>
                <div className={styles.subHeader}>
                    Level {char.level} {char.race} {char.class} • {bio.background || 'Unknown Background'}
                </div>
                <div style={{ width: '200px', marginTop: '8px' }}>
                    <XPBar current={char.xp} max={MechanicsEngine.getNextLevelXP(char.level)} />
                </div>
            </header>

            <div className={styles.content}>
                {/* LEFT COLUMN */}
                <aside className={styles.leftCol}>
                    {/* ABILITIES */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle} onClick={() => openCodex('mechanics', 'general_abilities')} style={{ cursor: 'pointer' }}>
                            Abilities
                        </h2>
                        <div className={styles.abilityGrid}>
                            {Object.entries(stats).map(([name, score]) => {
                                const val = Number(score);
                                return (
                                    <div
                                        key={name}
                                        className={styles.abilityRow}
                                        onClick={() => openCodex('mechanics', `ability_${name.toLowerCase()}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span className={styles.statName}>{name}</span>
                                        <span className={styles.statScore}>{val}</span>
                                        <span className={styles.statMod}>{formatMod(getMod(val))}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* SAVING THROWS */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle} onClick={() => openCodex('mechanics', 'general_saving_throws')} style={{ cursor: 'pointer' }}>
                            Saving Throws
                        </h2>
                        <div className={styles.skillGrid}>
                            {Object.entries(stats).map(([name, score]) => {
                                const isProf = char.savingThrowProficiencies?.includes(name as any);
                                const mod = getMod(Number(score)) + (isProf ? profBonus : 0);
                                return (
                                    <div
                                        key={name}
                                        className={styles.skillRow}
                                        onClick={() => openCodex('mechanics', `ability_${name.toLowerCase()}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className={styles.skillInfo}>
                                            <div className={styles.profMarker}>
                                                {isProf ? <Check size={14} /> : <div style={{ width: 14 }} />}
                                            </div>
                                            <span>{name}</span>
                                        </div>
                                        <span className={styles.skillBonus}>{formatMod(mod)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* SKILLS */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle} onClick={() => openCodex('mechanics', 'general_skills')} style={{ cursor: 'pointer' }}>
                            Skills
                            {(char as any).skillPoints?.available > 0 && (
                                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#c9a227', fontWeight: 'normal' }}>
                                    {(char as any).skillPoints.available} SP available
                                </span>
                            )}
                        </h2>
                        <div className={styles.skillGrid}>
                            {SKILLS.map(skill => {
                                const tier = (char as any).skills?.[skill.name]?.tier || (char.skillProficiencies?.includes(skill.name as any) ? 1 : 0);
                                const tierNames = ['', 'Prof', 'Exp', 'Mst', 'GM'];
                                const tierColors = ['#888', '#c8c8c8', '#1eff00', '#0070dd', '#ff8000'];
                                const mult = tier > 0 ? [0, 1, 2, 2, 3][tier] : 0;
                                const abilityScore = (stats as any)[skill.ability] || 10;
                                const mod = getMod(abilityScore) + (profBonus * mult);
                                const stars = '●'.repeat(tier) + '○'.repeat(Math.max(0, 4 - tier));
                                return (
                                    <div
                                        key={skill.name}
                                        className={styles.skillRow}
                                        onClick={() => openCodex('skills', skill.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className={styles.skillInfo}>
                                            <span style={{ fontSize: '0.6rem', letterSpacing: 2, color: tierColors[tier], minWidth: 36 }}>{stars}</span>
                                            <span>{skill.name} <small style={{ opacity: 0.5 }}>({skill.ability.toLowerCase()})</small></span>
                                            {tier > 0 && <small style={{ color: tierColors[tier], marginLeft: 4, fontSize: '0.65rem' }}>{tierNames[tier]}</small>}
                                        </div>
                                        <span className={styles.skillBonus}>{formatMod(mod)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </aside>

                {/* RIGHT COLUMN */}
                <main className={styles.rightCol}>
                    {/* COMBAT METRICS */}
                    <div className={styles.combatMetrics}>
                        <div className={styles.metricBox} onClick={() => openCodex('mechanics', 'combat_ac')} style={{ cursor: 'pointer' }}>
                            <div className={styles.metricValue}>{char.ac}</div>
                            <div className={styles.metricLabel}>Armor Class</div>
                            <Shield size={20} style={{ marginTop: 8, opacity: 0.3 }} />
                        </div>
                        <div className={styles.metricBox} onClick={() => openCodex('mechanics', 'combat_initiative')} style={{ cursor: 'pointer' }}>
                            <div className={styles.metricValue}>{formatMod(getMod(stats.DEX || 10))}</div>
                            <div className={styles.metricLabel}>Initiative</div>
                            <Zap size={20} style={{ marginTop: 8, opacity: 0.3 }} />
                        </div>
                        <div className={styles.metricBox} onClick={() => openCodex('mechanics', 'combat_speed')} style={{ cursor: 'pointer' }}>
                            <div className={styles.metricValue}>30 ft</div>
                            <div className={styles.metricLabel}>Speed</div>
                            <Footprints size={20} style={{ marginTop: 8, opacity: 0.3 }} />
                        </div>
                    </div>

                    {/* HIT POINTS */}
                    <section className={styles.section} onClick={() => openCodex('mechanics', 'combat_hp')} style={{ cursor: 'pointer' }}>
                        <div className={styles.metricBox} style={{ width: '100%', flexDirection: 'row', gap: '20px' }}>
                            <Heart size={32} color="#cc0000" />
                            <div style={{ flex: 1 }}>
                                <div className={styles.metricLabel}>Hit Points</div>
                                <div style={{ fontSize: '2rem', fontWeight: 800 }}>
                                    {char.hp.current} / {char.hp.max}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* FEATS */}
                    {(char.feats?.length || 0) > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}><Award size={14} /> Feats</h2>
                            <div className={styles.featsList}>
                                {char.feats?.map((featName: string) => {
                                    const featData = (globalThis as any).__featRegistry?.[featName];
                                    return (
                                        <div key={featName} className={styles.featItem}>
                                            <span className={styles.featItemName}>{featName}</span>
                                            {featData && <span className={styles.featItemDesc}>{featData.description}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* CLASS FEATURES — collapsible */}
                    <button className={styles.popoverButton} onClick={() => setShowFeatures(!showFeatures)}>
                        <BookOpen size={14} />
                        <span>Class Features ({AbilityParser.getCombatAbilities(char).length})</span>
                        {showFeatures ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showFeatures && (
                        <section className={styles.popoverPanel}>
                            <div className={styles.featuresGrid}>
                                {AbilityParser.getCombatAbilities(char).map((ability, i) => (
                                    <div key={i} className={styles.featureCard}>
                                        <div className={styles.featureHeader}>
                                            <h3 className={styles.featureName}>{ability.name}</h3>
                                            {ability.actionCost !== 'NONE' && (
                                                <span className={styles.featureTag}>{ability.actionCost.replace('_', ' ')}</span>
                                            )}
                                        </div>
                                        <p className={styles.featureDesc}>{ability.description}</p>
                                        {ability.usage && (
                                            <div className={styles.usageTracker}>
                                                <span className={styles.usageText}>
                                                    Uses ({ability.usage.usageType.replace('_', ' ')}): {ability.usage.current} / {ability.usage.max}
                                                </span>
                                                <div className={styles.usageDots}>
                                                    {Array.from({ length: ability.usage.max }).map((_, dotIdx) => (
                                                        <div
                                                            key={dotIdx}
                                                            className={`${styles.dot} ${dotIdx < (ability.usage?.current || 0) ? styles.dotFilled : ''}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {AbilityParser.getCombatAbilities(char).length === 0 && (
                                    <p style={{ opacity: 0.5 }}>No class features unlocked yet.</p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* PERSONALITY & TRAITS — collapsible */}
                    <button className={styles.popoverButton} onClick={() => setShowPersonality(!showPersonality)}>
                        <Users size={14} />
                        <span>Personality & Traits</span>
                        {showPersonality ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showPersonality && (
                        <section className={styles.popoverPanel}>
                            <div className={styles.featuresGrid}>
                                {bio.traits?.map((trait: string, i: number) => (
                                    <div key={i} className={styles.featureCard}>
                                        <h3 className={styles.featureName}>Trait {i + 1}</h3>
                                        <p className={styles.featureDesc}>{trait}</p>
                                    </div>
                                ))}
                                {bio.ideals?.map((ideal: string, i: number) => (
                                    <div key={`ideal-${i}`} className={styles.featureCard} style={{ borderLeftColor: '#d4a017' }}>
                                        <h3 className={styles.featureName}>Ideal</h3>
                                        <p className={styles.featureDesc}>{ideal}</p>
                                    </div>
                                ))}
                                {bio.bonds?.map((bond: string, i: number) => (
                                    <div key={`bond-${i}`} className={styles.featureCard} style={{ borderLeftColor: '#a855f7' }}>
                                        <h3 className={styles.featureName}>Bond</h3>
                                        <p className={styles.featureDesc}>{bond}</p>
                                    </div>
                                ))}
                                {bio.flaws?.map((flaw: string, i: number) => (
                                    <div key={`flaw-${i}`} className={styles.featureCard} style={{ borderLeftColor: '#ff4d4d' }}>
                                        <h3 className={styles.featureName}>Flaw</h3>
                                        <p className={styles.featureDesc}>{flaw}</p>
                                    </div>
                                ))}
                                {(!bio.traits?.length && !bio.ideals?.length) && <p style={{ opacity: 0.5 }}>No personality traits defined.</p>}
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );

    if (isPage) return sheetContent;

    return (
        <div className={styles.overlay} onClick={onClose}>
            {sheetContent}
        </div>
    );
};

export default CharacterSheet;
