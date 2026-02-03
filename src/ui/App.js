import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './App.module.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainViewport from './components/layout/MainViewport';
import RightPanel from './components/layout/RightPanel';
import MainMenu from './components/menu/MainMenu';
import SettingsPanel from './components/menu/SettingsPanel';
import { useGameState } from './hooks/useGameState';
import { INITIAL_GAME_STATE } from './initialGameState';
const App = () => {
    const { isActive, startGame, endGame } = useGameState();
    const [showSettings, setShowSettings] = useState(false);
    const handleNewGame = () => {
        // In the future this might open a character creator
        startGame(INITIAL_GAME_STATE);
    };
    const handleLoadGame = () => {
        console.log("Load Game not implemented yet - functionality coming in next update");
    };
    const handleQuit = () => {
        endGame();
    };
    const handleSettingsSave = (newSettings) => {
        console.log("Settings saved:", newSettings);
        setShowSettings(false);
    };
    // Default settings placeholder
    const defaultSettings = {
        video: { fullscreen: false, vsync: true, resolutionScale: 1.0 },
        audio: { master: 0.8, music: 0.6 },
        gameplay: { difficulty: 'normal', tutorials: true },
        ai: {}
    };
    return (_jsx("div", { className: styles.appShell, children: !isActive ? (_jsxs(_Fragment, { children: [_jsx(MainMenu, { onNewGame: handleNewGame, onLoadGame: handleLoadGame, onMultiplayer: () => console.log("Multiplayer lobby"), onSettings: () => setShowSettings(true), onQuit: () => window.close() }), showSettings && (_jsx(SettingsPanel, { onClose: () => setShowSettings(false), onSave: handleSettingsSave, initialSettings: defaultSettings }))] })) : (_jsxs(_Fragment, { children: [_jsx(Header, {}), _jsxs("div", { className: styles.mainContent, children: [_jsx(Sidebar, { className: styles.sidebar }), _jsx(MainViewport, { className: styles.viewport }), _jsx(RightPanel, { className: styles.rightPanel })] })] })) }));
};
export default App;
