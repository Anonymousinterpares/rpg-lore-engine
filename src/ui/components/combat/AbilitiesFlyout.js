import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './AbilitiesFlyout.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Zap } from 'lucide-react';
export const AbilitiesFlyout = ({ abilities, onUse, onClose }) => {
    return (_jsxs("div", { className: `${styles.flyout} ${parchmentStyles.container}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.title, children: [_jsx(Zap, { size: 18, className: styles.titleIcon }), _jsx("h3", { children: "Class Abilities" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.abilityGrid, children: [abilities.map(ability => {
                        const hasUsage = ability.usage !== undefined;
                        const canUse = !hasUsage || (ability.usage && ability.usage.current > 0);
                        return (_jsxs("button", { className: `${styles.abilityItem} ${parchmentStyles.button}`, onClick: () => canUse && onUse(ability), disabled: !canUse, title: ability.description, children: [_jsxs("div", { className: styles.abilityHeader, children: [_jsx("span", { className: styles.abilityName, children: ability.name }), _jsx("span", { className: styles.abilityCost, children: ability.actionCost.replace('_', ' ') })] }), _jsxs("div", { className: styles.abilityMeta, children: [hasUsage && (_jsxs("span", { className: styles.usageInfo, children: ["Uses: ", ability.usage?.current, " / ", ability.usage?.max, " (", ability.usage?.usageType.replace('_', ' '), ")"] })), !hasUsage && _jsx("span", { className: styles.passiveTag, children: "Passive/Perpetual" })] })] }, ability.name));
                    }), abilities.length === 0 && (_jsx("div", { className: styles.emptyState, children: "No class abilities available." }))] })] }));
};
export default AbilitiesFlyout;
