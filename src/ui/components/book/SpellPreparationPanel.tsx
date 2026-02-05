import React, { useState, useEffect } from 'react';
import styles from './SpellPreparationPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
import { useBook } from '../../context/BookContext';
import { DataManager } from '../../../ruleset/data/DataManager';
import { SpellbookEngine } from '../../../ruleset/combat/SpellbookEngine';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import Codex from '../codex/Codex';
import { Sparkles, Book, Plus, Minus, Search, X, Info } from 'lucide-react';

const SpellIcon: React.FC<{ spellName: string }> = ({ spellName }) => {
    const [iconPath, setIconPath] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (failed) return;
        const name = spellName.toLowerCase().replace(/ /g, '_');
        // Standard asset path
        const tryPath = `/assets/spells/${name}.png`;
        setIconPath(tryPath);
    }, [spellName, failed]);

    if (failed || !iconPath) return null;

    return (
        <div className={styles.spellIconContainer}>
            <img
                src={iconPath}
                alt=""
                className={styles.spellIcon}
                onError={() => setFailed(true)}
            />
        </div>
    );
};

const SpellPreparationPanel: React.FC = () => {
    const { state, updateState } = useGameState();
    const { pushPage } = useBook();
    const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);
    const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await DataManager.loadSpells();

            if (state?.character) {
                const pc = state.character;
                let spells: Spell[] = [];

                if (pc.class === 'Wizard') {
                    const allSourceNames = [...(pc.cantripsKnown || []), ...pc.spellbook];
                    for (const name of allSourceNames) {
                        const spell = DataManager.getSpell(name);
                        if (spell) spells.push(spell);
                    }
                } else if (pc.class === 'Cleric' || pc.class === 'Druid') {
                    spells = DataManager.getSpells().filter(s => s.classes?.includes(pc.class));
                } else {
                    const allSourceNames = [...(pc.cantripsKnown || []), ...pc.knownSpells];
                    for (const name of allSourceNames) {
                        const spell = DataManager.getSpell(name);
                        if (spell) spells.push(spell);
                    }
                }

                setAvailableSpells(spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
            }
            setLoading(false);
        };
        load();
    }, [state?.character?.class, state?.character?.spellbook, state?.character?.knownSpells]);

    if (!state?.character) return null;
    const pc = state.character;
    const maxPrepared = SpellbookEngine.getMaxPreparedCount(pc);
    const preparedCount = pc.preparedSpells.filter(name => {
        const s = DataManager.getSpell(name);
        return s && s.level > 0;
    }).length;
    const isAlwaysPrepared = SpellbookEngine.isKnownSpellsCaster(pc.class);
    const maxSpellLevel = SpellbookEngine.getMaxSpellLevel(pc);

    const isPrepared = (name: string) => pc.preparedSpells.includes(name);

    const handleToggleSpell = (spell: Spell) => {
        if (!state?.character) return;
        // ... (rest of the function omitted for brevity, but I need to make sure I don't break it)
        if (isAlwaysPrepared) return; // Cannot unprepare known spells
        const currentPrepared = [...pc.preparedSpells];
        const index = currentPrepared.indexOf(spell.name);

        if (index !== -1) {
            currentPrepared.splice(index, 1);
        } else {
            if (preparedCount >= maxPrepared) return;
            currentPrepared.push(spell.name);
        }

        const result = SpellbookEngine.prepareSpells(pc, currentPrepared);
        if (result.success) {
            updateState();
        }
    };

    // Derived filtering - ensures UI responds immediately to state changes and avoids duplicates
    const filteredSpells = availableSpells.filter(s => {
        const matchesLevel = filterLevel === 'all' || s.level === Number(filterLevel);
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const withinMaxLevel = s.level <= maxSpellLevel || s.level === 0; // Cantrips are always level 0
        return matchesLevel && matchesSearch && withinMaxLevel;
    });

    if (loading) return <div className={styles.loading}>Opening Spellbook...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <Sparkles className={styles.headerIcon} />
                    <h2 className={parchmentStyles.heading}>{isAlwaysPrepared ? 'Known Spells' : 'Spell Selection'}</h2>
                </div>
                {!isAlwaysPrepared && (
                    <div className={`${styles.counter} ${preparedCount >= maxPrepared ? styles.atLimit : ''}`}>
                        Prepared: {preparedCount} / {maxPrepared}
                    </div>
                )}
            </header>

            <div className={styles.mainLayout}>
                {/* Search and Filters */}
                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Find spell..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={styles.levelTabs}>
                        {['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                            <button
                                key={lvl}
                                className={`${styles.levelTab} ${filterLevel === lvl ? styles.activeTab : ''}`}
                                onClick={() => setFilterLevel(lvl as any)}
                            >
                                {lvl === 'all' ? 'All' : lvl}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.panes}>
                    {/* Source/Known List */}
                    <div className={`${parchmentStyles.panel} ${styles.sourcePane}`}>
                        <h3 className={styles.paneTitle}>{isAlwaysPrepared ? 'Known Spells' : 'Available Spells'}</h3>
                        <div className={styles.spellList}>
                            {filteredSpells.length === 0 ? (
                                <p className={styles.empty}>No spells found.</p>
                            ) : (
                                filteredSpells.map(spell => (
                                    <div
                                        key={spell.name}
                                        className={`${styles.spellItem} ${(!isAlwaysPrepared && isPrepared(spell.name)) ? styles.isPrepared : ''}`}
                                    >
                                        <div className={styles.spellInfoRow}>
                                            <SpellIcon spellName={spell.name} />
                                            <div className={styles.spellInfo}>
                                                <div className={styles.spellHeaderRow}>
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
                                                </div>
                                                <span className={styles.spellMeta}>Lvl {spell.level} • {spell.school}</span>
                                            </div>
                                        </div>
                                        {!isAlwaysPrepared && spell.level > 0 && (
                                            <button
                                                className={`${styles.actionBtn} ${isPrepared(spell.name) ? styles.btnRemove : styles.btnAdd}`}
                                                onClick={() => handleToggleSpell(spell)}
                                                disabled={!isPrepared(spell.name) && preparedCount >= maxPrepared}
                                            >
                                                {isPrepared(spell.name) ? <Minus size={16} /> : <Plus size={16} />}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Prepared List - Only for Prepare-casters */}
                    {!isAlwaysPrepared && (
                        <div className={`${parchmentStyles.panel} ${styles.preparedPane}`}>
                            <h3 className={styles.paneTitle}>Current Preparation</h3>
                            <div className={styles.spellList}>
                                {pc.preparedSpells.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <Book size={32} opacity={0.3} />
                                        <p>No spells prepared for the day.</p>
                                    </div>
                                ) : (
                                    pc.preparedSpells.map(name => {
                                        const spell = DataManager.getSpell(name);
                                        return (
                                            <div key={name} className={styles.preparedItem}>
                                                <div className={styles.preparedInfoRow}>
                                                    <SpellIcon spellName={name} />
                                                    <span className={styles.preparedName}>{name}</span>
                                                </div>
                                                <button
                                                    className={styles.unprepareBtn}
                                                    onClick={() => spell && handleToggleSpell(spell)}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpellPreparationPanel;
