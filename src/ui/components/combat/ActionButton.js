import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './ActionButton.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
export const ActionButton = ({ icon, label, onClick, disabled = false, disabledReason, tooltip, hotkey, active = false, className = '' }) => {
    return (_jsxs("button", { className: `${styles.actionButton} ${parchmentStyles.button} ${active ? styles.active : ''} ${className}`, onClick: onClick, disabled: disabled, title: disabled && disabledReason ? `Disabled: ${disabledReason}` : tooltip, children: [_jsxs("div", { className: styles.iconWrapper, children: [icon, hotkey && _jsx("span", { className: styles.hotkey, children: hotkey })] }), _jsx("span", { className: styles.label, children: label }), disabled && _jsx("div", { className: styles.disabledOverlay })] }));
};
export default ActionButton;
