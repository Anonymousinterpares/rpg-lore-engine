import React, { useState, useEffect } from 'react';
import styles from './Codex.module.css';
import { X, Book, Users, Shield, Map, Info, Swords, Skull, Sparkles, Search } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';
import { SpellbookEngine } from '../../../ruleset/combat/SpellbookEngine';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import skillsData from '../../../data/codex/skills.json';
import conditionsData from '../../../data/codex/conditions.json';
import mechanicsData from '../../../data/codex/mechanics.json';
import worldData from '../../../data/codex/world.json';

interface CodexProps {
    isOpen: boolean;
    onClose: () => void;
    seenItems?: string[];
    initialDeepLink?: { category: string; entryId?: string };
    isPage?: boolean;
}

const CATEGORIES = [
    { id: 'world', label: 'World', icon: Map },
    { id: 'magic', label: 'Magic & Abilities', icon: Sparkles },
    { id: 'mechanics', label: 'Mechanics', icon: Shield },
    { id: 'skills', label: 'Skills', icon: Info },
    { id: 'races', label: 'Races', icon: Users },
    { id: 'classes', label: 'Classes', icon: Swords },
    { id: 'bestiary', label: 'Bestiary', icon: Skull },
    { id: 'conditions', label: 'Conditions', icon: Book },
    { id: 'items', label: 'Items', icon: Map }
];

const Codex: React.FC<CodexProps> = ({ isOpen, onClose, initialDeepLink, isPage = false, seenItems = [] }) => {
    const { state, updateState } = useGameState();
    const [activeCategory, setActiveCategory] = useState(initialDeepLink?.category || 'mechanics');
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [races, setRaces] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [spells, setSpells] = useState<Spell[]>([]);

    const parseInlines = (text: string) => {
        if (!text) return text;
        // Split by ** (bold) or * (also bold for this game's theme)
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <strong key={i}>{part.slice(1, -1)}</strong>;
            }
            return part;
        });
    };

    useEffect(() => {
        const init = async () => {
            await DataManager.initialize();
            setRaces(DataManager.getRaces());
            setClasses(DataManager.getClasses());

            if (state?.character) {
                const maxLevel = SpellbookEngine.getMaxSpellLevel(state.character);
                const classSpells = DataManager.getSpellsByClass(state.character.class, maxLevel);
                setSpells(classSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
            }

            // Handle initial deep link entry selection
            if (initialDeepLink?.entryId) {
                let data: any[] = [];
                switch (initialDeepLink.category) {
                    case 'world': data = worldData; break;
                    case 'mechanics': data = mechanicsData; break;
                    case 'magic': data = DataManager.getSpells(); break;
                    case 'skills': data = skillsData; break;
                    case 'conditions': data = conditionsData; break;
                    case 'races': data = DataManager.getRaces(); break;
                    case 'classes': data = DataManager.getClasses(); break;
                    case 'bestiary':
                    case 'items':
                        data = state?.codexEntries?.filter(e => e.category === initialDeepLink.category) || [];
                        break;
                }
                const entry = data.find(e => (e.id === initialDeepLink.entryId || e.name === initialDeepLink.entryId || e.entityId === initialDeepLink.entryId));
                if (entry) {
                    setSelectedEntry(entry);
                    setActiveCategory(initialDeepLink.category);
                }
            } else if (!selectedEntry) {
                setSelectedEntry(null);
            }
        };
        if (isOpen || isPage) init();
    }, [isOpen, initialDeepLink, isPage]);

    // Internal scroll effect when entry is selected
    useEffect(() => {
        if (selectedEntry) {
            const id = selectedEntry.id || selectedEntry.name;
            const el = document.getElementById(`entry-${id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Mark as seen if it's a spell
            if (activeCategory === 'magic' && state?.character?.unseenSpells?.includes(selectedEntry.name)) {
                state.character.unseenSpells = state.character.unseenSpells.filter(s => s !== selectedEntry.name);
                updateState();
            }
        }
    }, [selectedEntry]);

    if (!isPage && !isOpen) return null;

    const renderCategoryContent = () => {
        switch (activeCategory) {
            case 'world':
                return (
                    <div className={styles.entriesGrid}>
                        {worldData.map((item: any) => (
                            <div
                                key={item.id}
                                id={`entry-${item.id}`}
                                className={`${styles.entryCard} ${selectedEntry?.id === item.id ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(item)}
                            >
                                <h4>{item.name}</h4>
                            </div>
                        ))}
                    </div>
                );
            case 'mechanics':
                return (
                    <div className={styles.entriesGrid}>
                        {mechanicsData.map(item => (
                            <div
                                key={item.id}
                                id={`entry-${item.id}`}
                                className={`${styles.entryCard} ${selectedEntry?.id === item.id ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(item)}
                            >
                                <h4>{item.name}</h4>
                            </div>
                        ))}
                    </div>
                );
            case 'skills':
                return (
                    <div className={styles.entriesGrid}>
                        {skillsData.map(skill => (
                            <div
                                key={skill.name}
                                id={`entry-${skill.name}`}
                                className={`${styles.entryCard} ${selectedEntry?.name === skill.name ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(skill)}
                            >
                                <h4>{skill.name}</h4>
                                <span className={styles.entryType}>{skill.ability}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'races':
                return (
                    <div className={styles.entriesGrid}>
                        {races.map(race => (
                            <div
                                key={race.name}
                                id={`entry-${race.name}`}
                                className={`${styles.entryCard} ${selectedEntry?.name === race.name ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(race)}
                            >
                                <h4>{race.name}</h4>
                                <span className={styles.entryType}>{race.size}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'classes':
                return (
                    <div className={styles.entriesGrid}>
                        {classes.map(cls => (
                            <div
                                key={cls.name}
                                id={`entry-${cls.name}`}
                                className={`${styles.entryCard} ${selectedEntry?.name === cls.name ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(cls)}
                            >
                                <h4>{cls.name}</h4>
                                <span className={styles.entryType}>d{cls.hitDie}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'conditions':
                return (
                    <div className={styles.entriesGrid}>
                        {conditionsData.map(cond => (
                            <div
                                key={cond.name}
                                id={`entry-${cond.name}`}
                                className={`${styles.entryCard} ${selectedEntry?.name === cond.name ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(cond)}
                            >
                                <h4>{cond.name}</h4>
                            </div>
                        ))}
                    </div>
                );
            case 'items':
            case 'bestiary':
                const dynamicEntries = state?.codexEntries?.filter(e => e.category === activeCategory) || [];
                if (dynamicEntries.length === 0) {
                    return (
                        <div className={styles.placeholder}>
                            {activeCategory === 'items' ? 'Collect items to unlock their lore...' : 'Encounter creatures to record their history...'}
                        </div>
                    );
                }
                return (
                    <div className={styles.entriesGrid}>
                        {dynamicEntries.map(entry => (
                            <div
                                key={entry.id}
                                id={`entry-${entry.id}`}
                                className={`${styles.entryCard} ${selectedEntry?.id === entry.id ? styles.active : ''}`}
                                onClick={() => {
                                    setSelectedEntry(entry);
                                    if (entry.isNew) {
                                        entry.isNew = false;
                                        updateState();
                                    }
                                }}
                            >
                                <div className={styles.entryHeader}>
                                    <h4>{entry.title}</h4>
                                    {entry.isNew && <span className={styles.newLabel}>NEW</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'magic':
                const filteredSpells = spells.filter(s =>
                    s.name.toLowerCase().includes(searchTerm.toLowerCase())
                );
                return (
                    <>
                        <div className={styles.searchBar}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search spells & abilities..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className={styles.entriesGrid}>
                            {filteredSpells.map(spell => {
                                const isNew = state?.character?.unseenSpells?.includes(spell.name);
                                return (
                                    <div
                                        key={spell.name}
                                        id={`entry-${spell.name}`}
                                        className={`${styles.entryCard} ${selectedEntry?.name === spell.name ? styles.active : ''}`}
                                        onClick={() => setSelectedEntry(spell)}
                                    >
                                        <div className={styles.entryHeader}>
                                            <h4>{spell.name}</h4>
                                            {isNew && <span className={styles.newLabel}>NEW</span>}
                                        </div>
                                        <span className={styles.entryType}>Lvl {spell.level === 0 ? 'Cantrip' : spell.level} • {spell.school}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                );
            default:
                return <div className={styles.placeholder}>More lore coming soon...</div>;
        }
    };

    const modalContent = (
        <div className={`${styles.modal} ${isPage ? styles.isPage : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sidebar}>
                <div className={styles.codexHeader}>
                    <Book size={24} />
                    <h2>Codex</h2>
                </div>
                <nav className={styles.nav}>
                    {CATEGORIES.map(cat => {
                        const hasNew = cat.id === 'magic' && (state?.character?.unseenSpells?.length ?? 0) > 0;
                        return (
                            <button
                                key={cat.id}
                                className={`${styles.navItem} ${activeCategory === cat.id ? styles.active : ''}`}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setSelectedEntry(null);
                                }}
                            >
                                <div className={styles.navLabel}>
                                    <cat.icon size={18} />
                                    {cat.label}
                                </div>
                                {hasNew && <div className={styles.indicatorDot} />}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className={styles.main}>
                {!isPage && (
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={24} />
                    </button>
                )}

                <div className={styles.content}>
                    <div className={styles.listSection}>
                        {renderCategoryContent()}
                    </div>

                    <div className={styles.detailSection}>
                        {selectedEntry ? (
                            <div className={styles.entryDetail}>
                                <h3>{selectedEntry.name}</h3>
                                <div className={styles.divider} />
                                <div className={styles.detailBody}>
                                    {(activeCategory === 'mechanics' || activeCategory === 'world') && (
                                        <>
                                            <div className={styles.markdownContent}>
                                                {selectedEntry.description.split('\n').map((line: string, i: number) => {
                                                    if (line.startsWith('###')) return <h4 key={i} className={styles.mdH3}>{parseInlines(line.replace('###', '').trim())}</h4>;
                                                    if (line.startsWith('-')) return <li key={i} className={styles.mdLi}>{parseInlines(line.replace('-', '').trim())}</li>;
                                                    return <p key={i}>{parseInlines(line)}</p>;
                                                })}
                                            </div>
                                            {selectedEntry.examples && (
                                                <div className={styles.examples}>
                                                    <h4>Details:</h4>
                                                    <ul>
                                                        {selectedEntry.examples.map((ex: string, i: number) => (
                                                            <li key={i}>{parseInlines(ex)}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {activeCategory === 'skills' && (
                                        <>
                                            <div className={styles.statLine}><strong>Ability:</strong> {selectedEntry.ability}</div>
                                            <p>{selectedEntry.description}</p>
                                            <div className={styles.examples}>
                                                <h4>Example Uses:</h4>
                                                <ul>
                                                    {selectedEntry.examples.map((ex: string, i: number) => (
                                                        <li key={i}>{ex}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </>
                                    )}
                                    {activeCategory === 'races' && (
                                        <>
                                            <div className={styles.statLine}><strong>Size:</strong> {selectedEntry.size} | <strong>Speed:</strong> {selectedEntry.speed}ft</div>
                                            <p>{selectedEntry.description || "A lineage of adventurers."}</p>
                                            <div className={styles.examples}>
                                                <h4>Racial Traits:</h4>
                                                <ul>
                                                    {selectedEntry.traits.map((t: any, i: number) => (
                                                        <li key={i}><strong>{t.name}:</strong> {t.description}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </>
                                    )}
                                    {activeCategory === 'classes' && (
                                        <>
                                            <div className={styles.statLine}><strong>Hit Die:</strong> d{selectedEntry.hitDie} | <strong>Primary:</strong> {selectedEntry.primaryAbility.join(', ')}</div>
                                            <p>{selectedEntry.description || "A path of mastery."}</p>
                                            <div className={styles.examples}>
                                                <h4>Key Features:</h4>
                                                <ul>
                                                    {selectedEntry.allFeatures?.filter((f: any) => f.level <= 3).map((f: any, i: number) => (
                                                        <li key={i}><strong>{f.name} (Lvl {f.level}):</strong> {f.description}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </>
                                    )}
                                    {activeCategory === 'conditions' && (
                                        <>
                                            <p style={{ fontStyle: 'italic', marginBottom: '1rem', opacity: 0.8 }}>
                                                Status effects and mechanical restrictions that can affect creatures during gameplay.
                                            </p>
                                            <p>{selectedEntry.description}</p>
                                        </>
                                    )}
                                    {activeCategory === 'magic' && (
                                        <>
                                            <div className={styles.statLine}>
                                                <strong>Level:</strong> {selectedEntry.level === 0 ? 'Cantrip' : selectedEntry.level} |
                                                <strong> School:</strong> {selectedEntry.school} |
                                                <strong> Range:</strong> {selectedEntry.range}
                                            </div>
                                            <div className={styles.statLine}>
                                                <strong>Casting Time:</strong> {selectedEntry.time} |
                                                <strong> Duration:</strong> {selectedEntry.duration}
                                            </div>
                                            <div className={styles.statLine}>
                                                <strong>Components:</strong> {Object.entries(selectedEntry.components || {}).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ')}
                                                {selectedEntry.concentration ? ' (Concentration)' : ''}
                                            </div>
                                            <p className={styles.spellDescription}>{selectedEntry.description}</p>
                                        </>
                                    )}
                                    {(activeCategory === 'bestiary' || activeCategory === 'items') && (
                                        <div className={styles.markdownContent}>
                                            {selectedEntry.content.split('\n').map((line: string, i: number) => {
                                                if (line.startsWith('###')) return <h4 key={i} className={styles.mdH3}>{parseInlines(line.replace('###', '').trim())}</h4>;
                                                if (line.startsWith('-')) return <li key={i} className={styles.mdLi}>{parseInlines(line.replace('-', '').trim())}</li>;
                                                return <p key={i}>{parseInlines(line)}</p>;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.emptyDetail}>
                                <Book size={48} opacity={0.2} />
                                <p>Select an entry to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (isPage) return modalContent;

    return (
        <div className={styles.overlay} onClick={onClose}>
            {modalContent}
        </div>
    );
};

export default Codex;
