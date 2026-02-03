import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './InitiativeTracker.module.css';
import glassStyles from '../../styles/glass.module.css';
import { ChevronRight } from 'lucide-react';
const InitiativeTracker = ({ combatants, currentTurnId, className = '' }) => {
    return (_jsxs("div", { className: `${styles.container} ${glassStyles.glassPanel} ${className}`, children: [_jsx("h3", { className: styles.title, children: "Initiative" }), _jsx("div", { className: styles.list, children: combatants.map((c) => (_jsxs("div", { className: `${styles.item} ${c.id === currentTurnId ? styles.active : ''} ${c.isPlayer ? styles.player : styles.enemy}`, children: [c.id === currentTurnId && _jsx(ChevronRight, { className: styles.indicator, size: 16 }), _jsx("span", { className: styles.name, children: c.name }), _jsxs("div", { className: styles.details, children: [_jsx("span", { className: styles.init, children: c.initiative }), _jsx("div", { className: styles.miniHp, children: _jsx("div", { className: styles.hpBar, style: { width: `${(c.hp.current / c.hp.max) * 100}%` } }) })] })] }, c.id))) })] }));
};
export default InitiativeTracker;
