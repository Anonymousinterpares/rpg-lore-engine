import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './CharacterPanel.module.css';
import HealthBar from './HealthBar';
import ConditionDisplay from './ConditionDisplay';
import SpellSlotTracker from './SpellSlotTracker';
import { Shield, Zap } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
const CharacterPanel = ({ onCharacter }) => {
    const { state } = useGameState();
    if (!state || !state.character) {
        return _jsx("div", { className: styles.loading, children: "No character active" });
    }
    const char = state.character;
    // Helper to format initiative
    const dex = char.stats.DEX ?? 10;
    const initiative = Math.floor((dex - 10) / 2);
    const initiativeStr = (initiative >= 0 ? '+' : '') + initiative;
    return (_jsxs("div", { className: styles.panel, children: [_jsxs("div", { className: styles.header, onClick: onCharacter, style: { cursor: 'pointer' }, title: "Open Character Sheet", children: [_jsx("h2", { className: styles.name, children: char.name }), _jsxs("div", { className: styles.level, children: ["Level ", char.level, " ", char.class] })] }), _jsxs("div", { className: styles.statsRow, children: [_jsxs("div", { className: styles.statBox, children: [_jsx(Shield, { size: 16 }), _jsx("span", { className: styles.statValue, children: char.ac }), _jsx("span", { className: styles.statLabel, children: "AC" })] }), _jsxs("div", { className: styles.statBox, children: [_jsx(Zap, { size: 16 }), _jsx("span", { className: styles.statValue, children: initiativeStr }), _jsx("span", { className: styles.statLabel, children: "INIT" })] })] }), _jsx(HealthBar, { current: char.hp.current, max: char.hp.max }), _jsx(ConditionDisplay, { conditions: char.conditions }), _jsx("div", { className: styles.abilityGrid, children: Object.entries(char.stats).map(([stat, val]) => (_jsxs("div", { className: styles.abilityBox, children: [_jsx("div", { className: styles.abilityLabel, children: stat }), _jsx("div", { className: styles.abilityValue, children: val })] }, stat))) }), char.spellSlots && Object.keys(char.spellSlots).length > 0 && (_jsx(SpellSlotTracker, { slots: char.spellSlots }))] }));
};
export default CharacterPanel;
