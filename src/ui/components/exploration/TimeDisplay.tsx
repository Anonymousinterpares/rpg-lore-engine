import React from 'react';
import styles from './TimeDisplay.module.css';
import { Clock } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { WorldClockEngine } from '../../../ruleset/combat/WorldClockEngine';
import { TravelPace } from '../../../ruleset/schemas/BaseSchemas';
import { Footprints, ShieldAlert, Zap, Ghost } from 'lucide-react';

const TimeDisplay: React.FC = () => {
    const { state, engine } = useGameState();

    if (!state || !state.worldTime) return null;

    const timeStr = WorldClockEngine.formatTime(state.worldTime);

    const handlePaceChange = async (newPace: string) => {
        if (engine) {
            await engine.processTurn(`/pace ${newPace}`);
        }
    };

    const getPaceTooltip = (pace: TravelPace) => {
        switch (pace) {
            case 'Cautious': return 'Cautious: 1.5x travel time. Reduced ambush risk (0.5x). +5 Perception bonus to notice threats.';
            case 'Normal': return 'Normal Pace: Standard travel time. No special modifiers.';
            case 'Forced March': return 'Forced March: 0.75x travel time. Increased ambush risk (1.5x). -5 Perception penalty.';
            case 'Stealth': return 'Stealth: 1.5x travel time. Greatly reduced ambush risk (0.25x). Uses stealth skill to avoid detection.';
            default: return '';
        }
    };

    return (
        <div className={styles.timeDisplay}>
            <div className={styles.paceSection}>
                <label className={styles.paceLabel} title="Determine your speed and awareness while traveling across the map.">
                    Travel Mode
                </label>
                <div className={styles.modeButtonGroup}>
                    <button
                        className={`${styles.modeButton} ${state.travelPace === 'Cautious' ? styles.modeButtonActive : ''}`}
                        onClick={() => handlePaceChange('Cautious')}
                        title={getPaceTooltip('Cautious')}
                    >
                        <ShieldAlert size={16} />
                    </button>
                    <button
                        className={`${styles.modeButton} ${state.travelPace === 'Normal' ? styles.modeButtonActive : ''}`}
                        onClick={() => handlePaceChange('Normal')}
                        title={getPaceTooltip('Normal')}
                    >
                        <Footprints size={16} />
                    </button>
                    <button
                        className={`${styles.modeButton} ${state.travelPace === 'Forced March' ? styles.modeButtonActive : ''}`}
                        onClick={() => handlePaceChange('Forced March')}
                        title={getPaceTooltip('Forced March')}
                    >
                        <Zap size={16} />
                    </button>
                    <button
                        className={`${styles.modeButton} ${state.travelPace === 'Stealth' ? styles.modeButtonActive : ''}`}
                        onClick={() => handlePaceChange('Stealth')}
                        title={getPaceTooltip('Stealth')}
                    >
                        <Ghost size={16} />
                    </button>
                </div>
            </div>

            <div className={styles.timeSection}>
                <Clock size={16} className={styles.clockIcon} />
                <span className={styles.timeText}>{timeStr}</span>
            </div>

            <div className={styles.weatherSection}>
                <img
                    src={`/assets/weather/${state.weather.type.toLowerCase()}.png`}
                    alt={state.weather.type}
                    className={styles.weatherIcon}
                    onError={(e) => {
                        // Fallback if image doesn't exist yet
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
                <span className={styles.weatherLabel}>{state.weather.type}</span>
            </div>
        </div>
    );
};

export default TimeDisplay;
