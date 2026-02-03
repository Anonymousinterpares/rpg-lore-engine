import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './MainViewport.module.css';
import NarrativeBox from '../narrative/NarrativeBox';
import PlayerInputField from '../actions/PlayerInputField';
const MainViewport = ({ className }) => {
    const [narrativeText, setNarrativeText] = useState("The cave entrance yawns before you, exhaling a chill that smells of damp stone and something... else. Faint scratching echoes from within. To the west, the forest trail winds back toward the village.");
    const [suggestedActions, setSuggestedActions] = useState([
        "Enter the cave cautiously",
        "Light a torch before entering",
        "Listen more carefully",
        "Return to the village"
    ]);
    const handlePlayerInput = (input) => {
        // Here we would eventually call the engine
        setNarrativeText(`You decided to: "${input}". \n\nAs you proceed, the shadows seem to lengthen. The scratching stops abruptly...`);
        setSuggestedActions(["Draw your weapon", "Call out into the darkness", "Back away slowly"]);
    };
    return (_jsxs("main", { className: `${styles.viewport} ${className}`, children: [_jsx("div", { className: styles.narrativeContainer, children: _jsx(NarrativeBox, { title: "Whispering Woods - Cave Entrance", text: narrativeText }) }), _jsx("div", { className: styles.actionBar, children: _jsx(PlayerInputField, { suggestedActions: suggestedActions, onSubmit: handlePlayerInput }) })] }));
};
export default MainViewport;
