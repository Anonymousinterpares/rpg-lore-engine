import React, { useState } from 'react';
import glassStyles from '../../styles/glass.module.css';
import styles from './PlayerInputField.module.css';
import { Send } from 'lucide-react';

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

    const handleSubmit = () => {
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
                            className={styles.suggestionChip}
                            onClick={() => handleSuggestionClick(action)}
                            disabled={disabled}
                        >
                            <span className={styles.hintIcon}>💡</span>
                            {action}
                        </button>
                    ))}
                </div>
            )}
            <div className={styles.inputRow}>
                <input
                    type="text"
                    className={styles.textInput}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <button
                    className={`${glassStyles.button} ${styles.submitButton}`}
                    onClick={handleSubmit}
                    disabled={disabled || !input.trim()}
                >
                    <Send size={18} />
                    <span>Submit</span>
                </button>
            </div>
        </div>
    );
};

export default PlayerInputField;
