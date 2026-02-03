import React, { useState } from 'react';
import styles from './PlayerInputField.module.css';
import { Send } from 'lucide-react';
import parchmentStyles from '../../styles/parchment.module.css';

interface PlayerInputFieldProps {
    suggestedActions?: string[];
    onSubmit: (text: string) => void;
    placeholder?: string;
    disabled?: boolean;
    mode?: 'exploration' | 'combat' | 'dialogue';
}

export const PlayerInputField: React.FC<PlayerInputFieldProps> = ({
    suggestedActions = [],
    onSubmit,
    placeholder = "What do you do?",
    disabled = false,
    mode = 'exploration'
}) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (input.trim() && !disabled) {
            onSubmit(input.trim());
            setInput('');
        }
    };

    const handleSuggestionClick = (action: string) => {
        if (!disabled) {
            onSubmit(action);
        }
    };

    return (
        <div className={styles.inputContainer}>
            {suggestedActions.length > 0 && (
                <div className={styles.suggestions}>
                    {suggestedActions.map((action, i) => (
                        <button
                            key={i}
                            className={`${styles.suggestionChip} ${parchmentStyles.button}`}
                            onClick={() => handleSuggestionClick(action)}
                            disabled={disabled}
                        >
                            <span className={styles.hintIcon}>💡</span>
                            {action}
                        </button>
                    ))}
                </div>
            )}
            <form onSubmit={handleSubmit} className={styles.inputRow}>
                <input
                    type="text"
                    className={`${styles.textInput} ${parchmentStyles.input}`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <button
                    type="submit"
                    className={`${parchmentStyles.button} ${styles.submitButton}`}
                    disabled={disabled || !input.trim()}
                >
                    <Send size={18} />
                    <span>Submit</span>
                </button>
            </form>
        </div>
    );
};

export default PlayerInputField;
