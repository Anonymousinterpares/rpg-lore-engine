import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './SpellSelectionStep.module.css';
import { DataManager } from '../../../ruleset/data/DataManager';
const CLASS_SPELL_LIMITS = {
    'Wizard': { cantrips: 3, spells: 6 },
    'Sorcerer': { cantrips: 4, spells: 2 },
    'Warlock': { cantrips: 2, spells: 2 },
    'Bard': { cantrips: 2, spells: 4 },
    'Cleric': { cantrips: 3, spells: 0 },
    'Druid': { cantrips: 2, spells: 0 },
    'Paladin': { cantrips: 0, spells: 0 },
    'Ranger': { cantrips: 0, spells: 0 }
};
const SpellSelectionStep = ({ characterClass, selectedCantrips, selectedSpells, onToggleCantrip, onToggleSpell }) => {
    const [availableCantrips, setAvailableCantrips] = useState([]);
    const [availableSpells, setAvailableSpells] = useState([]);
    const [hoveredSpell, setHoveredSpell] = useState(null);
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
    const filteredCantrips = availableCantrips.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredSpells = availableSpells.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const isCantripLimitReached = selectedCantrips.length >= limits.cantrips;
    const isSpellLimitReached = selectedSpells.length >= limits.spells;
    return (_jsxs("div", { className: styles.selectionStep, children: [_jsxs("div", { className: styles.stepHeader, children: [_jsxs("h3", { children: ["Choose Starting Magic: ", characterClass] }), _jsxs("div", { className: styles.counterGroup, children: [_jsxs("div", { className: `${styles.counter} ${selectedCantrips.length === limits.cantrips ? styles.complete : ''}`, children: ["Cantrips: ", selectedCantrips.length, " / ", limits.cantrips] }), limits.spells > 0 && (_jsxs("div", { className: `${styles.counter} ${selectedSpells.length === limits.spells ? styles.complete : ''}`, children: ["1st-Level Spells: ", selectedSpells.length, " / ", limits.spells] }))] })] }), _jsxs("div", { className: styles.spellLayout, children: [_jsxs("div", { className: styles.scrollArea, children: [_jsxs("div", { className: styles.section, children: [_jsx("h4", { children: "Cantrips" }), _jsx("div", { className: styles.spellGrid, children: filteredCantrips.map(spell => (_jsxs("div", { className: `${styles.spellCard} ${selectedCantrips.includes(spell.name) ? styles.selected : ''} ${!selectedCantrips.includes(spell.name) && isCantripLimitReached ? styles.disabled : ''}`, onClick: () => onToggleCantrip(spell.name), onMouseEnter: () => setHoveredSpell(spell), children: [_jsx("span", { className: styles.spellName, children: spell.name }), _jsx("span", { className: styles.spellInfo, children: spell.school })] }, spell.name))) })] }), limits.spells > 0 && (_jsxs("div", { className: styles.section, children: [_jsx("h4", { children: "1st-Level Spells" }), _jsx("div", { className: styles.spellGrid, children: filteredSpells.map(spell => (_jsxs("div", { className: `${styles.spellCard} ${selectedSpells.includes(spell.name) ? styles.selected : ''} ${!selectedSpells.includes(spell.name) && isSpellLimitReached ? styles.disabled : ''}`, onClick: () => onToggleSpell(spell.name), onMouseEnter: () => setHoveredSpell(spell), children: [_jsx("span", { className: styles.spellName, children: spell.name }), _jsx("span", { className: styles.spellInfo, children: spell.school })] }, spell.name))) })] }))] }), _jsx("div", { className: styles.detailsPanel, children: hoveredSpell ? (_jsxs(_Fragment, { children: [_jsx("h4", { children: hoveredSpell.name }), _jsxs("div", { className: styles.detailRow, children: [_jsx("span", { className: styles.detailLabel, children: "Level / School" }), _jsxs("span", { className: styles.detailValue, children: [hoveredSpell.level === 0 ? 'Cantrip' : `${hoveredSpell.level} Level`, " ", hoveredSpell.school] })] }), _jsxs("div", { className: styles.detailRow, children: [_jsx("span", { className: styles.detailLabel, children: "Casting Time" }), _jsx("span", { className: styles.detailValue, children: hoveredSpell.time })] }), _jsxs("div", { className: styles.detailRow, children: [_jsx("span", { className: styles.detailLabel, children: "Range" }), _jsx("span", { className: styles.detailValue, children: hoveredSpell.range })] }), _jsxs("div", { className: styles.detailRow, children: [_jsx("span", { className: styles.detailLabel, children: "Components" }), _jsx("span", { className: styles.detailValue, children: [
                                                hoveredSpell.components.v && 'V',
                                                hoveredSpell.components.s && 'S',
                                                hoveredSpell.components.m && `M (${hoveredSpell.components.m})`
                                            ].filter(Boolean).join(', ') })] }), _jsxs("div", { className: styles.detailRow, children: [_jsx("span", { className: styles.detailLabel, children: "Duration" }), _jsx("span", { className: styles.detailValue, children: hoveredSpell.duration })] }), _jsx("div", { className: styles.detailDesc, children: hoveredSpell.description })] })) : (_jsx("div", { className: styles.nothingSelected, children: "Hover over a spell to see its details and properties." })) })] })] }));
};
export default SpellSelectionStep;
