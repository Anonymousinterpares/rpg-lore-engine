import React, { useState, useEffect } from 'react';
import styles from './SpellPreparationPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';
import { SpellbookEngine } from '../../../ruleset/combat/SpellbookEngine';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import { Sparkles, Book as BookIcon, Plus, Minus, Search, X } from 'lucide-react';

const SpellIcon: React.FC<{ spellName: string }> = ({ spellName }) => {
    const [iconPath, setIconPath] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (failed) return;
        const name = spellName.toLowerCase().replace(/ /g, '_');
        // Standard asset path
        const tryPath = `/assets/spells/spell_${name}.png`;
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

                // Logic based on class
                if (pc.class === 'Wizard') {
                    // Wizards can only prepare from their spellbook
                    for (const name of pc.spellbook) {
                        const spell = DataManager.getSpell(name);
                        if (spell) spells.push(spell);
                    }
                } else if (pc.class === 'Cleric' || pc.class === 'Druid') {
                    // These classes have access to their entire list (filtered by class metadata)
                    spells = DataManager.getSpells().filter(s => s.classes?.includes(pc.class));
                } else {
                    // For Sorcerers, Bards, etc., use knownSpells
                    for (const name of pc.knownSpells) {
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
    const preparedCount = pc.preparedSpells.length;

    const isPrepared = (name: string) => pc.preparedSpells.includes(name);

    const handleToggleSpell = (spell: Spell) => {
        const currentPrepared = [...pc.preparedSpells];
        const index = currentPrepared.indexOf(spell.name);

        if (index !== -1) {
            // Unprepare
            currentPrepared.splice(index, 1);
        } else {
            // Prepare
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
        return matchesLevel && matchesSearch;
    });

    if (loading) return <div className={styles.loading}>Opening Spellbook...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleInfo}>
                    <Sparkles className={styles.headerIcon} />
                    <h2 className={parchmentStyles.heading}>Spell Selection</h2>
                </div>
                <div className={`${styles.counter} ${preparedCount >= maxPrepared ? styles.atLimit : ''}`}>
                    Prepared: {preparedCount} / {maxPrepared}
                </div>
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
                    {/* Source List */}
                    <div className={`${parchmentStyles.panel} ${styles.sourcePane}`}>
                        <h3 className={styles.paneTitle}>Available Spells</h3>
                        <div className={styles.spellList}>
                            {filteredSpells.length === 0 ? (
                                <p className={styles.empty}>No spells found.</p>
                            ) : (
                                filteredSpells.map(spell => (
                                    <div
                                        key={spell.name}
                                        className={`${styles.spellItem} ${isPrepared(spell.name) ? styles.isPrepared : ''}`}
                                    >
                                        <div className={styles.spellInfoRow}>
                                            <SpellIcon spellName={spell.name} />
                                            <div className={styles.spellInfo}>
                                                <span className={styles.spellName}>{spell.name}</span>
                                                <span className={styles.spellMeta}>Lvl {spell.level} • {spell.school}</span>
                                            </div>
                                        </div>
                                        <button
                                            className={`${styles.actionBtn} ${isPrepared(spell.name) ? styles.btnRemove : styles.btnAdd}`}
                                            onClick={() => handleToggleSpell(spell)}
                                            disabled={!isPrepared(spell.name) && preparedCount >= maxPrepared}
                                        >
                                            {isPrepared(spell.name) ? <Minus size={16} /> : <Plus size={16} />}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Prepared List */}
                    <div className={`${parchmentStyles.panel} ${styles.preparedPane}`}>
                        <h3 className={styles.paneTitle}>Current Preparation</h3>
                        <div className={styles.spellList}>
                            {pc.preparedSpells.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <BookIcon size={32} opacity={0.3} />
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
                </div>
            </div>
        </div>
    );
};

export default SpellPreparationPanel;
