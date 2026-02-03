import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './PlayerInputField.module.css';
import { Send } from 'lucide-react';
import parchmentStyles from '../../styles/parchment.module.css';
export const PlayerInputField = ({ suggestedActions = [], onSubmit, placeholder = "What do you do?", disabled = false, mode = 'exploration' }) => {
    const [input, setInput] = useState('');
    const handleSubmit = (e) => {
        if (e)
            e.preventDefault();
        if (input.trim() && !disabled) {
            onSubmit(input.trim());
            setInput('');
        }
    };
    const handleSuggestionClick = (action) => {
        if (!disabled) {
            onSubmit(action);
        }
    };
    return (_jsxs("div", { className: styles.inputContainer, children: [suggestedActions.length > 0 && (_jsx("div", { className: styles.suggestions, children: suggestedActions.map((action, i) => (_jsxs("button", { className: `${styles.suggestionChip} ${parchmentStyles.button}`, onClick: () => handleSuggestionClick(action), disabled: disabled, children: [_jsx("span", { className: styles.hintIcon, children: "\uD83D\uDCA1" }), action] }, i))) })), _jsxs("form", { onSubmit: handleSubmit, className: styles.inputRow, children: [_jsx("input", { type: "text", className: `${styles.textInput} ${parchmentStyles.input}`, value: input, onChange: (e) => setInput(e.target.value), placeholder: placeholder, disabled: disabled }), _jsxs("button", { type: "submit", className: `${parchmentStyles.button} ${styles.submitButton}`, disabled: disabled || !input.trim(), children: [_jsx(Send, { size: 18 }), _jsx("span", { children: "Submit" })] })] })] }));
};
export default PlayerInputField;
