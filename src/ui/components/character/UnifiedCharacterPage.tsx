import React, { useState } from 'react';
import styles from './UnifiedCharacterPage.module.css';
import { useGameState } from '../../hooks/useGameState';
import { useBook } from '../../context/BookContext';
import { MechanicsEngine } from '../../../ruleset/combat/MechanicsEngine';
import { SkillEngine } from '../../../ruleset/combat/SkillEngine';
import { LevelingEngine } from '../../../ruleset/combat/LevelingEngine';
import { AbilityParser } from '../../../ruleset/combat/AbilityParser';
import PaperdollFigure from '../paperdoll/PaperdollFigure';
import InventoryBag from '../paperdoll/InventoryBag';
import XPBar from './XPBar';
import Codex from '../codex/Codex';
import { Shield, Zap, Heart, Footprints, Info, Award, BookOpen, Users, CheckCircle2 as Check } from 'lucide-react';
import { PaperdollItem, SlotId } from '../paperdoll/types';
import { DataManager } from '../../../ruleset/data/DataManager';

const SKILL_GROUPS = [
    { ability: 'STR', label: 'Strength', skills: ['Athletics', 'Unarmed Combat'] },
    { ability: 'DEX', label: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
    { ability: 'INT', label: 'Intelligence', skills: ['Arcana', 'Cartography', 'History', 'Investigation', 'Nature', 'Religion'] },
    { ability: 'WIS', label: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
    { ability: 'CHA', label: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] },
];

const TIER_NAMES = ['', 'Prof', 'Exp', 'Mst', 'GM'];
const TIER_COLORS = ['#555', '#e8d5b5', '#1eff00', '#0070dd', '#ff8000'];

const UnifiedCharacterPage: React.FC = () => {
    const { state, engine, updateState } = useGameState();
    const { pushPage } = useBook();
    const [pendingASI, setPendingASI] = useState<Record<string, number>>({});
    const [pendingSP, setPendingSP] = useState<Record<string, number>>({});
    const [showFeatures, setShowFeatures] = useState(false);
    const [showPersonality, setShowPersonality] = useState(false);

    if (!state?.character) return <div className={styles.page}>No character loaded.</div>;

    const pc = state.character;
    const stats = pc.stats as Record<string, number>;
    const bio = pc.biography;
    const profBonus = MechanicsEngine.getProficiencyBonus(pc.level);
    const sp = (pc as any).skillPoints || { available: 0, totalEarned: 0 };

    const getMod = (score: number) => Math.floor((score - 10) / 2);
    const fmtMod = (m: number) => (m >= 0 ? `+${m}` : `${m}`);

    const openCodex = (cat: string, id?: string) => {
        pushPage({ id: 'codex', label: 'Codex', content: <Codex isOpen={true} onClose={() => {}} initialDeepLink={{ category: cat, entryId: id }} isPage={true} /> });
    };

    // ASI logic
    const totalASIPoints = ((pc as any)._pendingASI || 0) * 2;
    const usedASIPoints = Object.values(pendingASI).reduce((s, v) => s + v, 0);
    const remainingASIPoints = totalASIPoints - usedASIPoints;

    // SP logic
    let totalPendingSPCost = 0;
    for (const [sn, adv] of Object.entries(pendingSP)) {
        const baseTier = SkillEngine.getSkillTier(pc, sn);
        const def = SkillEngine.getSkillDef(sn);
        if (!def) continue;
        for (let i = 0; i < adv; i++) totalPendingSPCost += def.tierCosts[baseTier + i] || 0;
    }
    const effectiveSP = sp.available - totalPendingSPCost;

    // Paperdoll helpers (simplified from PaperdollScreen)
    const mapItem = (item: any): PaperdollItem => {
        const enriched = DataManager.getItem(item.name || item.id);
        const src = item.isForged ? { ...enriched, ...item } : { ...item };
        return {
            id: src.id || item.name, instanceId: item.instanceId, name: item.name,
            type: (src.type || 'Misc') as any, weight: src.weight || 0, quantity: item.quantity || 1, rarity: undefined,
            equipped: item.equipped, icon: undefined, identified: (item as any).identified,
        };
    };

    const inventoryItems = (pc.inventory?.items || []).filter((i: any) => !i.equipped).map(mapItem);
    const gold = pc.inventory?.gold || { gp: 0, sp: 0, cp: 0 };

    const equippedSlots: Record<string, PaperdollItem | null> = {};
    if (pc.equipmentSlots) {
        for (const [slot, itemId] of Object.entries(pc.equipmentSlots)) {
            if (!itemId) { equippedSlots[slot] = null; continue; }
            const inv = pc.inventory?.items?.find((i: any) => i.instanceId === itemId || i.id === itemId || i.name === itemId);
            equippedSlots[slot] = inv ? mapItem(inv) : null;
        }
    }

    return (
        <div className={styles.page}>
            {/* TOP SPACER */}
            <div className={styles.topSpacer} />

            <div className={styles.mainGrid}>
                {/* LEFT: Character info + Abilities + Saves */}
                <div className={styles.leftCol}>
                    <div className={styles.charHeader}>
                        <h1 className={styles.charName}>{pc.name}</h1>
                        <div className={styles.charSub}>Level {pc.level} {pc.race} {pc.class} • {bio.background || ''}</div>
                        <div className={styles.xpWrap}><XPBar current={pc.xp} max={MechanicsEngine.getNextLevelXP(pc.level)} /></div>
                    </div>

                    {/* Feats */}
                    {(pc.feats?.length || 0) > 0 && (
                        <div className={styles.featsRow}>
                            <Award size={12} /> {pc.feats?.join(', ')}
                        </div>
                    )}

                    <div className={styles.sectionLabel}>
                        Abilities
                        {totalASIPoints > 0 && <span className={styles.pointsLabel}>{remainingASIPoints} pts</span>}
                    </div>
                    {usedASIPoints > 0 && (
                        <button className={styles.confirmBtn} onClick={() => {
                            const entries = Object.entries(pendingASI).filter(([,v]) => v > 0);
                            if (entries.length === 1 && entries[0][1] === 2) LevelingEngine.applyASISingle(pc, entries[0][0]);
                            else if (entries.length === 2) LevelingEngine.applyASISplit(pc, entries[0][0], entries[1][0]);
                            else if (entries.length === 1) LevelingEngine.applyASISingle(pc, entries[0][0]);
                            setPendingASI({}); updateState();
                        }}>Confirm ASI</button>
                    )}
                    {['STR','DEX','CON','INT','WIS','CHA'].map(ab => {
                        const val = (stats[ab] || 10) + (pendingASI[ab] || 0);
                        const hasPending = (pendingASI[ab] || 0) > 0;
                        const canAdd = totalASIPoints > 0 && usedASIPoints < totalASIPoints && val < 20;
                        return (
                            <div key={ab} className={`${styles.abilityRow} ${hasPending ? styles.rowPending : ''}`}>
                                <span className={styles.abName}>{ab}</span>
                                <span className={styles.abScore}>{val}</span>
                                <span className={styles.abMod}>{fmtMod(getMod(val))}</span>
                                <div className={styles.pmSlot}>
                                    <button className={styles.minusBtn} style={{ visibility: hasPending ? 'visible' : 'hidden' }}
                                        onClick={() => setPendingASI(prev => { const n={...prev}; n[ab]=(n[ab]||0)-1; if(n[ab]<=0) delete n[ab]; return n; })}>-</button>
                                    <button className={styles.plusBtn} style={{ visibility: canAdd ? 'visible' : 'hidden' }}
                                        onClick={() => setPendingASI(prev => ({...prev, [ab]: (prev[ab]||0)+1}))}>+</button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Feat option */}
                    {totalASIPoints > 0 && usedASIPoints === 0 && (
                        <button className={styles.featChoiceBtn} onClick={() => openCodex('feats', 'list')}>
                            <Award size={12} /> Or choose a Feat
                        </button>
                    )}

                    <div className={styles.sectionLabel}>Saving Throws</div>
                    {['STR','DEX','CON','INT','WIS','CHA'].map(ab => {
                        const isProf = pc.savingThrowProficiencies?.includes(ab as any);
                        const mod = getMod(stats[ab] || 10) + (isProf ? profBonus : 0);
                        return (
                            <div key={ab} className={styles.saveRow}>
                                {isProf ? <Check size={10} className={styles.profCheck} /> : <span className={styles.profEmpty} />}
                                <span className={styles.saveName}>{ab}</span>
                                <span className={styles.saveMod}>{fmtMod(mod)}</span>
                            </div>
                        );
                    })}
                </div>

                {/* CENTER-LEFT: Paperdoll */}
                <div className={styles.centerLeft}>
                    <PaperdollFigure
                        equippedSlots={equippedSlots as any}
                        sex={(pc as any).sex || 'male'}
                        onDrop={async (slot: string, item: PaperdollItem) => { if(engine) await engine.equipItemToSlot(item.instanceId, slot); }}
                        onUnequip={async (slot) => { if(engine) await engine.unequipFromSlot(slot); }}
                    />
                </div>

                {/* CENTER-RIGHT: Inventory + Combat + HP + Buttons */}
                <div className={styles.centerRight}>
                    <InventoryBag
                        items={inventoryItems}
                        gold={gold as any}
                        onItemEquipped={async (item) => { if(engine) await engine.equipItem(item.instanceId); }}
                        onReceiveItem={() => {}}
                    />

                    <div className={styles.combatMetrics}>
                        <div className={styles.metricBox}>
                            <div className={styles.metricVal}>{pc.ac}</div>
                            <div className={styles.metricLbl}><Shield size={12} /> AC</div>
                        </div>
                        <div className={styles.metricBox}>
                            <div className={styles.metricVal}>{fmtMod(getMod(stats.DEX || 10))}</div>
                            <div className={styles.metricLbl}><Zap size={12} /> Init</div>
                        </div>
                        <div className={styles.metricBox}>
                            <div className={styles.metricVal}>30ft</div>
                            <div className={styles.metricLbl}><Footprints size={12} /> Spd</div>
                        </div>
                    </div>

                    <div className={styles.hpBox}>
                        <Heart size={20} color="#cc4444" />
                        <div>
                            <div className={styles.hpLabel}>Hit Points</div>
                            <div className={styles.hpValue}>{pc.hp.current} / {pc.hp.max}</div>
                        </div>
                    </div>

                    <button className={styles.panelBtn} onClick={() => setShowFeatures(!showFeatures)}>
                        <BookOpen size={13} /> Class Features ({AbilityParser.getCombatAbilities(pc).length})
                    </button>
                    <button className={styles.panelBtn} onClick={() => setShowPersonality(!showPersonality)}>
                        <Users size={13} /> Personality & Traits
                    </button>
                </div>

                {/* RIGHT: Skills */}
                <div className={styles.rightCol}>
                    <div className={styles.sectionLabel}>
                        Skills
                        {sp.available > 0 && <span className={styles.pointsLabel}>{effectiveSP} SP</span>}
                    </div>
                    {totalPendingSPCost > 0 && (
                        <button className={styles.confirmBtn} onClick={() => {
                            for (const [sn, adv] of Object.entries(pendingSP)) {
                                for (let i = 0; i < adv; i++) SkillEngine.invest(pc, sn);
                            }
                            setPendingSP({}); updateState();
                        }}>Confirm SP ({totalPendingSPCost})</button>
                    )}
                    <div className={styles.skillsList}>
                        {SKILL_GROUPS.map(g => (
                            <div key={g.ability}>
                                <div className={styles.skillGroupHdr}>{g.label} ({g.ability})</div>
                                {g.skills.map(sn => {
                                    const baseTier = SkillEngine.getSkillTier(pc, sn);
                                    const pAdv = pendingSP[sn] || 0;
                                    const eTier = baseTier + pAdv;
                                    const mult = eTier > 0 ? [0,1,2,2,3][eTier] : 0;
                                    const mod = getMod(stats[g.ability] || 10) + profBonus * mult;
                                    const def = SkillEngine.getSkillDef(sn);
                                    const cost = def?.tierCosts?.[eTier];
                                    const gate = def?.levelGates?.[eTier] || 1;
                                    const canInv = eTier < 4 && cost !== undefined && effectiveSP >= cost && pc.level >= gate;
                                    const pips = Array.from({length:4},(_,i) => i < baseTier ? 'f' : i < eTier ? 'p' : 'e');
                                    return (
                                        <div key={sn} className={`${styles.skillRow} ${pAdv > 0 ? styles.rowPending : ''}`}>
                                            <span className={styles.pips}>
                                                {pips.map((p,i) => <span key={i} className={`${styles.pip} ${p==='f'?styles.pipF:p==='p'?styles.pipP:styles.pipE}`}
                                                    style={p==='f'?{backgroundColor:TIER_COLORS[baseTier]}:undefined} />)}
                                            </span>
                                            <span className={styles.skillName}>{sn}</span>
                                            {eTier > 0 && <span className={styles.tierTag} style={{color:TIER_COLORS[eTier]}}>{TIER_NAMES[eTier]}</span>}
                                            <span className={styles.skillMod}>{fmtMod(mod)}</span>
                                            <button className={styles.infoBtn} onClick={() => openCodex('skills', sn)}><Info size={10} /></button>
                                            <div className={styles.pmSlotSm}>
                                                <button className={styles.minusBtn} style={{width:16,height:16,fontSize:'0.65rem',visibility:pAdv>0?'visible':'hidden'}}
                                                    onClick={() => setPendingSP(prev => {const n={...prev};n[sn]=(n[sn]||0)-1;if(n[sn]<=0)delete n[sn];return n;})}>-</button>
                                                <button className={styles.plusBtn} style={{width:16,height:16,fontSize:'0.65rem',visibility:canInv?'visible':'hidden'}}
                                                    onClick={() => setPendingSP(prev => ({...prev,[sn]:(prev[sn]||0)+1}))}>+</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* OVERLAYS for Class Features / Personality */}
            {showFeatures && (
                <div className={styles.overlay} onClick={() => setShowFeatures(false)}>
                    <div className={styles.overlayPanel} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.overlayTitle}>Class Features</h2>
                        {AbilityParser.getCombatAbilities(pc).map((a, i) => (
                            <div key={i} className={styles.featureCard}>
                                <strong>{a.name}</strong> {a.actionCost !== 'NONE' && <small>({a.actionCost.replace('_',' ')})</small>}
                                <p>{a.description}</p>
                            </div>
                        ))}
                        {AbilityParser.getCombatAbilities(pc).length === 0 && <p style={{opacity:0.5}}>No features yet.</p>}
                    </div>
                </div>
            )}
            {showPersonality && (
                <div className={styles.overlay} onClick={() => setShowPersonality(false)}>
                    <div className={styles.overlayPanel} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.overlayTitle}>Personality & Traits</h2>
                        {bio.traits?.map((t:string,i:number) => <div key={i} className={styles.featureCard}><strong>Trait</strong><p>{t}</p></div>)}
                        {bio.ideals?.map((t:string,i:number) => <div key={`i${i}`} className={styles.featureCard}><strong>Ideal</strong><p>{t}</p></div>)}
                        {bio.bonds?.map((t:string,i:number) => <div key={`b${i}`} className={styles.featureCard}><strong>Bond</strong><p>{t}</p></div>)}
                        {bio.flaws?.map((t:string,i:number) => <div key={`f${i}`} className={styles.featureCard}><strong>Flaw</strong><p>{t}</p></div>)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnifiedCharacterPage;
