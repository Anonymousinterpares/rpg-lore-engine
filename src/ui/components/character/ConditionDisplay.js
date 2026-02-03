import { jsx as _jsx } from "react/jsx-runtime";
import styles from './ConditionDisplay.module.css';
const ConditionDisplay = ({ conditions, className = '' }) => {
    if (conditions.length === 0)
        return null;
    const getConditionColor = (condition) => {
        const c = condition.toLowerCase();
        if (['blinded', 'unconscious', 'paralyzed', 'stunned'].includes(c))
            return styles.critical;
        if (['poisoned', 'frightened', 'exhaustion'].includes(c))
            return styles.warning;
        return styles.info;
    };
    return (_jsx("div", { className: `${styles.container} ${className}`, children: conditions.map((condition) => (_jsx("span", { className: `${styles.badge} ${getConditionColor(condition)}`, title: condition, children: condition }, condition))) }));
};
export default ConditionDisplay;
