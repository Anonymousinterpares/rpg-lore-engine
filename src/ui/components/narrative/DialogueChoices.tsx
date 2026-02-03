import React from 'react';
import styles from './DialogueChoices.module.css';
import parchmentStyles from '../../styles/parchment.module.css';

interface Choice {
    id: string;
    text: string;
}

interface DialogueChoicesProps {
    choices: Choice[];
    onSelect: (id: string) => void;
    className?: string;
}

const DialogueChoices: React.FC<DialogueChoicesProps> = ({ choices, onSelect, className = '' }) => {
    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.optionsList}>
                {choices.map((choice, index) => (
                    <button
                        key={choice.id}
                        className={`${styles.choiceButton} ${parchmentStyles.button}`}
                        onClick={() => onSelect(choice.id)}
                    >
                        <span className={styles.number}>{index + 1}.</span>
                        <span className={styles.text}>{choice.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DialogueChoices;
