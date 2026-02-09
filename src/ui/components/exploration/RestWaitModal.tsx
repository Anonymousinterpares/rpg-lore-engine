import React, { useState } from 'react';
import styles from './RestWaitModal.module.css';

interface RestWaitModalProps {
    onConfirm: (action: 'rest' | 'wait', durationMinutes: number) => void;
    onCancel: () => void;
}

const RestWaitModal: React.FC<RestWaitModalProps> = ({ onConfirm, onCancel }) => {
    const [activeTab, setActiveTab] = useState<'rest' | 'wait'>('wait');
    const [durationValues, setDurationValues] = useState<number>(60); // Default 1 hour

    // Slider range: 30 min (0.5h) to 1440 min (24h) in 30 min steps
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
        onConfirm(activeTab, durationValues);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Pass Time</h2>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'wait' ? styles.active : ''}`}
                        onClick={() => setActiveTab('wait')}
                    >
                        Wait
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'rest' ? styles.active : ''}`}
                        onClick={() => setActiveTab('rest')}
                    >
                        Rest
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.description}>
                        {activeTab === 'wait'
                            ? "Pass time while remaining alert. You can be ambushed."
                            : "Rest to recover HP and abilities. Lower perception."}
                    </div>

                    <div className={styles.sliderContainer}>
                        <label className={styles.sliderLabel}>Duration: {formatDuration(durationValues)}</label>
                        <input
                            type="range"
                            min={minVal}
                            max={maxVal}
                            step={step}
                            value={durationValues}
                            onChange={handleSliderChange}
                            className={styles.slider}
                        />
                        <div className={styles.sliderMarks}>
                            <span>30m</span>
                            <span>12h</span>
                            <span>24h</span>
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                    <button className={styles.confirmBtn} onClick={handleConfirm}>
                        {activeTab === 'rest' ? 'Rest' : 'Wait'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestWaitModal;
