import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './App.module.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainViewport from './components/layout/MainViewport';
import RightPanel from './components/layout/RightPanel';
import MainMenu from './components/menu/MainMenu';
import SettingsPanel from './components/menu/SettingsPanel';
import { useGameState } from './hooks/useGameState';
import CharacterCreator from './components/creation/CharacterCreator';
import Codex from './components/codex/Codex';
import CharacterSheet from './components/character/CharacterSheet';
const App = () => {
    const { isActive, startGame, endGame } = useGameState();
    const [showSettings, setShowSettings] = useState(false);
    const [showLobby, setShowLobby] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showCodex, setShowCodex] = useState(false);
    const [showCharacterSheet, setShowCharacterSheet] = useState(false);
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    // Close modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
                setShowSettings(false);
                setShowLobby(false);
                setShowCodex(false);
                setShowCharacterSheet(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    const confirmAction = (message) => {
        if (!isActive)
            return true;
        return window.confirm(message);
    };
    const handleNewGame = () => {
        if (confirmAction("Starting a new adventure will stop the current game without saving. Proceed?")) {
            setIsCreatingCharacter(true);
            setShowMenu(false);
        }
    };
    const handleCharacterComplete = (state) => {
        setIsCreatingCharacter(false);
        startGame(state);
    };
    const handleLoadGame = () => {
        if (confirmAction("Loading a chronicle will stop the current game without saving (if not already saved). Proceed?")) {
            console.log("Load Game not implemented yet - functionality coming in next update");
        }
    };
    const handleQuit = () => {
        endGame();
        setShowMenu(false);
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
    return (_jsx("div", { className: styles.appShell, children: isCreatingCharacter ? (_jsx(CharacterCreator, { onComplete: handleCharacterComplete, onCancel: () => setIsCreatingCharacter(false) })) : !isActive ? (_jsxs(_Fragment, { children: [_jsx(MainMenu, { onNewGame: handleNewGame, onLoadGame: handleLoadGame, onMultiplayer: () => setShowLobby(true), onSettings: () => setShowSettings(true), onQuit: () => window.close() }), showSettings && (_jsx(SettingsPanel, { onClose: () => setShowSettings(false), onSave: handleSettingsSave, initialSettings: defaultSettings })), showLobby && (_jsx("div", { className: styles.modalOverlay, children: _jsxs("div", { className: styles.placeholderModal, children: [_jsx("h2", { children: "Multiplayer Lobby" }), _jsx("p", { children: "Coming Soon!" }), _jsx("button", { onClick: () => setShowLobby(false), children: "Close" })] }) }))] })) : (_jsxs(_Fragment, { children: [_jsx(Header, { onLobby: () => setShowLobby(true), onSettings: () => setShowSettings(true), onCodex: () => setShowCodex(true), onCharacter: () => setShowCharacterSheet(true), onMenu: () => setShowMenu(true) }), _jsxs("div", { className: styles.mainContent, children: [_jsx(Sidebar, { className: styles.sidebar, onCharacter: () => setShowCharacterSheet(true) }), _jsx(MainViewport, { className: styles.viewport }), _jsx(RightPanel, { className: styles.rightPanel })] }), showSettings && (_jsx(SettingsPanel, { onClose: () => setShowSettings(false), onSave: handleSettingsSave, initialSettings: defaultSettings })), showMenu && (_jsxs("div", { className: styles.modalOverlay, children: [_jsx(MainMenu, { onNewGame: handleNewGame, onLoadGame: handleLoadGame, onMultiplayer: () => { setShowLobby(true); setShowMenu(false); }, onSettings: () => { setShowSettings(true); setShowMenu(false); }, onQuit: handleQuit }), _jsx("button", { className: styles.closeOverlay, onClick: () => setShowMenu(false), children: "Return to Game" })] })), showLobby && (_jsx("div", { className: styles.modalOverlay, children: _jsxs("div", { className: styles.placeholderModal, children: [_jsx("h2", { children: "Multiplayer Lobby" }), _jsx("p", { children: "Coming Soon!" }), _jsx("button", { onClick: () => setShowLobby(false), children: "Close" })] }) })), _jsx(Codex, { isOpen: showCodex, onClose: () => setShowCodex(false) }), showCharacterSheet && (_jsx(CharacterSheet, { onClose: () => setShowCharacterSheet(false) }))] })) }));
};
export default App;
