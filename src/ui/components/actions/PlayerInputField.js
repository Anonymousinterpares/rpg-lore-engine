import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import glassStyles from '../../styles/glass.module.css';
import styles from './PlayerInputField.module.css';
import { Send } from 'lucide-react';
export const PlayerInputField = ({ suggestedActions = [], onSubmit, placeholder = "What do you do?", disabled = false, mode = 'exploration' }) => {
    const [input, setInput] = useState('');
    const handleSubmit = () => {
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
    return (_jsxs("div", { className: styles.inputContainer, children: [suggestedActions.length > 0 && (_jsx("div", { className: styles.suggestions, children: suggestedActions.map((action, i) => (_jsxs("button", { className: styles.suggestionChip, onClick: () => handleSuggestionClick(action), disabled: disabled, children: [_jsx("span", { className: styles.hintIcon, children: "\uD83D\uDCA1" }), action] }, i))) })), _jsxs("div", { className: styles.inputRow, children: [_jsx("input", { type: "text", className: styles.textInput, value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSubmit(), placeholder: placeholder, disabled: disabled }), _jsxs("button", { className: `${glassStyles.button} ${styles.submitButton}`, onClick: handleSubmit, disabled: disabled || !input.trim(), children: [_jsx(Send, { size: 18 }), _jsx("span", { children: "Submit" })] })] })] }));
};
export default PlayerInputField;
