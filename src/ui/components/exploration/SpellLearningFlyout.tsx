import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import styles from './SpellLearningFlyout.module.css';
import tip from '../../styles/tooltip.module.css';
import { Sparkles, X, Check, Search, Info } from 'lucide-react';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import { DataManager } from '../../../ruleset/data/DataManager';

interface SpellLearningFlyoutProps {
    className: string;
    maxLevel: number;
    count: number;
    alreadyKnown: string[];
    onConfirm: (spellNames: string[]) => void;
    onSkip: () => void;
}

const SpellIcon: React.FC<{ spellName: string }> = ({ spellName }) => {
    const [failed, setFailed] = React.useState(false);
    const name = spellName.toLowerCase().replace(/ /g, '_');
    const path = `/assets/spells/${name}.png`;

    if (failed) return <div className={styles.spellIconPlaceholder}><Sparkles size={12} /></div>;
    return (
        <div className={styles.spellIconWrap}>
            <img src={path} alt="" className={styles.spellIconImg} onError={() => setFailed(true)} />
        </div>
    );
};

const SpellLearningFlyout: React.FC<SpellLearningFlyoutProps> = ({
    className: charClass, maxLevel, count, alreadyKnown, onConfirm, onSkip
}) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [filterLevel, setFilterLevel] = useState<number>(1);
    const [infoTooltip, setInfoTooltip] = useState<{ spell: Spell; rect: DOMRect } | null>(null);

    const available = useMemo(() => {
        const knownSet = new Set(alreadyKnown);
        return DataManager.getSpellsByClass(charClass, maxLevel)
            .filter(s => s.level > 0 && !knownSet.has(s.name));
    }, [charClass, maxLevel, alreadyKnown]);

    const filtered = useMemo(() => {
        let list = available.filter(s => s.level === filterLevel);
        if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [available, filterLevel, search]);

    const levels = Array.from(new Set(available.map(s => s.level))).sort();

    const toggleSpell = (name: string) => {
        setSelected(prev => {
            if (prev.includes(name)) return prev.filter(n => n !== name);
            if (prev.length >= count) return prev;
            return [...prev, name];
        });
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <Sparkles size={18} className={styles.icon} />
                    <h3>Learn New Spells</h3>
                    <button className={styles.closeBtn} onClick={onSkip}><X size={18} /></button>
                </div>

                <p className={styles.desc}>
                    Choose <strong>{count}</strong> new spell{count > 1 ? 's' : ''} to add to your {charClass === 'Wizard' ? 'spellbook' : 'known spells'}.
                </p>

                <div className={styles.counter}>
                    Selected: {selected.length} / {count}
                </div>

                <div className={styles.controls}>
                    <div className={styles.searchBox}>
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search spells..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                    <div className={styles.levelTabs}>
                        {levels.map(lv => (
                            <button
                                key={lv}
                                className={`${styles.lvlTab} ${filterLevel === lv ? styles.lvlTabActive : ''}`}
                                onClick={() => setFilterLevel(lv)}
                            >L{lv}</button>
                        ))}
                    </div>
                </div>

                <div className={styles.spellList}>
                    {filtered.map(spell => {
                        const isSelected = selected.includes(spell.name);
                        const isFull = selected.length >= count && !isSelected;
                        const row = (
                            <div
                                className={`${styles.spellRow} ${isFull ? styles.spellDisabled : ''}`}
                                onClick={() => !isFull && toggleSpell(spell.name)}
                            >
                                <span className={styles.spellLevel}>L{spell.level}</span>
                                <span className={styles.spellSchool}>{spell.school}</span>
                                <SpellIcon spellName={spell.name} />
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
                            </div>
                        );

                        return (
                            <div key={spell.name} className={isSelected ? styles.spellSelected : undefined}>
                                {row}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <p className={styles.empty}>No spells match your criteria.</p>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
                    <button
                        className={styles.confirmBtn}
                        onClick={() => onConfirm(selected)}
                        disabled={selected.length === 0}
                    >
                        <Check size={16} /> Learn {selected.length > 0 ? `(${selected.length})` : ''}
                    </button>
                </div>
            </div>

            {/* Spell Info Tooltip — shared style, portal to body */}
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

export default SpellLearningFlyout;
