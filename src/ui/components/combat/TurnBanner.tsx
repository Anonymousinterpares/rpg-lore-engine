import React, { useState, useEffect } from 'react';
import styles from './TurnBanner.module.css';

interface TurnBannerProps {
    isPlayerTurn: boolean;
    turnNumber: number;
}

const TurnBanner: React.FC<TurnBannerProps> = ({ isPlayerTurn, turnNumber }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isPlayerTurn) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isPlayerTurn, turnNumber]);

    if (!visible) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.banner}>
                <div className={styles.line} />
                <h2 className={styles.text}>YOUR TURN</h2>
                <div className={styles.line} />
            </div>
        </div>
    );
};

export default TurnBanner;
