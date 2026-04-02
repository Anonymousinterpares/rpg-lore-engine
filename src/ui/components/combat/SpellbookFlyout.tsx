import React, { useState } from 'react';
import styles from './SpellbookFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Sparkles, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useBook } from '../../context/BookContext';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import Codex from '../codex/Codex';

type UpcastMode = 'inline' | 'expand' | 'tooltip';

interface SpellbookFlyoutProps {
    spells: Spell[];
    spellSlots?: Record<string, { current: number; max: number }>;
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
    if (slotLevel <= spell.level) return null;
    const scaling = (spell as any).damage?.scaling;
    if (!scaling) return null;
    const idx = scaling.levels.indexOf(slotLevel);
    return idx !== -1 ? scaling.values[idx] : null;
}

export const SpellbookFlyout: React.FC<SpellbookFlyoutProps> = ({
    spells, spellSlots = {}, onCast, onClose
}) => {
    const { pushPage } = useBook();
    const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');
    const [upcastMode, setUpcastMode] = useState<UpcastMode>('inline');
    const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
    const [hoverSpell, setHoverSpell] = useState<string | null>(null);

    const filteredSpells = selectedLevel === 'all'
        ? spells
        : spells.filter(s => s.level === selectedLevel);

    const levels = Array.from(new Set(spells.map(s => s.level))).sort((a, b) => a - b);

    const cycleMode = () => {
        const modes: UpcastMode[] = ['inline', 'expand', 'tooltip'];
        const idx = modes.indexOf(upcastMode);
        setUpcastMode(modes[(idx + 1) % modes.length]);
        setExpandedSpell(null);
    };

    const renderUpcastInline = (spell: Spell, slotLevels: number[]) => {
        if (slotLevels.length <= 1) return null;
        const baseDice = (spell as any).damage?.dice;
        return (
            <div className={styles.upcastInline}>
                <span className={styles.upcastLabel}>Cast at:</span>
                {slotLevels.map(lv => {
                    const dice = lv === spell.level ? baseDice : getUpcastDice(spell, lv);
                    return (
                        <button
                            key={lv}
                            className={`${styles.slotBtn} ${lv === spell.level ? styles.slotBtnBase : styles.slotBtnUp}`}
                            onClick={(e) => { e.stopPropagation(); onCast(spell, lv); }}
                            title={dice ? `${dice} damage` : `Level ${lv}`}
                        >
                            {lv}
                            {dice && <span className={styles.slotDice}>{dice}</span>}
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderUpcastExpand = (spell: Spell, slotLevels: number[]) => {
        if (slotLevels.length <= 1 || expandedSpell !== spell.name) return null;
        const baseDice = (spell as any).damage?.dice;
        return (
            <div className={styles.upcastExpand}>
                <div className={styles.expandTitle}>Cast at level:</div>
                {slotLevels.map(lv => {
                    const dice = lv === spell.level ? baseDice : getUpcastDice(spell, lv);
                    const slot = spellSlots[lv.toString()];
                    return (
                        <button
                            key={lv}
                            className={styles.expandOption}
                            onClick={(e) => { e.stopPropagation(); onCast(spell, lv); }}
                        >
                            <span className={styles.expandLv}>Lvl {lv}</span>
                            {dice && <span className={styles.expandDice}>{dice}</span>}
                            <span className={styles.expandSlots}>({slot?.current}/{slot?.max})</span>
                            {lv === spell.level && <span className={styles.expandBase}>★</span>}
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderUpcastTooltip = (spell: Spell, slotLevels: number[]) => {
        if (slotLevels.length <= 1 || hoverSpell !== spell.name) return null;
        const baseDice = (spell as any).damage?.dice;
        return (
            <div className={styles.upcastTooltip}>
                {slotLevels.map(lv => {
                    const dice = lv === spell.level ? baseDice : getUpcastDice(spell, lv);
                    return (
                        <button
                            key={lv}
                            className={styles.tooltipOption}
                            onClick={(e) => { e.stopPropagation(); onCast(spell, lv); }}
                        >
                            Lvl {lv}: {dice || '—'}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`${styles.flyout} ${parchmentStyles.container}`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Sparkles size={18} className={styles.titleIcon} />
                    <h3>Spellbook</h3>
                </div>
                <button className={styles.modeToggle} onClick={cycleMode} title={`Upcast mode: ${upcastMode}`}>
                    {upcastMode}
                </button>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${selectedLevel === 'all' ? styles.activeTab : ''}`}
                    onClick={() => setSelectedLevel('all')}
                >All</button>
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

            <div className={styles.spellGrid}>
                {filteredSpells.map((spell, index) => {
                    const slotLevels = getAvailableSlotLevels(spell, spellSlots);
                    const canCast = spell.level === 0 || slotLevels.length > 0;
                    const hasUpcast = slotLevels.length > 1;

                    return (
                        <div
                            key={`${spell.name}-${index}`}
                            className={`${styles.spellItem} ${parchmentStyles.button} ${!canCast ? styles.disabled : ''} ${hasUpcast ? styles.hasUpcast : ''}`}
                            onClick={() => {
                                if (!canCast) return;
                                if (upcastMode === 'expand' && hasUpcast) {
                                    setExpandedSpell(expandedSpell === spell.name ? null : spell.name);
                                    return;
                                }
                                // Default: cast at base (or lowest available) level
                                onCast(spell, slotLevels[0]);
                            }}
                            onMouseEnter={() => upcastMode === 'tooltip' && setHoverSpell(spell.name)}
                            onMouseLeave={() => upcastMode === 'tooltip' && setHoverSpell(null)}
                            title={spell.description}
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
                                                pushPage({
                                                    id: 'codex',
                                                    label: 'Codex',
                                                    content: <Codex isOpen={true} onClose={() => { }} initialDeepLink={{ category: 'magic', entryId: spell.name }} isPage={true} />
                                                });
                                            }}
                                            title="View in Codex"
                                        >
                                            <Info size={14} />
                                        </button>
                                        <span className={styles.spellSchool}>{spell.school}</span>
                                    </div>
                                    <div className={styles.spellMeta}>
                                        <span>{spell.time}</span>
                                        <span>{spell.range}</span>
                                        {(spell as any).damage?.dice && (
                                            <span className={styles.spellDamage}>{(spell as any).damage.dice}</span>
                                        )}
                                    </div>
                                    {upcastMode === 'expand' && hasUpcast && (
                                        <span className={styles.expandIndicator}>
                                            {expandedSpell === spell.name ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Upcast UI based on mode */}
                            {upcastMode === 'inline' && canCast && renderUpcastInline(spell, slotLevels)}
                            {upcastMode === 'expand' && renderUpcastExpand(spell, slotLevels)}
                            {upcastMode === 'tooltip' && renderUpcastTooltip(spell, slotLevels)}
                        </div>
                    );
                })}
                {filteredSpells.length === 0 && (
                    <div className={styles.emptyState}>No spells available in this category.</div>
                )}
            </div>
        </div>
    );
};

export default SpellbookFlyout;
