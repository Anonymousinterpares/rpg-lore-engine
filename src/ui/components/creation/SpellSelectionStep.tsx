import React, { useState, useEffect } from 'react';
import styles from './SpellSelectionStep.module.css';
import { DataManager } from '../../../ruleset/data/DataManager';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import { Search, Info } from 'lucide-react';

interface SpellSelectionStepProps {
    characterClass: string;
    selectedCantrips: string[];
    selectedSpells: string[];
    onToggleCantrip: (spellName: string) => void;
    onToggleSpell: (spellName: string) => void;
}

const CLASS_SPELL_LIMITS: Record<string, { cantrips: number; spells: number }> = {
    'Wizard': { cantrips: 3, spells: 6 },
    'Sorcerer': { cantrips: 4, spells: 2 },
    'Warlock': { cantrips: 2, spells: 2 },
    'Bard': { cantrips: 2, spells: 4 },
    'Cleric': { cantrips: 3, spells: 0 },
    'Druid': { cantrips: 2, spells: 0 },
    'Paladin': { cantrips: 0, spells: 0 },
    'Ranger': { cantrips: 0, spells: 0 }
};

const SpellSelectionStep: React.FC<SpellSelectionStepProps> = ({
    characterClass,
    selectedCantrips,
    selectedSpells,
    onToggleCantrip,
    onToggleSpell
}) => {
    const [availableCantrips, setAvailableCantrips] = useState<Spell[]>([]);
    const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);
    const [hoveredSpell, setHoveredSpell] = useState<Spell | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const load = async () => {
            await DataManager.loadSpells();
            const classSpells = DataManager.getSpellsByClass(characterClass, 1);
            setAvailableCantrips(classSpells.filter(s => s.level === 0));
            setAvailableSpells(classSpells.filter(s => s.level === 1));
        };
        load();
    }, [characterClass]);

    const limits = CLASS_SPELL_LIMITS[characterClass] || { cantrips: 0, spells: 0 };

    const filteredCantrips = availableCantrips.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredSpells = availableSpells.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isCantripLimitReached = selectedCantrips.length >= limits.cantrips;
    const isSpellLimitReached = selectedSpells.length >= limits.spells;

    return (
        <div className={styles.selectionStep}>
            <div className={styles.stepHeader}>
                <h3>Choose Starting Magic: {characterClass}</h3>
                <div className={styles.counterGroup}>
                    <div className={`${styles.counter} ${selectedCantrips.length === limits.cantrips ? styles.complete : ''}`}>
                        Cantrips: {selectedCantrips.length} / {limits.cantrips}
                    </div>
                    {limits.spells > 0 && (
                        <div className={`${styles.counter} ${selectedSpells.length === limits.spells ? styles.complete : ''}`}>
                            1st-Level Spells: {selectedSpells.length} / {limits.spells}
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.spellLayout}>
                <div className={styles.scrollArea}>
                    <div className={styles.section}>
                        <h4>Cantrips</h4>
                        <div className={styles.spellGrid}>
                            {filteredCantrips.map(spell => (
                                <div
                                    key={spell.name}
                                    className={`${styles.spellCard} ${selectedCantrips.includes(spell.name) ? styles.selected : ''} ${!selectedCantrips.includes(spell.name) && isCantripLimitReached ? styles.disabled : ''}`}
                                    onClick={() => onToggleCantrip(spell.name)}
                                    onMouseEnter={() => setHoveredSpell(spell)}
                                >
                                    <div className={styles.spellMeta}>
                                        <span className={styles.spellName}>{spell.name}</span>
                                        <span className={styles.spellInfo}>{spell.school}</span>
                                    </div>
                                    <img
                                        src={`/assets/spells/${spell.name.toLowerCase().replace(/ /g, '_')}.png`}
                                        alt=""
                                        className={styles.spellIcon}
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {limits.spells > 0 && (
                        <div className={styles.section}>
                            <h4>1st-Level Spells</h4>
                            <div className={styles.spellGrid}>
                                {filteredSpells.map(spell => (
                                    <div
                                        key={spell.name}
                                        className={`${styles.spellCard} ${selectedSpells.includes(spell.name) ? styles.selected : ''} ${!selectedSpells.includes(spell.name) && isSpellLimitReached ? styles.disabled : ''}`}
                                        onClick={() => onToggleSpell(spell.name)}
                                        onMouseEnter={() => setHoveredSpell(spell)}
                                    >
                                        <div className={styles.spellMeta}>
                                            <span className={styles.spellName}>{spell.name}</span>
                                            <span className={styles.spellInfo}>{spell.school}</span>
                                        </div>
                                        <img
                                            src={`/assets/spells/${spell.name.toLowerCase().replace(/ /g, '_')}.png`}
                                            alt=""
                                            className={styles.spellIcon}
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.detailsPanel}>
                    {hoveredSpell ? (
                        <>
                            <div className={styles.detailTitle}>
                                <h4>{hoveredSpell.name}</h4>
                                <img
                                    src={`/assets/spells/${hoveredSpell.name.toLowerCase().replace(/ /g, '_')}.png`}
                                    alt=""
                                    className={styles.detailIcon}
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Level / School</span>
                                <span className={styles.detailValue}>{hoveredSpell.level === 0 ? 'Cantrip' : `${hoveredSpell.level} Level`} {hoveredSpell.school}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Casting Time</span>
                                <span className={styles.detailValue}>{hoveredSpell.time}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Range</span>
                                <span className={styles.detailValue}>{hoveredSpell.range}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Components</span>
                                <span className={styles.detailValue}>
                                    {[
                                        hoveredSpell.components.v && 'V',
                                        hoveredSpell.components.s && 'S',
                                        hoveredSpell.components.m && `M (${hoveredSpell.components.m})`
                                    ].filter(Boolean).join(', ')}
                                </span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Duration</span>
                                <span className={styles.detailValue}>{hoveredSpell.duration}</span>
                            </div>
                            <div className={styles.detailDesc}>
                                {hoveredSpell.description}
                            </div>
                            <div className={styles.largeIllustration}>
                                <img
                                    src={`/assets/spells/${hoveredSpell.name.toLowerCase().replace(/ /g, '_')}.png`}
                                    alt=""
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            </div>
                        </>
                    ) : (
                        <div className={styles.nothingSelected}>
                            Hover over a spell to see its details and properties.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpellSelectionStep;
