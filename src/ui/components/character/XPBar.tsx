import React from 'react';
import styles from './XPBar.module.css';

interface XPBarProps {
    current: number;
    max: number;
    label?: string;
}

const XPBar: React.FC<XPBarProps> = ({ current, max, label = 'XP' }) => {
    const xpPercent = Math.min((current / max) * 100, 100);

    return (
        <div className={styles.container}>
            <div className={styles.barBackground}>
                <div
                    className={styles.xpFill}
                    style={{ width: `${xpPercent}%` }}
                />
            </div>
            <div className={styles.text}>
                {current} / {max} {label}
            </div>
        </div>
    );
};

export default XPBar;
