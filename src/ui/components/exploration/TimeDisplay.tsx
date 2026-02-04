import React from 'react';
import styles from './TimeDisplay.module.css';
import { Clock } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { WorldClockEngine } from '../../../ruleset/combat/WorldClockEngine';

const TimeDisplay: React.FC = () => {
    const { state } = useGameState();

    if (!state || !state.worldTime) return null;

    const timeStr = WorldClockEngine.formatTime(state.worldTime);

    // Split the formatted string for better styling if needed: "Day X, Month Y, Year Z | HH:00"
    // e.g., "1st of Hammer (1st Tenday), Year 1489 | 09:00"
    const [datePart, timePart] = timeStr.split('|').map(s => s.trim());

    return (
        <div className={styles.timeDisplay}>
            <Clock size={16} className={styles.clockIcon} />
            <span className={styles.timeText}>{timeStr}</span>
        </div>
    );
};

export default TimeDisplay;
