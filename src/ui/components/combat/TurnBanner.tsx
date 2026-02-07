import React, { useState, useEffect } from 'react';
import styles from './TurnBanner.module.css';
import { useGameState } from '../../hooks/useGameState';

const TurnBanner: React.FC = () => {
    const { state } = useGameState();
    const [localVisible, setLocalVisible] = useState(false);
    const activeBanner = state?.combat?.activeBanner;

    useEffect(() => {
        if (activeBanner?.visible) {
            setLocalVisible(true);
            const timer = setTimeout(() => {
                setLocalVisible(false);
            }, 1800); // Slightly shorter than the 2s animation
            return () => clearTimeout(timer);
        }
    }, [activeBanner?.visible, activeBanner?.text, activeBanner?.type]);

    if (!activeBanner || !localVisible) return null;

    const bannerClass = activeBanner.type === 'ENEMY' ? styles.enemyBanner :
        activeBanner.type === 'NAME' ? styles.nameBanner : styles.banner;

    // Default text mapping
    let displayText = activeBanner.text;
    if (!displayText) {
        if (activeBanner.type === 'PLAYER') displayText = 'YOUR TURN';
        if (activeBanner.type === 'ENEMY') displayText = 'ENEMY TURN';
    }

    return (
        <div className={styles.overlay}>
            <div className={`${styles.banner} ${bannerClass}`}>
                <div className={styles.line} />
                <h2 className={styles.text}>{displayText}</h2>
                <div className={styles.line} />
            </div>
        </div>
    );
};

export default TurnBanner;
