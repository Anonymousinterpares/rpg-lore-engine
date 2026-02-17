import React, { useState, useEffect, useRef } from 'react';
import styles from './RestWaitModal.module.css';

interface RestWaitModalProps {
    engine: any;
    onCancel: () => void;
}

const RestWaitModal: React.FC<RestWaitModalProps> = ({ engine, onCancel }) => {
    const [activeTab, setActiveTab] = useState<'rest' | 'wait'>('wait');
    const [durationValues, setDurationValues] = useState<number>(60); // Selection value
    const [remainingMinutes, setRemainingMinutes] = useState<number>(0);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [totalMinutesToPass, setTotalMinutesToPass] = useState(0);
    const cancelledRef = useRef(false);

    // ... slider logic unchanged ...
    const minVal = 30;
    const maxVal = 1440;
    const step = 30;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDurationValues(Number(e.target.value));
    };

    const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h} hours`;
        return `${m} minutes`;
    };

    const handleConfirm = () => {
        setRemainingMinutes(durationValues);
        setTotalMinutesToPass(durationValues);
        setIsCountingDown(true);
    };

    const handleCancel = () => {
        cancelledRef.current = true;

        // Apply proportional rewards for time already spent
        const passedMins = totalMinutesToPass - remainingMinutes;
        if (passedMins > 0) {
            engine.completeRest(passedMins, activeTab);
        }

        onCancel();
    };

    useEffect(() => {
        const tick = async () => {
            if (cancelledRef.current) return;

            if (!isCountingDown || remainingMinutes <= 0) {
                if (isCountingDown && remainingMinutes <= 0 && !cancelledRef.current) {
                    // Done!
                    await engine.completeRest(totalMinutesToPass, activeTab);
                    onCancel();
                }
                return;
            }

            const step = 30;
            const encounter = await engine.advanceTimeAndProcess(step, activeTab === 'rest');

            if (cancelledRef.current) return;

            if (encounter) {
                await engine.initializeCombat(encounter);
                onCancel();
                return;
            }

            setRemainingMinutes(prev => Math.max(0, prev - step));
        };

        const timer = setTimeout(tick, 500); // Pass 30 mins every 500ms
        return () => {
            clearTimeout(timer);
        };
    }, [isCountingDown, remainingMinutes, activeTab, engine, onCancel, totalMinutesToPass]);

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Pass Time</h2>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'wait' ? styles.active : ''}`}
                        onClick={() => !isCountingDown && setActiveTab('wait')}
                        disabled={isCountingDown}
                    >
                        Wait
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'rest' ? styles.active : ''}`}
                        onClick={() => !isCountingDown && setActiveTab('rest')}
                        disabled={isCountingDown}
                    >
                        Rest
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.description}>
                        {isCountingDown
                            ? `${activeTab === 'rest' ? 'Resting' : 'Waiting'}...`
                            : (activeTab === 'wait'
                                ? "Pass time while remaining alert. You can be ambushed."
                                : "Rest to recover HP and abilities. Lower perception.")
                        }
                    </div>

                    <div className={styles.sliderContainer}>
                        <label className={styles.sliderLabel}>
                            {isCountingDown ? "Time Remaining: " : "Duration: "}
                            {formatDuration(isCountingDown ? remainingMinutes : durationValues)}
                        </label>
                        <input
                            type="range"
                            min={minVal}
                            max={maxVal}
                            step={step}
                            value={isCountingDown ? remainingMinutes : durationValues}
                            onChange={handleSliderChange}
                            className={styles.slider}
                            disabled={isCountingDown}
                        />
                        {!isCountingDown && (
                            <div className={styles.sliderMarks}>
                                <span>30m</span>
                                <span>12h</span>
                                <span>24h</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
                    {!isCountingDown && (
                        <button className={styles.confirmBtn} onClick={handleConfirm}>
                            {activeTab === 'rest' ? 'Rest' : 'Wait'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RestWaitModal;
