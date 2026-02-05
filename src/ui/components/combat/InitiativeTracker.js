import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './InitiativeTracker.module.css';
import { ChevronRight } from 'lucide-react';
const InitiativeTracker = ({ combatants, currentTurnId, className = '' }) => {
    return (_jsx("div", { className: `${styles.container} ${className}`, children: _jsx("div", { className: styles.list, children: combatants.map((c) => {
                const hpPercent = Math.max(0, Math.min(100, (c.hp.current / c.hp.max) * 100));
                const isActive = c.id === currentTurnId;
                return (_jsxs("div", { className: `${styles.combatant} ${isActive ? styles.active : ''} ${c.isPlayer ? styles.player : styles.enemy}`, children: [isActive && _jsx(ChevronRight, { className: styles.indicator, size: 14 }), _jsxs("div", { className: styles.info, children: [_jsx("span", { className: styles.name, children: c.name }), _jsxs("span", { className: styles.init, children: ["(", c.initiative, ")"] })] }), _jsxs("div", { className: styles.hpContainer, children: [_jsx("div", { className: styles.hpBar, style: { width: `${hpPercent}%` } }), _jsxs("span", { className: styles.hpText, children: [c.hp.current, "/", c.hp.max] })] })] }, c.id));
            }) }) }));
};
export default InitiativeTracker;
