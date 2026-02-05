import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './SpellPreparationPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';
import { SpellbookEngine } from '../../../ruleset/combat/SpellbookEngine';
import { Sparkles, Book as BookIcon, Plus, Minus, Search, X } from 'lucide-react';
const SpellIcon = ({ spellName }) => {
    const [iconPath, setIconPath] = useState(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (failed)
            return;
        const name = spellName.toLowerCase().replace(/ /g, '_');
        // Standard asset path
        const tryPath = `/assets/spells/spell_${name}.png`;
        setIconPath(tryPath);
    }, [spellName, failed]);
    if (failed || !iconPath)
        return null;
    return (_jsx("div", { className: styles.spellIconContainer, children: _jsx("img", { src: iconPath, alt: "", className: styles.spellIcon, onError: () => setFailed(true) }) }));
};
const SpellPreparationPanel = () => {
    const { state, updateState } = useGameState();
    const [availableSpells, setAvailableSpells] = useState([]);
    const [filterLevel, setFilterLevel] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await DataManager.loadSpells();
            if (state?.character) {
                const pc = state.character;
                let spells = [];
                // Logic based on class
                if (pc.class === 'Wizard') {
                    // Wizards can only prepare from their spellbook
                    for (const name of pc.spellbook) {
                        const spell = DataManager.getSpell(name);
                        if (spell)
                            spells.push(spell);
                    }
                }
                else if (pc.class === 'Cleric' || pc.class === 'Druid') {
                    // These classes have access to their entire list (filtered by class metadata)
                    spells = DataManager.getSpells().filter(s => s.classes?.includes(pc.class));
                }
                else {
                    // For Sorcerers, Bards, etc., use knownSpells
                    for (const name of pc.knownSpells) {
                        const spell = DataManager.getSpell(name);
                        if (spell)
                            spells.push(spell);
                    }
                }
                setAvailableSpells(spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
            }
            setLoading(false);
        };
        load();
    }, [state?.character?.class, state?.character?.spellbook, state?.character?.knownSpells]);
    if (!state?.character)
        return null;
    const pc = state.character;
    const maxPrepared = SpellbookEngine.getMaxPreparedCount(pc);
    const preparedCount = pc.preparedSpells.length;
    const isPrepared = (name) => pc.preparedSpells.includes(name);
    const handleToggleSpell = (spell) => {
        const currentPrepared = [...pc.preparedSpells];
        const index = currentPrepared.indexOf(spell.name);
        if (index !== -1) {
            // Unprepare
            currentPrepared.splice(index, 1);
        }
        else {
            // Prepare
            if (preparedCount >= maxPrepared)
                return;
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
    if (loading)
        return _jsx("div", { className: styles.loading, children: "Opening Spellbook..." });
    return (_jsxs("div", { className: styles.container, children: [_jsxs("header", { className: styles.header, children: [_jsxs("div", { className: styles.titleInfo, children: [_jsx(Sparkles, { className: styles.headerIcon }), _jsx("h2", { className: parchmentStyles.heading, children: "Spell Selection" })] }), _jsxs("div", { className: `${styles.counter} ${preparedCount >= maxPrepared ? styles.atLimit : ''}`, children: ["Prepared: ", preparedCount, " / ", maxPrepared] })] }), _jsxs("div", { className: styles.mainLayout, children: [_jsxs("div", { className: styles.toolbar, children: [_jsxs("div", { className: styles.searchBox, children: [_jsx(Search, { size: 16 }), _jsx("input", { type: "text", placeholder: "Find spell...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), _jsx("div", { className: styles.levelTabs, children: ['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (_jsx("button", { className: `${styles.levelTab} ${filterLevel === lvl ? styles.activeTab : ''}`, onClick: () => setFilterLevel(lvl), children: lvl === 'all' ? 'All' : lvl }, lvl))) })] }), _jsxs("div", { className: styles.panes, children: [_jsxs("div", { className: `${parchmentStyles.panel} ${styles.sourcePane}`, children: [_jsx("h3", { className: styles.paneTitle, children: "Available Spells" }), _jsx("div", { className: styles.spellList, children: filteredSpells.length === 0 ? (_jsx("p", { className: styles.empty, children: "No spells found." })) : (filteredSpells.map(spell => (_jsxs("div", { className: `${styles.spellItem} ${isPrepared(spell.name) ? styles.isPrepared : ''}`, children: [_jsxs("div", { className: styles.spellInfoRow, children: [_jsx(SpellIcon, { spellName: spell.name }), _jsxs("div", { className: styles.spellInfo, children: [_jsx("span", { className: styles.spellName, children: spell.name }), _jsxs("span", { className: styles.spellMeta, children: ["Lvl ", spell.level, " \u2022 ", spell.school] })] })] }), _jsx("button", { className: `${styles.actionBtn} ${isPrepared(spell.name) ? styles.btnRemove : styles.btnAdd}`, onClick: () => handleToggleSpell(spell), disabled: !isPrepared(spell.name) && preparedCount >= maxPrepared, children: isPrepared(spell.name) ? _jsx(Minus, { size: 16 }) : _jsx(Plus, { size: 16 }) })] }, spell.name)))) })] }), _jsxs("div", { className: `${parchmentStyles.panel} ${styles.preparedPane}`, children: [_jsx("h3", { className: styles.paneTitle, children: "Current Preparation" }), _jsx("div", { className: styles.spellList, children: pc.preparedSpells.length === 0 ? (_jsxs("div", { className: styles.emptyState, children: [_jsx(BookIcon, { size: 32, opacity: 0.3 }), _jsx("p", { children: "No spells prepared for the day." })] })) : (pc.preparedSpells.map(name => {
                                            const spell = DataManager.getSpell(name);
                                            return (_jsxs("div", { className: styles.preparedItem, children: [_jsxs("div", { className: styles.preparedInfoRow, children: [_jsx(SpellIcon, { spellName: name }), _jsx("span", { className: styles.preparedName, children: name })] }), _jsx("button", { className: styles.unprepareBtn, onClick: () => spell && handleToggleSpell(spell), children: _jsx(X, { size: 14 }) })] }, name));
                                        })) })] })] })] })] }));
};
export default SpellPreparationPanel;
