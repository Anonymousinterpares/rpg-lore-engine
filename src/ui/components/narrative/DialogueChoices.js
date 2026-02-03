import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import styles from './DialogueChoices.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
const DialogueChoices = ({ choices, onSelect, className = '' }) => {
    return (_jsx("div", { className: `${styles.container} ${className}`, children: _jsx("div", { className: styles.optionsList, children: choices.map((choice, index) => (_jsxs("button", { className: `${styles.choiceButton} ${parchmentStyles.button}`, onClick: () => onSelect(choice.id), children: [_jsxs("span", { className: styles.number, children: [index + 1, "."] }), _jsx("span", { className: styles.text, children: choice.text })] }, choice.id))) }) }));
};
export default DialogueChoices;
