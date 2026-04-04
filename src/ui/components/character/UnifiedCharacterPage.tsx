import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import HealthBar from './HealthBar';
import Codex from '../codex/Codex';
import { Shield, Zap, Heart, Footprints, Info, Award, BookOpen, Users, CheckCircle2 as Check, Lock } from 'lucide-react';
import GameTooltip from '../common/GameTooltip';
import { PaperdollItem, SlotId } from '../paperdoll/types';
import { getACBonus, getStatBonus } from '../../utils/effectiveStats';
import { DataManager } from '../../../ruleset/data/DataManager';
import ItemContextMenu from '../inventory/ItemContextMenu';
import ItemDatasheet from '../inventory/ItemDatasheet';
import ParticleGlow from '../common/ParticleGlow';

const SKILL_GROUPS = [
    { ability: 'STR', label: 'Strength', skills: ['Athletics', 'Unarmed Combat'] },
    { ability: 'DEX', label: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
    { ability: 'INT', label: 'Intelligence', skills: ['Arcana', 'Cartography', 'History', 'Investigation', 'Nature', 'Religion'] },
    { ability: 'WIS', label: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
    { ability: 'CHA', label: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] },
];

const TIER_NAMES = ['', 'Proficient', 'Expert', 'Master', 'Grandmaster'];
const TIER_COLORS = ['#555', '#e8d5b5', '#1eff00', '#0070dd', '#ff8000'];

const UnifiedCharacterPage: React.FC = () => {
    const { state, engine, updateState, processCommand } = useGameState();
    const { pushPage } = useBook();
    const [pendingASI, setPendingASI] = useState<Record<string, number>>({});
    const [pendingSP, setPendingSP] = useState<Record<string, number>>({});
    const [showFeatures, setShowFeatures] = useState(false);
    const [showPersonality, setShowPersonality] = useState(false);
    const [showFeatPicker, setShowFeatPicker] = useState(false);
    const [selectedFeat, setSelectedFeat] = useState<string | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: PaperdollItem; source: 'slot' | 'bag'; slotId?: string } | null>(null);
    const [datasheetItem, setDatasheetItem] = useState<any>(null);

    if (!state?.character) return <div className={styles.page}>No character loaded.</div>;

    const pc = state.character;
    const stats = pc.stats as Record<string, number>;
    const bio = pc.biography;
    // During combat, read effects from combatant (live); outside, from character (persisted)
    const playerCombatant = state.combat?.combatants?.find((c: any) => c.isPlayer);
    const activeEffects = (playerCombatant?.statusEffects || (pc as any).statusEffects || []);
    const acBonusData = getACBonus(activeEffects);
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

    const normalizeRarity = (rarity?: string): PaperdollItem['rarity'] => {
        if (!rarity) return undefined;
        return rarity.toLowerCase().replace(' ', '-') as PaperdollItem['rarity'];
    };

    // Paperdoll helpers (same mapping as PaperdollScreen)
    const mapItem = (item: any): PaperdollItem => {
        const enriched = DataManager.getItem(item.name || item.id);
        const src = item.isForged ? { ...enriched, ...item } : { ...item };
        const base = enriched || {};
        return {
            id: src.id || item.name, instanceId: item.instanceId, name: item.name,
            type: (src.type || 'Misc') as any, weight: src.weight || 0, quantity: item.quantity || 1,
            rarity: normalizeRarity((src as any).rarity || (base as any).rarity),
            equipped: item.equipped, icon: undefined, identified: (item as any).identified,
            isMagic: (src as any).isMagic, isForged: (src as any).isForged,
            modifiers: (src as any).modifiers, magicalProperties: (src as any).magicalProperties,
            forgeSource: (src as any).forgeSource,
        } as any;
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

    // Fixed design resolution — scale to fit container
    const DESIGN_W = 1300;
    const DESIGN_H = 780;
    const pageRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const calc = () => {
            if (!pageRef.current) return;
            const w = pageRef.current.clientWidth;
            const h = pageRef.current.clientHeight;
            setScale(Math.min(w / DESIGN_W, h / DESIGN_H));
        };
        calc();
        const obs = new ResizeObserver(calc);
        if (pageRef.current) obs.observe(pageRef.current);
        return () => obs.disconnect();
    }, []);

    return (
        <div className={styles.page} ref={pageRef}>
            <div className={styles.scaleWrapper} style={{ transform: `scale(${scale})` }}>
                <div className={styles.canvas}>

            <div className={styles.mainGrid}>
                {/* LEFT: Character info + Abilities + Saves */}
                <div className={styles.leftCol}>
                    <div className={styles.charHeader}>
                        <h1 className={styles.charName}>{pc.name}</h1>
                        <div className={styles.charSub}>Level {pc.level} {pc.race} {pc.class}{pc.subclass ? ` (${pc.subclass})` : ''} • {bio.background || ''}</div>
                        <div className={styles.barWrap}>
                            <HealthBar current={pc.hp.current} max={pc.hp.max} />
                        </div>
                        <div className={styles.barWrap}><XPBar current={pc.xp} max={MechanicsEngine.getNextLevelXP(pc.level)} /></div>
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
                        const statBuff = getStatBonus(activeEffects, ab);
                        const effectiveVal = val + statBuff.value;
                        const hasPending = (pendingASI[ab] || 0) > 0;
                        const canAdd = totalASIPoints > 0 && usedASIPoints < totalASIPoints && val < 20;
                        return (
                            <GameTooltip text={statBuff.value ? statBuff.sources.join(', ') : undefined}>
                            <div key={ab} className={`${styles.abilityRow} ${hasPending ? styles.rowPending : ''}`}>
                                <button className={styles.infoBtn} onClick={() => openCodex('mechanics', `ability_${ab.toLowerCase()}`)}><Info size={10} /></button>
                                <span className={styles.abName}>{ab}</span>
                                <span className={styles.abScore}>
                                    {effectiveVal}
                                    {statBuff.value !== 0 && (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, marginLeft: 2, color: statBuff.value > 0 ? '#27ae60' : '#c0392b' }}>
                                            {statBuff.value > 0 ? `+${statBuff.value}` : statBuff.value}
                                        </span>
                                    )}
                                </span>
                                <span className={styles.abMod}>{fmtMod(getMod(effectiveVal))}</span>
                                <div className={styles.pmSlot}>
                                    <button className={styles.minusBtn} style={{ visibility: hasPending ? 'visible' : 'hidden' }}
                                        onClick={() => setPendingASI(prev => { const n={...prev}; n[ab]=(n[ab]||0)-1; if(n[ab]<=0) delete n[ab]; return n; })}>-</button>
                                    <button className={styles.plusBtn} style={{ visibility: canAdd ? 'visible' : 'hidden' }}
                                        onClick={() => setPendingASI(prev => ({...prev, [ab]: (prev[ab]||0)+1}))}>+</button>
                                </div>
                            </div>
                            </GameTooltip>
                        );
                    })}

                    {/* Feat option */}
                    {totalASIPoints > 0 && usedASIPoints === 0 && (
                        <button className={styles.featChoiceBtn} onClick={() => setShowFeatPicker(true)}>
                            <Award size={12} /> Or choose a Feat
                        </button>
                    )}

                    <div className={styles.sectionLabel}>
                        Saving Throws
                        <button className={styles.sectionInfoBtn} onClick={() => openCodex('mechanics', 'general_saving_throws')}><Info size={12} /></button>
                    </div>
                    {['STR','DEX','CON','INT','WIS','CHA'].map(ab => {
                        const isProf = pc.savingThrowProficiencies?.includes(ab as any);
                        const mod = getMod(stats[ab] || 10) + (isProf ? profBonus : 0);
                        return (
                            <div key={ab} className={styles.saveRow}>
                                {isProf ? <Check size={15} className={styles.profCheck} /> : <span className={styles.profEmpty} />}
                                <span className={styles.saveName}>{ab}</span>
                                <span className={styles.abScore} />{/* spacer to align with ability score column */}
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
                        onItemContextMenu={(e: React.MouseEvent, item: PaperdollItem, slotId: string) => {
                            setCtxMenu({ x: e.clientX, y: e.clientY, item, source: 'slot', slotId });
                        }}
                    />
                </div>

                {/* CENTER-RIGHT: Inventory + Combat + HP + Buttons */}
                <div className={styles.centerRight}>
                    <InventoryBag
                        items={inventoryItems}
                        gold={gold as any}
                        capacity={(stats.STR || 10) * 15}
                        onItemEquipped={async (item) => { if(engine) await engine.equipItem(item.instanceId); }}
                        onReceiveItem={() => {}}
                        onItemContextMenu={(e: React.MouseEvent, item: PaperdollItem) => {
                            setCtxMenu({ x: e.clientX, y: e.clientY, item, source: 'bag' });
                        }}
                    />

                    <div className={styles.combatMetrics}>
                        <GameTooltip text={acBonusData.value ? acBonusData.sources.join(', ') : undefined}>
                        <div className={styles.metricBox} onClick={() => openCodex('mechanics', 'combat_ac')} style={{cursor:'pointer'}}>
                            <div className={styles.metricVal}>
                                {pc.ac + acBonusData.value}
                                {acBonusData.value !== 0 && (
                                    <span className={acBonusData.value > 0 ? styles.buffIndicator : styles.debuffIndicator}>
                                        {acBonusData.value > 0 ? `+${acBonusData.value}` : acBonusData.value}
                                    </span>
                                )}
                            </div>
                            <div className={styles.metricLbl}><Shield size={12} /> AC <Info size={8} className={styles.metricInfo} /></div>
                        </div>
                        </GameTooltip>
                        <div className={styles.metricBox} onClick={() => openCodex('mechanics', 'combat_initiative')} style={{cursor:'pointer'}}>
                            <div className={styles.metricVal}>{fmtMod(getMod(stats.DEX || 10))}</div>
                            <div className={styles.metricLbl}><Zap size={12} /> Init <Info size={8} className={styles.metricInfo} /></div>
                        </div>
                        <div className={styles.metricBox} onClick={() => openCodex('mechanics', 'combat_speed')} style={{cursor:'pointer'}}>
                            <div className={styles.metricVal}>30ft</div>
                            <div className={styles.metricLbl}><Footprints size={12} /> Spd <Info size={8} className={styles.metricInfo} /></div>
                        </div>
                    </div>


                    <ParticleGlow
                        active={!!((pc as any)._newFeatures?.length) && !showFeatures && !showFeatPicker}
                        glowRange={12}
                        particleRange={20}
                        particleSpeed={0.33}
                        className={styles.panelBtn}
                        onClick={() => setShowFeatures(!showFeatures)}
                    >
                        <BookOpen size={13} /> Class Features ({AbilityParser.getCombatAbilities(pc).length})
                    </ParticleGlow>
                    <div style={{ height: 15 }} />
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
                                    // Determine lock reason (when can't invest but not because of max tier)
                                    let lockReason = '';
                                    if (!canInv && eTier < 4) {
                                        if (pc.level < gate) lockReason = `Requires level ${gate}`;
                                        else if (cost !== undefined && effectiveSP < cost) lockReason = `Needs ${cost} SP (have ${effectiveSP})`;
                                    } else if (eTier >= 4) {
                                        lockReason = 'Maximum tier reached';
                                    }
                                    const showLock = lockReason && effectiveSP > 0 && eTier < 4;
                                    const pips = Array.from({length:4},(_,i) => i < baseTier ? 'f' : i < eTier ? 'p' : 'e');
                                    return (
                                        <div key={sn} className={`${styles.skillRow} ${pAdv > 0 ? styles.rowPending : ''}`}>
                                            <span className={styles.pips}>
                                                {pips.map((p,i) => <span key={i} className={`${styles.pip} ${p==='f'?styles.pipF:p==='p'?styles.pipP:styles.pipE}`}
                                                    style={p==='f'?{backgroundColor:TIER_COLORS[baseTier]}:undefined} />)}
                                            </span>
                                            <span className={styles.skillName}>{sn}</span>
                                            {eTier > 0 && <span className={styles.tierTag} style={{color:TIER_COLORS[eTier], cursor:'pointer'}} onClick={(e) => {e.stopPropagation(); openCodex('mechanics', 'skill_proficiency_tiers');}}>{TIER_NAMES[eTier]}</span>}
                                            <span className={styles.skillMod}>{fmtMod(mod)}</span>
                                            <GameTooltip text={lockReason || undefined}><span className={styles.lockSlot}>
                                                {showLock ? <Lock size={10} className={styles.lockIcon} /> : null}
                                            </span></GameTooltip>
                                            <button className={styles.infoBtn} onClick={() => openCodex('skills', sn)}><Info size={10} /></button>
                                            {eTier < 4 && cost !== undefined && (
                                                <span className={`${styles.spCostBadge} ${canInv ? styles.spCostAffordable : styles.spCostLocked}`}>{cost} SP</span>
                                            )}
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

                </div>{/* /canvas */}
            </div>{/* /scaleWrapper */}

            {/* Context Menu for inventory/equipment items */}
            {ctxMenu && (() => {
                const equippableTypes = ['weapon', 'armor', 'shield', 'ring', 'amulet', 'cloak', 'belt', 'boots', 'gloves', 'bracers', 'helmet'];
                const isUnid = ctxMenu.item.identified === false;
                return (
                    <ItemContextMenu
                        x={ctxMenu.x}
                        y={ctxMenu.y}
                        itemName={ctxMenu.item.name}
                        isEquippable={equippableTypes.some(t => (ctxMenu.item.type || '').toLowerCase().includes(t))}
                        equipAllowed={true}
                        isUnidentified={isUnid}
                        onClose={() => setCtxMenu(null)}
                        onAction={async (action) => {
                            if (!ctxMenu) return;
                            const { item, slotId, source } = ctxMenu;
                            setCtxMenu(null);
                            if (action === 'info') {
                                const baseItem = DataManager.getItem(item.id);
                                setDatasheetItem({ ...baseItem, ...item });
                            } else if (action === 'equip' && engine) {
                                if (source === 'slot' && slotId) await engine.unequipFromSlot(slotId);
                                else await engine.equipItem(item.instanceId);
                            } else if (action === 'examine') {
                                if (engine) await processCommand('/examine ' + item.instanceId);
                            } else if (action === 'drop' && engine) {
                                if (source === 'slot' && slotId) await engine.unequipFromSlot(slotId);
                                await engine.dropItem(item.instanceId);
                            }
                        }}
                    />
                );
            })()}

            {/* Item Datasheet popover */}
            {datasheetItem && (
                <ItemDatasheet item={datasheetItem} onClose={() => setDatasheetItem(null)} />
            )}

            {/* OVERLAYS — outside scale wrapper (fixed position) */}
            {showFeatures && (
                <div className={styles.overlay} onClick={() => {
                    // Permanently clear new features flag
                    if ((pc as any)._newFeatures) {
                        (pc as any)._newFeatures = undefined;
                        updateState();
                    }
                    setShowFeatures(false);
                }}>
                    <div className={styles.overlayPanel} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.overlayTitle}>Class Features</h2>
                        {AbilityParser.getCombatAbilities(pc).map((a, i) => {
                            const isNew = !!(pc as any)._newFeatures?.includes(a.name);
                            return (
                                <ParticleGlow
                                    key={i}
                                    active={isNew}
                                    glowRange={10}
                                    particleRange={20}
                                    particleSpeed={0.33}
                                    className={styles.featureCard}
                                >
                                    <strong>{a.name}</strong> {a.actionCost !== 'NONE' && <small>({a.actionCost.replace('_',' ')})</small>}
                                    <p>{a.description}</p>
                                </ParticleGlow>
                            );
                        })}
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
            {showFeatPicker && (
                <div className={styles.overlay} style={{ zIndex: 10000 }} onClick={() => { setShowFeatPicker(false); setSelectedFeat(null); }}>
                    <div className={styles.overlayPanel} onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <h2 className={styles.overlayTitle}>Choose a Feat</h2>
                        <p className={styles.featPickerDesc}>
                            Select a feat instead of an Ability Score Improvement. This consumes your ASI.
                        </p>
                        <div className={styles.featList}>
                            {LevelingEngine.getAvailableFeats(pc).map((feat: any) => (
                                <div
                                    key={feat.name}
                                    className={`${styles.featureCard} ${selectedFeat === feat.name ? styles.featSelected : styles.featSelectable}`}
                                    onClick={() => setSelectedFeat(selectedFeat === feat.name ? null : feat.name)}
                                >
                                    <strong>{feat.name}</strong>
                                    {feat.effects?.map((eff: any, i: number) => (
                                        <span key={i} className={styles.featEffect}>
                                            {eff.type === 'ability_increase' && `+${eff.value} ${eff.ability}`}
                                            {eff.type === 'hp_per_level' && `+${eff.value} HP/level`}
                                            {eff.type === 'initiative_bonus' && `+${eff.value} Initiative`}
                                            {eff.type === 'speed_bonus' && `+${eff.value}ft Speed`}
                                        </span>
                                    ))}
                                    <p>{feat.description}</p>
                                    {feat.prerequisites && (
                                        <p className={styles.featPrereq}>
                                            Requires: {feat.prerequisites.spellcaster ? 'Spellcaster' : ''}
                                            {feat.prerequisites.minAbility ? `${Object.entries(feat.prerequisites.minAbility).map(([k,v]) => `${k} ${v}+`).join(', ')}` : ''}
                                        </p>
                                    )}
                                </div>
                            ))}
                            {LevelingEngine.getAvailableFeats(pc).length === 0 && (
                                <p style={{ opacity: 0.5, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>No feats available.</p>
                            )}
                        </div>
                        <div className={styles.featFooter}>
                            <button className={styles.featCancelBtn} onClick={() => { setShowFeatPicker(false); setSelectedFeat(null); }}>Cancel</button>
                            <button
                                className={styles.featConfirmBtn}
                                disabled={!selectedFeat}
                                onClick={() => {
                                    if (selectedFeat) {
                                        LevelingEngine.selectFeat(pc, selectedFeat);
                                        setPendingASI({});
                                        setSelectedFeat(null);
                                        setShowFeatPicker(false);
                                        updateState();
                                    }
                                }}
                            >
                                <Award size={14} /> Confirm Feat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnifiedCharacterPage;
