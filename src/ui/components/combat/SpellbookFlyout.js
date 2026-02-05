import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import styles from './SpellbookFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Sparkles, Info } from 'lucide-react';
import { useBook } from '../../context/BookContext';
import Codex from '../codex/Codex';
const SpellIcon = ({ spellName }) => {
    const [failed, setFailed] = React.useState(false);
    const name = spellName.toLowerCase().replace(/ /g, '_');
    const path = `/assets/spells/${name}.png`;
    if (failed)
        return _jsx("div", { className: styles.iconPlaceholder, children: _jsx(Sparkles, { size: 16 }) });
    return (_jsx("div", { className: styles.spellIconContainer, children: _jsx("img", { src: path, alt: "", className: styles.spellIcon, onError: () => setFailed(true) }) }));
};
export const SpellbookFlyout = ({ spells, spellSlots = {}, onCast, onClose }) => {
    const { pushPage } = useBook();
    const [selectedLevel, setSelectedLevel] = useState('all');
    const filteredSpells = selectedLevel === 'all'
        ? spells
        : spells.filter(s => s.level === selectedLevel);
    const levels = Array.from(new Set(spells.map(s => s.level))).sort((a, b) => a - b);
    return (_jsxs("div", { className: `${styles.flyout} ${parchmentStyles.container}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.title, children: [_jsx(Sparkles, { size: 18, className: styles.titleIcon }), _jsx("h3", { children: "Spellbook" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.tabs, children: [_jsx("button", { className: `${styles.tab} ${selectedLevel === 'all' ? styles.activeTab : ''}`, onClick: () => setSelectedLevel('all'), children: "All" }), levels.map(lv => (_jsxs("button", { className: `${styles.tab} ${selectedLevel === lv ? styles.activeTab : ''}`, onClick: () => setSelectedLevel(lv), children: [lv === 0 ? 'Cantrips' : `Lvl ${lv}`, lv > 0 && spellSlots[lv] && (_jsxs("span", { className: styles.slotInfo, children: ["(", spellSlots[lv].current, "/", spellSlots[lv].max, ")"] }))] }, lv)))] }), _jsxs("div", { className: styles.spellGrid, children: [filteredSpells.map(spell => {
                        const canCast = spell.level === 0 || (spellSlots[spell.level]?.current || 0) > 0;
                        return (_jsx("button", { className: `${styles.spellItem} ${parchmentStyles.button}`, onClick: () => canCast && onCast(spell), disabled: !canCast, title: spell.description, children: _jsxs("div", { className: styles.spellMain, children: [_jsx(SpellIcon, { spellName: spell.name }), _jsxs("div", { className: styles.spellContent, children: [_jsxs("div", { className: styles.spellHeader, children: [_jsx("span", { className: styles.spellName, children: spell.name }), _jsx("button", { className: styles.infoBtn, onClick: (e) => {
                                                            e.stopPropagation();
                                                            pushPage({
                                                                id: 'codex',
                                                                label: 'Codex',
                                                                content: _jsx(Codex, { isOpen: true, onClose: () => { }, initialDeepLink: { category: 'magic', entryId: spell.name }, isPage: true })
                                                            });
                                                        }, title: "View in Codex", children: _jsx(Info, { size: 14 }) }), _jsx("span", { className: styles.spellSchool, children: spell.school })] }), _jsxs("div", { className: styles.spellMeta, children: [_jsx("span", { children: spell.time }), _jsx("span", { children: spell.range })] })] })] }) }, spell.name));
                    }), filteredSpells.length === 0 && (_jsx("div", { className: styles.emptyState, children: "No spells available in this category." }))] })] }));
};
export default SpellbookFlyout;
