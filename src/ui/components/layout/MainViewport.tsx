import React, { useState } from 'react';
import styles from './MainViewport.module.css';
import NarrativeBox from '../narrative/NarrativeBox';
import PlayerInputField from '../actions/PlayerInputField';

interface MainViewportProps {
    className?: string;
}

const MainViewport: React.FC<MainViewportProps> = ({ className }) => {
    const [narrativeText, setNarrativeText] = useState(
        "The cave entrance yawns before you, exhaling a chill that smells of damp stone and something... else. Faint scratching echoes from within. To the west, the forest trail winds back toward the village."
    );
    const [suggestedActions, setSuggestedActions] = useState([
        "Enter the cave cautiously",
        "Light a torch before entering",
        "Listen more carefully",
        "Return to the village"
    ]);

    const handlePlayerInput = (input: string) => {
        // Here we would eventually call the engine
        setNarrativeText(`You decided to: "${input}". \n\nAs you proceed, the shadows seem to lengthen. The scratching stops abruptly...`);
        setSuggestedActions(["Draw your weapon", "Call out into the darkness", "Back away slowly"]);
    };

    return (
        <main className={`${styles.viewport} ${className}`}>
            <div className={styles.narrativeContainer}>
                <NarrativeBox
                    title="Whispering Woods - Cave Entrance"
                    text={narrativeText}
                />
            </div>
            <div className={styles.actionBar}>
                <PlayerInputField
                    suggestedActions={suggestedActions}
                    onSubmit={handlePlayerInput}
                />
            </div>
        </main>
    );
};

export default MainViewport;
