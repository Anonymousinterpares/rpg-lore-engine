import React from 'react';
import styles from './HealthBar.module.css';

interface HealthBarProps {
    current: number;
    max: number;
    temp?: number;
}

const HealthBar: React.FC<HealthBarProps> = ({ current, max, temp = 0 }) => {
    const healthPercent = Math.min((current / max) * 100, 100);
    const tempPercent = Math.min((temp / max) * 100, 100);

    return (
        <div className={styles.container}>
            <div className={styles.barBackground}>
                <div
                    className={styles.healthFill}
                    style={{ width: `${healthPercent}%` }}
                />
                {temp > 0 && (
                    <div
                        className={styles.tempFill}
                        style={{ width: `${tempPercent}%`, left: `${healthPercent}%` }}
                    />
                )}
            </div>
            <div className={styles.text}>
                {current} / {max} {temp > 0 && `(+${temp})`} HP
            </div>
        </div>
    );
};

export default HealthBar;
