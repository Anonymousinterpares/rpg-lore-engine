import React, { useState, useEffect } from 'react';
import styles from './Codex.module.css';
import { X, Book, Users, Shield, Map, Info, Swords } from 'lucide-react';
import { DataManager } from '../../../ruleset/data/DataManager';
import skillsData from '../../../data/codex/skills.json';
import conditionsData from '../../../data/codex/conditions.json';

interface CodexProps {
    isOpen: boolean;
    onClose: () => void;
    seenItems?: string[];
}

const CATEGORIES = [
    { id: 'skills', label: 'Skills', icon: Info },
    { id: 'races', label: 'Races', icon: Users },
    { id: 'classes', label: 'Classes', icon: Swords },
    { id: 'conditions', label: 'Conditions', icon: Shield },
    { id: 'items', label: 'Items', icon: Map }
];

const Codex: React.FC<CodexProps> = ({ isOpen, onClose, seenItems = [] }) => {
    const [activeCategory, setActiveCategory] = useState('skills');
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    const [races, setRaces] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);

    useEffect(() => {
        const init = async () => {
            await DataManager.initialize();
            setRaces(DataManager.getRaces());
            setClasses(DataManager.getClasses());
        };
        if (isOpen) init();
    }, [isOpen]);

    if (!isOpen) return null;

    const renderCategoryContent = () => {
        switch (activeCategory) {
            case 'skills':
                return (
                    <div className={styles.entriesGrid}>
                        {skillsData.map(skill => (
                            <div
                                key={skill.name}
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
                                className={`${styles.entryCard} ${selectedEntry?.name === cond.name ? styles.active : ''}`}
                                onClick={() => setSelectedEntry(cond)}
                            >
                                <h4>{cond.name}</h4>
                            </div>
                        ))}
                    </div>
                );
            default:
                return <div className={styles.placeholder}>More lore coming soon...</div>;
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sidebar}>
                    <div className={styles.codexHeader}>
                        <Book size={24} />
                        <h2>Codex</h2>
                    </div>
                    <nav className={styles.nav}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                className={`${styles.navItem} ${activeCategory === cat.id ? styles.active : ''}`}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setSelectedEntry(null);
                                }}
                            >
                                <cat.icon size={18} />
                                {cat.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className={styles.main}>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={24} />
                    </button>

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
                                                        {selectedEntry.allFeatures.filter((f: any) => f.level <= 3).map((f: any, i: number) => (
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
        </div>
    );
};

export default Codex;
