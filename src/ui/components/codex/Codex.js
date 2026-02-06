import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './Codex.module.css';
import { X, Book, Users, Shield, Map, Info, Swords, Skull, Sparkles, Search } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';
import { SpellbookEngine } from '../../../ruleset/combat/SpellbookEngine';
import skillsData from '../../../data/codex/skills.json';
import conditionsData from '../../../data/codex/conditions.json';
import mechanicsData from '../../../data/codex/mechanics.json';
import worldData from '../../../data/codex/world.json';
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
const Codex = ({ isOpen, onClose, initialDeepLink, isPage = false, seenItems = [] }) => {
    const { state, updateState } = useGameState();
    const [activeCategory, setActiveCategory] = useState(initialDeepLink?.category || 'mechanics');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [races, setRaces] = useState([]);
    const [classes, setClasses] = useState([]);
    const [spells, setSpells] = useState([]);
    const parseInlines = (text) => {
        if (!text)
            return text;
        // Split by ** (bold) or * (also bold for this game's theme)
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return _jsx("strong", { children: part.slice(2, -2) }, i);
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return _jsx("strong", { children: part.slice(1, -1) }, i);
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
                let data = [];
                switch (initialDeepLink.category) {
                    case 'world':
                        data = worldData;
                        break;
                    case 'mechanics':
                        data = mechanicsData;
                        break;
                    case 'magic':
                        data = DataManager.getSpells();
                        break;
                    case 'skills':
                        data = skillsData;
                        break;
                    case 'conditions':
                        data = conditionsData;
                        break;
                    case 'races':
                        data = DataManager.getRaces();
                        break;
                    case 'classes':
                        data = DataManager.getClasses();
                        break;
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
            }
            else if (!selectedEntry) {
                setSelectedEntry(null);
            }
        };
        if (isOpen || isPage)
            init();
    }, [isOpen, initialDeepLink, isPage]);
    // Internal scroll effect when entry is selected
    useEffect(() => {
        if (selectedEntry) {
            const id = selectedEntry.id || selectedEntry.name;
            const el = document.getElementById(`entry-${id}`);
            if (el)
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Mark as seen if it's a spell
            if (activeCategory === 'magic' && state?.character?.unseenSpells?.includes(selectedEntry.name)) {
                state.character.unseenSpells = state.character.unseenSpells.filter(s => s !== selectedEntry.name);
                updateState();
            }
        }
    }, [selectedEntry]);
    if (!isPage && !isOpen)
        return null;
    const renderCategoryContent = () => {
        switch (activeCategory) {
            case 'world':
                return (_jsx("div", { className: styles.entriesGrid, children: worldData.map((item) => (_jsx("div", { id: `entry-${item.id}`, className: `${styles.entryCard} ${selectedEntry?.id === item.id ? styles.active : ''}`, onClick: () => setSelectedEntry(item), children: _jsx("h4", { children: item.name }) }, item.id))) }));
            case 'mechanics':
                return (_jsx("div", { className: styles.entriesGrid, children: mechanicsData.map(item => (_jsx("div", { id: `entry-${item.id}`, className: `${styles.entryCard} ${selectedEntry?.id === item.id ? styles.active : ''}`, onClick: () => setSelectedEntry(item), children: _jsx("h4", { children: item.name }) }, item.id))) }));
            case 'skills':
                return (_jsx("div", { className: styles.entriesGrid, children: skillsData.map(skill => (_jsxs("div", { id: `entry-${skill.name}`, className: `${styles.entryCard} ${selectedEntry?.name === skill.name ? styles.active : ''}`, onClick: () => setSelectedEntry(skill), children: [_jsx("h4", { children: skill.name }), _jsx("span", { className: styles.entryType, children: skill.ability })] }, skill.name))) }));
            case 'races':
                return (_jsx("div", { className: styles.entriesGrid, children: races.map(race => (_jsxs("div", { id: `entry-${race.name}`, className: `${styles.entryCard} ${selectedEntry?.name === race.name ? styles.active : ''}`, onClick: () => setSelectedEntry(race), children: [_jsx("h4", { children: race.name }), _jsx("span", { className: styles.entryType, children: race.size })] }, race.name))) }));
            case 'classes':
                return (_jsx("div", { className: styles.entriesGrid, children: classes.map(cls => (_jsxs("div", { id: `entry-${cls.name}`, className: `${styles.entryCard} ${selectedEntry?.name === cls.name ? styles.active : ''}`, onClick: () => setSelectedEntry(cls), children: [_jsx("h4", { children: cls.name }), _jsxs("span", { className: styles.entryType, children: ["d", cls.hitDie] })] }, cls.name))) }));
            case 'conditions':
                return (_jsx("div", { className: styles.entriesGrid, children: conditionsData.map(cond => (_jsx("div", { id: `entry-${cond.name}`, className: `${styles.entryCard} ${selectedEntry?.name === cond.name ? styles.active : ''}`, onClick: () => setSelectedEntry(cond), children: _jsx("h4", { children: cond.name }) }, cond.name))) }));
            case 'items':
            case 'bestiary':
                const dynamicEntries = state?.codexEntries?.filter(e => e.category === activeCategory) || [];
                if (dynamicEntries.length === 0) {
                    return (_jsx("div", { className: styles.placeholder, children: activeCategory === 'items' ? 'Collect items to unlock their lore...' : 'Encounter creatures to record their history...' }));
                }
                return (_jsx("div", { className: styles.entriesGrid, children: dynamicEntries.map(entry => (_jsx("div", { id: `entry-${entry.id}`, className: `${styles.entryCard} ${selectedEntry?.id === entry.id ? styles.active : ''}`, onClick: () => {
                            setSelectedEntry(entry);
                            if (entry.isNew) {
                                entry.isNew = false;
                                updateState();
                            }
                        }, children: _jsxs("div", { className: styles.entryHeader, children: [_jsx("h4", { children: entry.title }), entry.isNew && _jsx("span", { className: styles.newLabel, children: "NEW" })] }) }, entry.id))) }));
            case 'magic':
                const filteredSpells = spells.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
                return (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.searchBar, children: [_jsx(Search, { size: 16 }), _jsx("input", { type: "text", placeholder: "Search spells & abilities...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), _jsx("div", { className: styles.entriesGrid, children: filteredSpells.map(spell => {
                                const isNew = state?.character?.unseenSpells?.includes(spell.name);
                                return (_jsxs("div", { id: `entry-${spell.name}`, className: `${styles.entryCard} ${selectedEntry?.name === spell.name ? styles.active : ''}`, onClick: () => setSelectedEntry(spell), children: [_jsxs("div", { className: styles.entryHeader, children: [_jsx("h4", { children: spell.name }), isNew && _jsx("span", { className: styles.newLabel, children: "NEW" })] }), _jsxs("span", { className: styles.entryType, children: ["Lvl ", spell.level === 0 ? 'Cantrip' : spell.level, " \u2022 ", spell.school] })] }, spell.name));
                            }) })] }));
            default:
                return _jsx("div", { className: styles.placeholder, children: "More lore coming soon..." });
        }
    };
    const modalContent = (_jsxs("div", { className: `${styles.modal} ${isPage ? styles.isPage : ''}`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("div", { className: styles.codexHeader, children: [_jsx(Book, { size: 24 }), _jsx("h2", { children: "Codex" })] }), _jsx("nav", { className: styles.nav, children: CATEGORIES.map(cat => {
                            const hasNew = cat.id === 'magic' && (state?.character?.unseenSpells?.length ?? 0) > 0;
                            return (_jsxs("button", { className: `${styles.navItem} ${activeCategory === cat.id ? styles.active : ''}`, onClick: () => {
                                    setActiveCategory(cat.id);
                                    setSelectedEntry(null);
                                }, children: [_jsxs("div", { className: styles.navLabel, children: [_jsx(cat.icon, { size: 18 }), cat.label] }), hasNew && _jsx("div", { className: styles.indicatorDot })] }, cat.id));
                        }) })] }), _jsxs("div", { className: styles.main, children: [!isPage && (_jsx("button", { className: styles.closeBtn, onClick: onClose, children: _jsx(X, { size: 24 }) })), _jsxs("div", { className: styles.content, children: [_jsx("div", { className: styles.listSection, children: renderCategoryContent() }), _jsx("div", { className: styles.detailSection, children: selectedEntry ? (_jsxs("div", { className: styles.entryDetail, children: [_jsx("h3", { children: selectedEntry.name }), _jsx("div", { className: styles.divider }), _jsxs("div", { className: styles.detailBody, children: [(activeCategory === 'mechanics' || activeCategory === 'world') && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.markdownContent, children: selectedEntry.description.split('\n').map((line, i) => {
                                                                if (line.startsWith('###'))
                                                                    return _jsx("h4", { className: styles.mdH3, children: parseInlines(line.replace('###', '').trim()) }, i);
                                                                if (line.startsWith('-'))
                                                                    return _jsx("li", { className: styles.mdLi, children: parseInlines(line.replace('-', '').trim()) }, i);
                                                                return _jsx("p", { children: parseInlines(line) }, i);
                                                            }) }), selectedEntry.examples && (_jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Details:" }), _jsx("ul", { children: selectedEntry.examples.map((ex, i) => (_jsx("li", { children: parseInlines(ex) }, i))) })] }))] })), activeCategory === 'skills' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Ability:" }), " ", selectedEntry.ability] }), _jsx("p", { children: selectedEntry.description }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Example Uses:" }), _jsx("ul", { children: selectedEntry.examples.map((ex, i) => (_jsx("li", { children: ex }, i))) })] })] })), activeCategory === 'races' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Size:" }), " ", selectedEntry.size, " | ", _jsx("strong", { children: "Speed:" }), " ", selectedEntry.speed, "ft"] }), _jsx("p", { children: selectedEntry.description || "A lineage of adventurers." }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Racial Traits:" }), _jsx("ul", { children: selectedEntry.traits.map((t, i) => (_jsxs("li", { children: [_jsxs("strong", { children: [t.name, ":"] }), " ", t.description] }, i))) })] })] })), activeCategory === 'classes' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Hit Die:" }), " d", selectedEntry.hitDie, " | ", _jsx("strong", { children: "Primary:" }), " ", selectedEntry.primaryAbility.join(', ')] }), _jsx("p", { children: selectedEntry.description || "A path of mastery." }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Key Features:" }), _jsx("ul", { children: selectedEntry.allFeatures?.filter((f) => f.level <= 3).map((f, i) => (_jsxs("li", { children: [_jsxs("strong", { children: [f.name, " (Lvl ", f.level, "):"] }), " ", f.description] }, i))) })] })] })), activeCategory === 'conditions' && (_jsxs(_Fragment, { children: [_jsx("p", { style: { fontStyle: 'italic', marginBottom: '1rem', opacity: 0.8 }, children: "Status effects and mechanical restrictions that can affect creatures during gameplay." }), _jsx("p", { children: selectedEntry.description })] })), activeCategory === 'magic' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Level:" }), " ", selectedEntry.level === 0 ? 'Cantrip' : selectedEntry.level, " |", _jsx("strong", { children: " School:" }), " ", selectedEntry.school, " |", _jsx("strong", { children: " Range:" }), " ", selectedEntry.range] }), _jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Casting Time:" }), " ", selectedEntry.time, " |", _jsx("strong", { children: " Duration:" }), " ", selectedEntry.duration] }), _jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Components:" }), " ", Object.entries(selectedEntry.components || {}).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', '), selectedEntry.concentration ? ' (Concentration)' : ''] }), _jsx("p", { className: styles.spellDescription, children: selectedEntry.description })] })), (activeCategory === 'bestiary' || activeCategory === 'items') && (_jsx("div", { className: styles.markdownContent, children: selectedEntry.content.split('\n').map((line, i) => {
                                                        if (line.startsWith('###'))
                                                            return _jsx("h4", { className: styles.mdH3, children: parseInlines(line.replace('###', '').trim()) }, i);
                                                        if (line.startsWith('-'))
                                                            return _jsx("li", { className: styles.mdLi, children: parseInlines(line.replace('-', '').trim()) }, i);
                                                        return _jsx("p", { children: parseInlines(line) }, i);
                                                    }) }))] })] })) : (_jsxs("div", { className: styles.emptyDetail, children: [_jsx(Book, { size: 48, opacity: 0.2 }), _jsx("p", { children: "Select an entry to view details" })] })) })] })] })] }));
    if (isPage)
        return modalContent;
    return (_jsx("div", { className: styles.overlay, onClick: onClose, children: modalContent }));
};
export default Codex;
