import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './Codex.module.css';
import { X, Book, Users, Shield, Map, Info, Swords, Skull } from 'lucide-react';
import { DataManager } from '../../../ruleset/data/DataManager';
import skillsData from '../../../data/codex/skills.json';
import conditionsData from '../../../data/codex/conditions.json';
import mechanicsData from '../../../data/codex/mechanics.json';
import worldData from '../../../data/codex/world.json';
const CATEGORIES = [
    { id: 'world', label: 'World', icon: Map },
    { id: 'mechanics', label: 'Mechanics', icon: Shield },
    { id: 'skills', label: 'Skills', icon: Info },
    { id: 'races', label: 'Races', icon: Users },
    { id: 'classes', label: 'Classes', icon: Swords },
    { id: 'bestiary', label: 'Bestiary', icon: Skull },
    { id: 'conditions', label: 'Conditions', icon: Book },
    { id: 'items', label: 'Items', icon: Map }
];
const Codex = ({ isOpen, onClose, initialDeepLink, isPage = false, seenItems = [] }) => {
    const [activeCategory, setActiveCategory] = useState(initialDeepLink?.category || 'mechanics');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [races, setRaces] = useState([]);
    const [classes, setClasses] = useState([]);
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
                        data = [];
                        break;
                }
                const entry = data.find(e => (e.id === initialDeepLink.entryId || e.name === initialDeepLink.entryId));
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
                return (_jsx("div", { className: styles.entriesGrid, children: DataManager.getRaces().length > 0 && _jsx("p", { className: styles.placeholder, children: "Items lore coming soon..." }) }));
            case 'bestiary':
                return (_jsx("div", { className: styles.entriesGrid, children: _jsx("p", { className: styles.placeholder, children: "Monster knowledge being transcribed..." }) }));
            default:
                return _jsx("div", { className: styles.placeholder, children: "More lore coming soon..." });
        }
    };
    const modalContent = (_jsxs("div", { className: `${styles.modal} ${isPage ? styles.isPage : ''}`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("div", { className: styles.codexHeader, children: [_jsx(Book, { size: 24 }), _jsx("h2", { children: "Codex" })] }), _jsx("nav", { className: styles.nav, children: CATEGORIES.map(cat => (_jsxs("button", { className: `${styles.navItem} ${activeCategory === cat.id ? styles.active : ''}`, onClick: () => {
                                setActiveCategory(cat.id);
                                setSelectedEntry(null);
                            }, children: [_jsx(cat.icon, { size: 18 }), cat.label] }, cat.id))) })] }), _jsxs("div", { className: styles.main, children: [!isPage && (_jsx("button", { className: styles.closeBtn, onClick: onClose, children: _jsx(X, { size: 24 }) })), _jsxs("div", { className: styles.content, children: [_jsx("div", { className: styles.listSection, children: renderCategoryContent() }), _jsx("div", { className: styles.detailSection, children: selectedEntry ? (_jsxs("div", { className: styles.entryDetail, children: [_jsx("h3", { children: selectedEntry.name }), _jsx("div", { className: styles.divider }), _jsxs("div", { className: styles.detailBody, children: [(activeCategory === 'mechanics' || activeCategory === 'world') && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.markdownContent, children: selectedEntry.description.split('\n').map((line, i) => {
                                                                if (line.startsWith('###'))
                                                                    return _jsx("h4", { className: styles.mdH3, children: parseInlines(line.replace('###', '').trim()) }, i);
                                                                if (line.startsWith('-'))
                                                                    return _jsx("li", { className: styles.mdLi, children: parseInlines(line.replace('-', '').trim()) }, i);
                                                                return _jsx("p", { children: parseInlines(line) }, i);
                                                            }) }), selectedEntry.examples && (_jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Details:" }), _jsx("ul", { children: selectedEntry.examples.map((ex, i) => (_jsx("li", { children: parseInlines(ex) }, i))) })] }))] })), activeCategory === 'skills' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Ability:" }), " ", selectedEntry.ability] }), _jsx("p", { children: selectedEntry.description }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Example Uses:" }), _jsx("ul", { children: selectedEntry.examples.map((ex, i) => (_jsx("li", { children: ex }, i))) })] })] })), activeCategory === 'races' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Size:" }), " ", selectedEntry.size, " | ", _jsx("strong", { children: "Speed:" }), " ", selectedEntry.speed, "ft"] }), _jsx("p", { children: selectedEntry.description || "A lineage of adventurers." }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Racial Traits:" }), _jsx("ul", { children: selectedEntry.traits.map((t, i) => (_jsxs("li", { children: [_jsxs("strong", { children: [t.name, ":"] }), " ", t.description] }, i))) })] })] })), activeCategory === 'classes' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Hit Die:" }), " d", selectedEntry.hitDie, " | ", _jsx("strong", { children: "Primary:" }), " ", selectedEntry.primaryAbility.join(', ')] }), _jsx("p", { children: selectedEntry.description || "A path of mastery." }), _jsxs("div", { className: styles.examples, children: [_jsx("h4", { children: "Key Features:" }), _jsx("ul", { children: selectedEntry.allFeatures?.filter((f) => f.level <= 3).map((f, i) => (_jsxs("li", { children: [_jsxs("strong", { children: [f.name, " (Lvl ", f.level, "):"] }), " ", f.description] }, i))) })] })] })), activeCategory === 'conditions' && (_jsxs(_Fragment, { children: [_jsx("p", { style: { fontStyle: 'italic', marginBottom: '1rem', opacity: 0.8 }, children: "Status effects and mechanical restrictions that can affect creatures during gameplay." }), _jsx("p", { children: selectedEntry.description })] }))] })] })) : (_jsxs("div", { className: styles.emptyDetail, children: [_jsx(Book, { size: 48, opacity: 0.2 }), _jsx("p", { children: "Select an entry to view details" })] })) })] })] })] }));
    if (isPage)
        return modalContent;
    return (_jsx("div", { className: styles.overlay, onClick: onClose, children: modalContent }));
};
export default Codex;
