import React from 'react';
import styles from './ActionButton.module.css';
import parchmentStyles from '../../styles/parchment.module.css';

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    disabledReason?: string;
    tooltip?: string;
    hotkey?: string;
    active?: boolean;
    className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
    icon,
    label,
    onClick,
    disabled = false,
    disabledReason,
    tooltip,
    hotkey,
    active = false,
    className = ''
}) => {
    return (
        <button
            className={`${styles.actionButton} ${parchmentStyles.button} ${active ? styles.active : ''} ${className}`}
            onClick={onClick}
            disabled={disabled}
            title={disabled && disabledReason ? `Disabled: ${disabledReason}` : tooltip}
        >
            <div className={styles.iconWrapper}>
                {icon}
                {hotkey && <span className={styles.hotkey}>{hotkey}</span>}
            </div>
            <span className={styles.label}>{label}</span>
            {disabled && <div className={styles.disabledOverlay} />}
        </button>
    );
};

export default ActionButton;
