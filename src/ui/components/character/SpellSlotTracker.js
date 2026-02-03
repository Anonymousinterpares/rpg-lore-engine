import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './SpellSlotTracker.module.css';
const SpellSlotTracker = ({ slots, className = '' }) => {
    const levels = Object.keys(slots).sort();
    if (levels.length === 0)
        return null;
    return (_jsxs("div", { className: `${styles.container} ${className}`, children: [_jsx("h5", { className: styles.label, children: "Spell Slots" }), _jsx("div", { className: styles.grid, children: levels.map((level) => (_jsxs("div", { className: styles.slotRow, children: [_jsxs("span", { className: styles.level, children: ["Lvl ", level] }), _jsx("div", { className: styles.dots, children: [...Array(slots[level].max)].map((_, i) => (_jsx("div", { className: `${styles.dot} ${i < slots[level].current ? styles.active : ''}` }, i))) })] }, level))) })] }));
};
export default SpellSlotTracker;
