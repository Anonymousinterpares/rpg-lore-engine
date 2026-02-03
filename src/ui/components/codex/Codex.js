import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './Codex.module.css';
import { X, Book, Users, Shield, Map, Info, Swords } from 'lucide-react';
import { DataManager } from '../../../ruleset/data/DataManager';
import skillsData from '../../../data/codex/skills.json';
import conditionsData from '../../../data/codex/conditions.json';
const CATEGORIES = [
    { id: 'skills', label: 'Skills', icon: Info },
    { id: 'races', label: 'Races', icon: Users },
    { id: 'classes', label: 'Classes', icon: Swords },
    { id: 'conditions', label: 'Conditions', icon: Shield },
    { id: 'items', label: 'Items', icon: Map }
];
const Codex = ({ isOpen, onClose, seenItems = [] }) => {
    const [activeCategory, setActiveCategory] = useState('skills');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [races, setRaces] = useState([]);
    const [classes, setClasses] = useState([]);
    useEffect(() => {
        const init = async () => {
            await DataManager.initialize();
            setRaces(DataManager.getRaces());
            setClasses(DataManager.getClasses());
        };
        if (isOpen)
            init();
    }, [isOpen]);
    if (!isOpen)
        return null;
    const renderCategoryContent = () => {
        switch (activeCategory) {
            case 'skills':
                return (_jsx("div", { className: styles.entriesGrid, children: skillsData.map(skill => (_jsxs("div", { className: `${styles.entryCard} ${selectedEntry?.name === skill.name ? styles.active : ''}`, onClick: () => setSelectedEntry(skill), children: [_jsx("h4", { children: skill.name }), _jsx("span", { className: styles.entryType, children: skill.ability })] }, skill.name))) }));
            case 'races':
                return (_jsx("div", { className: styles.entriesGrid, children: races.map(race => (_jsxs("div", { className: `${styles.entryCard} ${selectedEntry?.name === race.name ? styles.active : ''}`, onClick: () => setSelectedEntry(race), children: [_jsx("h4", { children: race.name }), _jsx("span", { className: styles.entryType, children: race.size })] }, race.name))) }));
            case 'classes':
                return (_jsx("div", { className: styles.entriesGrid, children: classes.map(cls => (_jsxs("div", { className: `${styles.entryCard} ${selectedEntry?.name === cls.name ? styles.active : ''}`, onClick: () => setSelectedEntry(cls), children: [_jsx("h4", { children: cls.name }), _jsxs("span", { className: styles.entryType, children: ["d", cls.hitDie] })] }, cls.name))) }));
            case 'conditions':
                return (_jsx("div", { className: styles.entriesGrid, children: conditionsData.map(cond => (_jsx("div", { className: `${styles.entryCard} ${selectedEntry?.name === cond.name ? styles.active : ''}`, onClick: () => setSelectedEntry(cond), children: _jsx("h4", { children: cond.name }) }, cond.name))) }));
            default:
                return _jsx("div", { className: styles.placeholder, children: "More lore coming soon..." });
        }
    };
    return (_jsx("div", { className: styles.overlay, onClick: onClose, children: _jsxs("div", { className: styles.modal, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("div", { className: styles.codexHeader, children: [_jsx(Book, { size: 24 }), _jsx("h2", { children: "Codex" })] }), _jsx("nav", { className: styles.nav, children: CATEGORIES.map(cat => (_jsxs("button", { className: `${styles.navItem} ${activeCategory === cat.id ? styles.active : ''}`, onClick: () => {
                                    setActiveCategory(cat.id);
                                    setSelectedEntry(null);
                                }, children: [_jsx(cat.icon, { size: 18 }), cat.label] }, cat.id))) })] }), _jsxs("div", { className: styles.main, children: [_jsx("button", { className: styles.closeBtn, onClick: onClose, children: _jsx(X, { size: 24 }) }), _jsxs("div", { className: styles.content, children: [_jsx("div", { className: styles.listSection, children: renderCategoryContent() }), _jsx("div", { className: styles.detailSection, children: selectedEntry ? (_jsxs("div", { className: styles.entryDetail, children: [_jsx("h3", { children: selectedEntry.name }), _jsx("div", { className: styles.divider }), _jsxs("div", { className: styles.detailBody, children: [activeCategory === 'skills' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Ability:" }), " ", selectedEntry.ability] }), _jsx("p", { children: selectedEntry.description }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Example Uses:" }), _jsx("ul", { children: selectedEntry.examples.map((ex, i) => (_jsx("li", { children: ex }, i))) })] })] })), activeCategory === 'races' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Size:" }), " ", selectedEntry.size, " | ", _jsx("strong", { children: "Speed:" }), " ", selectedEntry.speed, "ft"] }), _jsx("p", { children: selectedEntry.description || "A lineage of adventurers." }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Racial Traits:" }), _jsx("ul", { children: selectedEntry.traits.map((t, i) => (_jsxs("li", { children: [_jsxs("strong", { children: [t.name, ":"] }), " ", t.description] }, i))) })] })] })), activeCategory === 'classes' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Hit Die:" }), " d", selectedEntry.hitDie, " | ", _jsx("strong", { children: "Primary:" }), " ", selectedEntry.primaryAbility.join(', ')] }), _jsx("p", { children: selectedEntry.description || "A path of mastery." }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Key Features:" }), _jsx("ul", { children: selectedEntry.allFeatures.filter((f) => f.level <= 3).map((f, i) => (_jsxs("li", { children: [_jsxs("strong", { children: [f.name, " (Lvl ", f.level, "):"] }), " ", f.description] }, i))) })] })] })), activeCategory === 'conditions' && (_jsxs(_Fragment, { children: [_jsx("p", { style: { fontStyle: 'italic', marginBottom: '1rem', opacity: 0.8 }, children: "Status effects and mechanical restrictions that can affect creatures during gameplay." }), _jsx("p", { children: selectedEntry.description })] }))] })] })) : (_jsxs("div", { className: styles.emptyDetail, children: [_jsx(Book, { size: 48, opacity: 0.2 }), _jsx("p", { children: "Select an entry to view details" })] })) })] })] })] }) }));
};
export default Codex;
