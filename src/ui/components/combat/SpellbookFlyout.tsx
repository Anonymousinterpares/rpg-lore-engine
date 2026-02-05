import React, { useState } from 'react';
import styles from './SpellbookFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Sparkles, Info } from 'lucide-react';
import { useBook } from '../../context/BookContext';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import Codex from '../codex/Codex';

interface SpellbookFlyoutProps {
    spells: Spell[];
    spellSlots?: Record<string, { current: number; max: number }>;
    onCast: (spell: Spell) => void;
    onClose: () => void;
}

const SpellIcon: React.FC<{ spellName: string }> = ({ spellName }) => {
    const [failed, setFailed] = React.useState(false);
    const name = spellName.toLowerCase().replace(/ /g, '_');
    const path = `/assets/spells/${name}.png`;

    if (failed) return <div className={styles.iconPlaceholder}><Sparkles size={16} /></div>;

    return (
        <div className={styles.spellIconContainer}>
            <img
                src={path}
                alt=""
                className={styles.spellIcon}
                onError={() => setFailed(true)}
            />
        </div>
    );
};

export const SpellbookFlyout: React.FC<SpellbookFlyoutProps> = ({
    spells,
    spellSlots = {},
    onCast,
    onClose
}) => {
    const { pushPage } = useBook();
    const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');

    const filteredSpells = selectedLevel === 'all'
        ? spells
        : spells.filter(s => s.level === selectedLevel);

    const levels = Array.from(new Set(spells.map(s => s.level))).sort((a, b) => a - b);

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

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${selectedLevel === 'all' ? styles.activeTab : ''}`}
                    onClick={() => setSelectedLevel('all')}
                >
                    All
                </button>
                {levels.map(lv => (
                    <button
                        key={lv}
                        className={`${styles.tab} ${selectedLevel === lv ? styles.activeTab : ''}`}
                        onClick={() => setSelectedLevel(lv)}
                    >
                        {lv === 0 ? 'Cantrips' : `Lvl ${lv}`}
                        {lv > 0 && spellSlots[lv] && (
                            <span className={styles.slotInfo}>
                                ({spellSlots[lv].current}/{spellSlots[lv].max})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className={styles.spellGrid}>
                {filteredSpells.map(spell => {
                    const canCast = spell.level === 0 || (spellSlots[spell.level]?.current || 0) > 0;

                    return (
                        <button
                            key={spell.name}
                            className={`${styles.spellItem} ${parchmentStyles.button}`}
                            onClick={() => canCast && onCast(spell)}
                            disabled={!canCast}
                            title={spell.description}
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
                                    </div>
                                </div>
                            </div>
                        </button>
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
