import React, { useEffect, useState } from 'react';
import styles from './TurnBanner.module.css';

interface TurnBannerProps {
    playerName: string;
    isPlayerTurn: boolean;
    className?: string;
}

const TurnBanner: React.FC<TurnBannerProps> = ({ playerName, isPlayerTurn, className = '' }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isPlayerTurn) {
            setShow(true);
            const timer = setTimeout(() => setShow(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isPlayerTurn]);

    if (!show) return null;

    return (
        <div className={`${styles.banner} ${className}`}>
            <div className={styles.content}>
                <span className={styles.label}>YOUR TURN</span>
                <h2 className={styles.name}>{playerName}</h2>
            </div>
        </div>
    );
};

export default TurnBanner;
