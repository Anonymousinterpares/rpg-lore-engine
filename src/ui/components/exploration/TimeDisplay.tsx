import React from 'react';
import styles from './TimeDisplay.module.css';
import { Clock } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { WorldClockEngine } from '../../../ruleset/combat/WorldClockEngine';
import { TravelPace } from '../../../ruleset/schemas/BaseSchemas';
import { Footprints, Wind, Zap } from 'lucide-react';

const TimeDisplay: React.FC = () => {
    const { state, engine } = useGameState();

    if (!state || !state.worldTime) return null;

    const timeStr = WorldClockEngine.formatTime(state.worldTime);

    const handlePaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (engine) {
            engine.processTurn(`/pace ${e.target.value}`);
        }
    };

    const getPaceTooltip = (pace: TravelPace) => {
        switch (pace) {
            case 'Slow': return 'Slow & Careful: 1.5x travel time. Reduced ambush risk (0.5x).';
            case 'Normal': return 'Normal Pace: Standard travel time. No modifiers.';
            case 'Fast': return 'Fast & Loud: 0.75x travel time. Increased ambush risk (1.5x).';
            default: return '';
        }
    };

    return (
        <div className={styles.timeDisplay}>
            <div className={styles.paceSection}>
                <label className={styles.paceLabel} title="Determine your speed and awareness while traveling across the map.">
                    <Footprints size={14} /> Travel Pace:
                </label>
                <select
                    className={styles.paceSelect}
                    value={state.travelPace}
                    onChange={handlePaceChange}
                    title={getPaceTooltip(state.travelPace)}
                >
                    <option value="Slow" title={getPaceTooltip('Slow')}>🐢 Slow (Safe)</option>
                    <option value="Normal" title={getPaceTooltip('Normal')}>🚶 Normal</option>
                    <option value="Fast" title={getPaceTooltip('Fast')}>🐎 Fast (Risky)</option>
                </select>
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
