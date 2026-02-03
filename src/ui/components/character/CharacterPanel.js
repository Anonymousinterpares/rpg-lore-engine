import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './CharacterPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import HealthBar from './HealthBar';
import { Shield, Zap } from 'lucide-react';
const CharacterPanel = () => {
    // Mock data for initial visualization
    const char = {
        name: "Lirael",
        class: "Ranger",
        level: 3,
        hp: { current: 24, max: 28, temp: 0 },
        ac: 15,
        initiative: "+3",
        stats: { STR: 10, DEX: 16, CON: 14, INT: 12, WIS: 14, CHA: 10 }
    };
    return (_jsxs("div", { className: `${parchmentStyles.panel} ${styles.panel}`, children: [_jsxs("div", { className: styles.header, children: [_jsx("h2", { className: styles.name, children: char.name }), _jsxs("div", { className: styles.level, children: ["Level ", char.level, " ", char.class] })] }), _jsxs("div", { className: styles.statsRow, children: [_jsxs("div", { className: styles.statBox, children: [_jsx(Shield, { size: 16 }), _jsx("span", { className: styles.statValue, children: char.ac }), _jsx("span", { className: styles.statLabel, children: "AC" })] }), _jsxs("div", { className: styles.statBox, children: [_jsx(Zap, { size: 16 }), _jsx("span", { className: styles.statValue, children: char.initiative }), _jsx("span", { className: styles.statLabel, children: "INIT" })] })] }), _jsx(HealthBar, { current: char.hp.current, max: char.hp.max }), _jsx("div", { className: styles.abilityGrid, children: Object.entries(char.stats).map(([stat, val]) => (_jsxs("div", { className: styles.abilityBox, children: [_jsx("div", { className: styles.abilityLabel, children: stat }), _jsx("div", { className: styles.abilityValue, children: val })] }, stat))) })] }));
};
export default CharacterPanel;
