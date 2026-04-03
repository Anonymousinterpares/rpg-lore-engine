import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './SpellbookFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import tip from '../../styles/tooltip.module.css';
import { X, Sparkles, Info } from 'lucide-react';
import { Spell } from '../../../ruleset/schemas/SpellSchema';

interface SpellbookFlyoutProps {
    spells: Spell[];
    spellSlots?: Record<string, { current: number; max: number }>;
    distanceToTarget?: number;
    resources?: { actionSpent: boolean; bonusActionSpent: boolean; reactionSpent: boolean };
    onCast: (spell: Spell, slotLevel?: number) => void;
    onClose: () => void;
}

const SpellIcon: React.FC<{ spellName: string }> = ({ spellName }) => {
    const [failed, setFailed] = React.useState(false);
    const name = spellName.toLowerCase().replace(/ /g, '_');
    const path = `/assets/spells/${name}.png`;

    if (failed) return <div className={styles.iconPlaceholder}><Sparkles size={16} /></div>;

    return (
        <div className={styles.spellIconContainer}>
            <img src={path} alt="" className={styles.spellIcon} onError={() => setFailed(true)} />
        </div>
    );
};

/** Get available slot levels for a spell (base level and above with remaining slots) */
function getAvailableSlotLevels(spell: Spell, spellSlots: Record<string, { current: number; max: number }>): number[] {
    if (spell.level === 0) return []; // Cantrips don't use slots
    const levels: number[] = [];
    for (let lv = spell.level; lv <= 9; lv++) {
        const slot = spellSlots[lv.toString()];
        if (slot && slot.current > 0) levels.push(lv);
    }
    return levels;
}

/** Get upcast damage dice for a given slot level */
function getUpcastDice(spell: Spell, slotLevel: number): string | null {
    const dmg = (spell as any).damage;
    if (!dmg) return null;
    if (slotLevel === spell.level) return dmg.dice || null;
    const scaling = dmg.scaling;
    if (!scaling) return null;
    const idx = scaling.levels.indexOf(slotLevel);
    return idx !== -1 ? scaling.values[idx] : null;
}

/** Parse spell range to feet. Returns Infinity for "Self", 5 for "Touch". */
function parseRange(range: string): number {
    if (!range) return Infinity;
    const lower = range.toLowerCase();
    if (lower === 'self' || lower.startsWith('self')) return Infinity; // Self spells always in range
    if (lower === 'touch') return 5;
    const match = range.match(/(\d+)\s*(feet|ft)/i);
    return match ? parseInt(match[1]) : Infinity;
}

/** Get the CSS tier class for a level rectangle */
function getLevelTierClass(lv: number): string {
    if (lv <= 1) return styles.lvlTier1;
    if (lv <= 2) return styles.lvlTier2;
    return styles.lvlTier3;
}

export const SpellbookFlyout: React.FC<SpellbookFlyoutProps> = ({
    spells, spellSlots = {}, distanceToTarget, resources, onCast, onClose
}) => {
    const levels = Array.from(new Set(spells.map(s => s.level))).sort((a, b) => a - b);
    // Default to first non-cantrip level, or cantrips if that's all there is
    const defaultLevel = levels.find(l => l > 0) ?? levels[0] ?? 0;
    const [selectedLevel, setSelectedLevel] = useState<number>(defaultLevel);
    const [selectedSlot, setSelectedSlot] = useState<Record<string, number | null>>({});
    const [infoTooltip, setInfoTooltip] = useState<{ spell: Spell; rect: DOMRect } | null>(null);

    const filteredSpells = spells.filter(s => s.level === selectedLevel);

    // Slot summary: all non-zero slot levels
    const slotLevelKeys = Object.keys(spellSlots)
        .map(Number)
        .filter(k => k > 0 && spellSlots[k.toString()])
        .sort((a, b) => a - b);

    const handleSlotClick = (e: React.MouseEvent, spellName: string, lv: number) => {
        e.stopPropagation();
        setSelectedSlot(prev => ({
            ...prev,
            [spellName]: prev[spellName] === lv ? null : lv
        }));
    };


    return (
        <div className={`${styles.flyout} ${parchmentStyles.container}`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Sparkles size={18} className={styles.titleIcon} />
                    <h3>Spellbook</h3>
                </div>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            {/* Slot Summary */}
            {slotLevelKeys.length > 0 && (
                <div className={styles.slotSummary}>
                    <span className={styles.slotSummaryLabel}>Remaining Slots:</span>
                    {slotLevelKeys.map(lv => {
                        const slot = spellSlots[lv.toString()];
                        const isEmpty = slot.current <= 0;
                        return (
                            <span key={lv} className={`${styles.slotSummaryItem} ${isEmpty ? styles.slotSummaryEmpty : ''}`}>
                                L{lv} (<span className={styles.slotSummaryCount}>{slot.current}</span>)
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Level Tabs (no "All" tab) */}
            <div className={styles.tabs}>
                {levels.map(lv => (
                    <button
                        key={lv}
                        className={`${styles.tab} ${selectedLevel === lv ? styles.activeTab : ''}`}
                        onClick={() => setSelectedLevel(lv)}
                    >
                        {lv === 0 ? 'Cantrips' : `Lvl ${lv}`}
                        {lv > 0 && spellSlots[lv] && (
                            <span className={styles.slotInfo}>({spellSlots[lv].current}/{spellSlots[lv].max})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Spell Grid */}
            <div className={styles.spellGrid}>
                {filteredSpells.map((spell, index) => {
                    const slotLevels = getAvailableSlotLevels(spell, spellSlots);
                    const spellRange = parseRange(spell.range);
                    const outOfRange = distanceToTarget != null && distanceToTarget > spellRange;

                    // Check resource availability based on casting time
                    const castTime = spell.time?.toLowerCase() || '1 action';
                    const isReaction = castTime.includes('reaction');
                    const isBonusAction = castTime.includes('bonus');
                    const resourceSpent = resources
                        ? (isReaction ? resources.reactionSpent : isBonusAction ? resources.bonusActionSpent : resources.actionSpent)
                        : false;

                    const canCast = !outOfRange && !resourceSpent && (spell.level === 0 || slotLevels.length > 0);
                    const chosenLv = selectedSlot[spell.name];
                    const isCastReady = canCast && chosenLv != null;
                    const hasScaling = !!(spell as any).damage?.scaling;
                    const hasDamage = !!(spell as any).damage?.dice;
                    const showNoScaling = spell.level > 0 && slotLevels.length > 1 && hasDamage && !hasScaling;

                    // Disabled reason
                    let disabledReason = '';
                    if (resourceSpent) {
                        disabledReason = isReaction ? 'Reaction already used' : isBonusAction ? 'Bonus action already used' : 'Action already used';
                    } else if (outOfRange) {
                        disabledReason = `Out of range (${distanceToTarget}ft, need ${spellRange}ft)`;
                    } else if (!canCast && spell.level > 0) {
                        const baseSlot = spellSlots[spell.level.toString()];
                        if (!baseSlot) disabledReason = `No level ${spell.level} spell slots`;
                        else if (baseSlot.current <= 0) disabledReason = `Level ${spell.level} slots exhausted`;
                    }

                    return (
                        <div
                            key={`${spell.name}-${index}`}
                            className={`${styles.spellItem} ${parchmentStyles.button} ${!canCast ? styles.disabled : ''}`}
                            onClick={() => {
                                if (!canCast) return;
                                // Cantrips: cast immediately on card click
                                if (spell.level === 0) onCast(spell);
                            }}
                            style={{ position: 'relative' }}
                        >
                            <div className={styles.spellMain}>
                                <SpellIcon spellName={spell.name} />
                                <div className={styles.spellContent}>
                                    <div className={styles.spellHeader}>
                                        <span className={styles.spellName}>{spell.name}</span>
                                        <button
                                            className={styles.infoBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setInfoTooltip(prev => prev?.spell.name === spell.name ? null : { spell, rect });
                                            }}
                                        >
                                            <Info size={14} />
                                        </button>
                                        <span className={styles.spellSchool}>{spell.school}</span>
                                        <span className={styles.spellRange}>{spell.range}</span>
                                    </div>
                                    <div className={styles.spellMeta}>
                                        <span>{spell.time}</span>
                                        {(spell as any).damage?.dice && (
                                            <span className={styles.spellDamage}>{(spell as any).damage.dice}</span>
                                        )}
                                    </div>
                                    {/* CAST button — overlays above level row when a level is selected */}
                                    {isCastReady && (
                                        <div className={styles.castBtnWrap}>
                                            <button
                                                className={styles.castBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCast(spell, chosenLv!);
                                                    setSelectedSlot(prev => ({ ...prev, [spell.name]: null }));
                                                }}
                                            >
                                                CAST
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Disabled reason — outside greyscaled area so color stays visible */}
                            {disabledReason && (
                                <span className={styles.disabledReason}>{disabledReason}</span>
                            )}

                            {/* Level selector row — only for leveled spells with available slots */}
                            {spell.level > 0 && canCast && slotLevels.length > 0 && (
                                <div className={styles.levelRow}>
                                    <span className={styles.levelLabel}>Cast at:</span>
                                    {slotLevels.map(lv => {
                                        const dice = getUpcastDice(spell, lv);
                                        const isSelected = chosenLv === lv;
                                        const tierClass = getLevelTierClass(lv);
                                        return (
                                            <button
                                                key={lv}
                                                className={`${styles.lvlBtn} ${tierClass} ${isSelected ? styles.lvlSelected : ''}`}
                                                onClick={(e) => handleSlotClick(e, spell.name, lv)}
                                            >
                                                {lv}
                                                {dice && <span className={styles.lvlDice}>{dice}</span>}
                                            </button>
                                        );
                                    })}
                                    {showNoScaling && (
                                        <span className={styles.noScaling}>No scaling</span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {filteredSpells.length === 0 && (
                    <div className={styles.emptyState}>No spells available in this category.</div>
                )}
            </div>

            {/* Spell Info Tooltip — uses shared tooltip styles */}
            {infoTooltip && ReactDOM.createPortal(
                <>
                    <div className={tip.backdrop} onClick={() => setInfoTooltip(null)} />
                    <div
                        className={tip.tooltip}
                        ref={(el) => {
                            if (!el) return;
                            const tipH = el.offsetHeight;
                            const tipW = el.offsetWidth;
                            let top = infoTooltip.rect.bottom + 6;
                            let left = infoTooltip.rect.right + 8;
                            if (top + tipH > window.innerHeight - 10) {
                                top = Math.max(10, window.innerHeight - tipH - 10);
                            }
                            if (left + tipW > window.innerWidth - 10) {
                                left = Math.max(10, infoTooltip.rect.left - tipW - 8);
                            }
                            el.style.top = `${top}px`;
                            el.style.left = `${left}px`;
                        }}
                    >
                        <div className={tip.header}>
                            <span className={tip.name}>{infoTooltip.spell.name}</span>
                            <span className={tip.subtitle}>{infoTooltip.spell.school} — Level {infoTooltip.spell.level}</span>
                        </div>
                        <div className={tip.row}>
                            <span>Range: {infoTooltip.spell.range}</span>
                            <span>Time: {infoTooltip.spell.time}</span>
                        </div>
                        {(infoTooltip.spell as any).duration && (
                            <div className={tip.row}>
                                <span>Duration: {(infoTooltip.spell as any).duration}</span>
                            </div>
                        )}
                        {(infoTooltip.spell as any).damage?.dice && (
                            <div className={tip.highlight}>
                                Damage: {(infoTooltip.spell as any).damage.dice} {(infoTooltip.spell as any).damage.type || ''}
                            </div>
                        )}
                        <div className={tip.desc}>{infoTooltip.spell.description}</div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default SpellbookFlyout;
