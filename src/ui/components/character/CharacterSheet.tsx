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
import { LevelingEngine } from '../../../ruleset/combat/LevelingEngine';
import { SkillEngine } from '../../../ruleset/combat/SkillEngine';

const SKILL_GROUPS: { ability: string; label: string; skills: string[] }[] = [
    { ability: 'STR', label: 'Strength', skills: ['Athletics', 'Unarmed Combat'] },
    { ability: 'DEX', label: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
    { ability: 'INT', label: 'Intelligence', skills: ['Arcana', 'Cartography', 'History', 'Investigation', 'Nature', 'Religion'] },
    { ability: 'WIS', label: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
    { ability: 'CHA', label: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] },
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
    const [pendingASI, setPendingASI] = useState<Record<string, number>>({});
    const [pendingSP, setPendingSP] = useState<Record<string, number>>({});
    const [showFeatPicker, setShowFeatPicker] = useState(false);

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
                    {/* ABILITIES with inline ASI +/- */}
                    <section className={styles.section}>
                        {(() => {
                            const totalASIPoints = ((char as any)._pendingASI || 0) * 2;
                            const usedPoints = Object.values(pendingASI).reduce((s, v) => s + v, 0);
                            const remainingPoints = totalASIPoints - usedPoints;
                            const hasPendingASI = totalASIPoints > 0;
                            return (
                                <>
                                    <h2 className={styles.sectionTitle}>
                                        <span onClick={() => openCodex('mechanics', 'general_abilities')} style={{ cursor: 'pointer' }}>Abilities</span>
                                        {hasPendingASI && (
                                            <span className={styles.asiPointsLabel}>
                                                {remainingPoints} point{remainingPoints !== 1 ? 's' : ''} to assign
                                            </span>
                                        )}
                                    </h2>
                                    {/* Feat option when ASI pending and no points distributed */}
                                    {hasPendingASI && usedPoints === 0 && !showFeatPicker && (
                                        <button className={styles.featChoiceBtn} onClick={() => setShowFeatPicker(true)}>
                                            <Award size={14} /> Or choose a Feat instead
                                        </button>
                                    )}
                                    {/* Feat picker */}
                                    {showFeatPicker && (
                                        <div className={styles.featPickerPanel}>
                                            <div className={styles.featPickerHeader}>
                                                <span>Choose a Feat (uses 1 ASI)</span>
                                                <button className={styles.asiBackBtn} onClick={() => setShowFeatPicker(false)}>← Back to abilities</button>
                                            </div>
                                            <div className={styles.featPickerList}>
                                                {LevelingEngine.getAvailableFeats(char).map((feat: any) => (
                                                    <div key={feat.name} className={styles.featPickerItem}>
                                                        <div>
                                                            <div className={styles.featItemName}>{feat.name}</div>
                                                            <div className={styles.featItemDesc}>{feat.description}</div>
                                                        </div>
                                                        <button className={`${parchmentStyles.button} ${styles.featPickBtn}`} onClick={() => {
                                                            LevelingEngine.selectFeat(char, feat.name);
                                                            setShowFeatPicker(false);
                                                            updateState();
                                                        }}>Select</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Pending ASI confirm/revert */}
                                    {usedPoints > 0 && (
                                        <div className={styles.asiPendingBar}>
                                            <span>{usedPoints} point{usedPoints > 1 ? 's' : ''} assigned</span>
                                            <button className={styles.asiConfirmBtn} onClick={() => {
                                                // Apply: convert pending points to ASI calls
                                                const entries = Object.entries(pendingASI).filter(([, v]) => v > 0);
                                                if (entries.length === 1 && entries[0][1] === 2) {
                                                    LevelingEngine.applyASISingle(char, entries[0][0]);
                                                } else if (entries.length === 2 && entries[0][1] === 1 && entries[1][1] === 1) {
                                                    LevelingEngine.applyASISplit(char, entries[0][0], entries[1][0]);
                                                } else if (entries.length === 1 && entries[0][1] === 1) {
                                                    // Only 1 point used out of 2 — treat as +1 to one ability
                                                    // D&D doesn't allow this, but we'll apply what's there
                                                    LevelingEngine.applyASISingle(char, entries[0][0]);
                                                }
                                                setPendingASI({});
                                                updateState();
                                            }}>Confirm</button>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                        <div className={styles.abilityGrid}>
                            {Object.entries(stats).map(([name, score]) => {
                                const val = Number(score) + (pendingASI[name] || 0);
                                const baseVal = Number(score);
                                const hasPending = (pendingASI[name] || 0) > 0;
                                const totalASIPoints = ((char as any)._pendingASI || 0) * 2;
                                const usedPoints = Object.values(pendingASI).reduce((s, v) => s + v, 0);
                                const canAdd = totalASIPoints > 0 && usedPoints < totalASIPoints && val < 20;
                                const showButtons = totalASIPoints > 0;
                                return (
                                    <div key={name} className={`${styles.abilityRow} ${hasPending ? styles.abilityPending : ''}`}>
                                        <span className={styles.statName}>{name}</span>
                                        <span className={styles.statScore}>{val}</span>
                                        <span className={styles.statMod}>{formatMod(getMod(val))}</span>
                                        <div className={styles.pmSlot} style={{ visibility: showButtons ? 'visible' : 'hidden' }}>
                                            <button className={styles.asiMinusBtn} style={{ visibility: hasPending ? 'visible' : 'hidden' }}
                                                onClick={(e) => { e.stopPropagation(); setPendingASI(prev => { const n = { ...prev }; n[name] = (n[name] || 0) - 1; if (n[name] <= 0) delete n[name]; return n; }); }}
                                            >-</button>
                                            <button className={styles.asiPlusBtn} style={{ visibility: canAdd ? 'visible' : 'hidden' }}
                                                onClick={(e) => { e.stopPropagation(); setPendingASI(prev => ({ ...prev, [name]: (prev[name] || 0) + 1 })); }}
                                            >+</button>
                                        </div>
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

                    {/* SKILLS — grouped by ability with inline SP +/- */}
                    <section className={styles.section}>
                        {(() => {
                            const spAvail = (char as any).skillPoints?.available || 0;
                            const spPendingUsed = Object.values(pendingSP).reduce((s: number, v: any) => {
                                // Each entry = number of tier advances. Calculate SP cost for each.
                                return s; // Simplified — we'll compute actual cost below
                            }, 0);
                            // Compute actual SP used by pending
                            let totalPendingSPCost = 0;
                            for (const [skillName, advances] of Object.entries(pendingSP)) {
                                const baseTier = SkillEngine.getSkillTier(char, skillName);
                                const def = SkillEngine.getSkillDef(skillName);
                                if (!def) continue;
                                for (let i = 0; i < (advances as number); i++) {
                                    totalPendingSPCost += def.tierCosts[baseTier + i] || 0;
                                }
                            }
                            const effectiveSP = spAvail - totalPendingSPCost;
                            const hasPendingSP = totalPendingSPCost > 0;

                            return (
                                <>
                                    <h2 className={styles.sectionTitle}>
                                        Skills
                                        {spAvail > 0 && (
                                            <span className={styles.asiPointsLabel}>{effectiveSP} SP available</span>
                                        )}
                                    </h2>
                                    {hasPendingSP && (
                                        <div className={styles.asiPendingBar}>
                                            <span>{totalPendingSPCost} SP queued</span>
                                            <button className={styles.asiConfirmBtn} onClick={() => {
                                                for (const [sn, adv] of Object.entries(pendingSP)) {
                                                    for (let i = 0; i < (adv as number); i++) SkillEngine.invest(char, sn);
                                                }
                                                setPendingSP({});
                                                updateState();
                                            }}>Confirm</button>
                                        </div>
                                    )}
                                    {SKILL_GROUPS.map(group => (
                                        <div key={group.ability} className={styles.skillGroupSection}>
                                            <div className={styles.skillGroupLabel}>{group.label} ({group.ability})</div>
                                            {group.skills.map(skillName => {
                                                const baseTier = SkillEngine.getSkillTier(char, skillName);
                                                const pendingAdv = (pendingSP[skillName] || 0) as number;
                                                const effectiveTier = baseTier + pendingAdv;
                                                const tierNames = ['', 'Prof', 'Exp', 'Mst', 'GM'];
                                                const tierColors = ['#888', '#c8c8c8', '#1eff00', '#0070dd', '#ff8000'];
                                                const mult = effectiveTier > 0 ? [0, 1, 2, 2, 3][effectiveTier] : 0;
                                                const abilityScore = (stats as any)[group.ability] || 10;
                                                const mod = getMod(abilityScore) + (profBonus * mult);
                                                // Build pips: base tiers are solid, pending tiers glow orange
                                                const pips = Array.from({ length: 4 }, (_, i) => {
                                                    if (i < baseTier) return 'filled';
                                                    if (i < effectiveTier) return 'pending';
                                                    return 'empty';
                                                });

                                                const def = SkillEngine.getSkillDef(skillName);
                                                const nextCost = def?.tierCosts?.[effectiveTier];
                                                const levelGate = def?.levelGates?.[effectiveTier] || 1;
                                                const canInvest = effectiveTier < 4 && nextCost !== undefined && effectiveSP >= nextCost && char.level >= levelGate;

                                                return (
                                                    <div key={skillName} className={`${styles.skillRow} ${pendingAdv > 0 ? styles.abilityPending : ''}`}>
                                                        <div className={styles.skillInfo}>
                                                            <span className={styles.skillPips}>
                                                                {pips.map((p, i) => (
                                                                    <span key={i} className={`${styles.skillPip} ${p === 'filled' ? styles.pipFilled : p === 'pending' ? styles.pipPending : styles.pipEmpty}`}
                                                                        style={p === 'filled' ? { backgroundColor: tierColors[baseTier] } : undefined} />
                                                                ))}
                                                            </span>
                                                            <span className={styles.skillNameText}>{skillName}</span>
                                                            {effectiveTier > 0 && <small style={{ color: tierColors[effectiveTier], fontSize: '0.6rem' }}>{tierNames[effectiveTier]}</small>}
                                                        </div>
                                                        <span className={styles.skillBonus}>{formatMod(mod)}</span>
                                                        <button className={styles.skillInfoBtn}
                                                            onClick={(e) => { e.stopPropagation(); openCodex('skills', skillName); }}
                                                            title={`View ${skillName} in Codex`}
                                                        ><Info size={11} /></button>
                                                        <div className={styles.pmSlotSm} style={{ visibility: (spAvail > 0 || pendingAdv > 0) ? 'visible' : 'hidden' }}>
                                                            <button className={styles.asiMinusBtn} style={{ width: 18, height: 18, fontSize: '0.7rem', visibility: pendingAdv > 0 ? 'visible' : 'hidden' }}
                                                                onClick={(e) => { e.stopPropagation(); setPendingSP(prev => { const n = { ...prev }; n[skillName] = (n[skillName] || 0) - 1; if (n[skillName] <= 0) delete n[skillName]; return n; }); }}
                                                            >-</button>
                                                            <button className={styles.asiPlusBtn} style={{ width: 18, height: 18, fontSize: '0.7rem', visibility: canInvest ? 'visible' : 'hidden' }}
                                                                onClick={(e) => { e.stopPropagation(); setPendingSP(prev => ({ ...prev, [skillName]: (prev[skillName] || 0) + 1 })); }}
                                                                title={canInvest ? `Invest ${nextCost} SP → ${tierNames[effectiveTier + 1]}` : ''}
                                                            >+</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
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
