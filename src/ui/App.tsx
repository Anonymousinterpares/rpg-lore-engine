import React, { useState, useEffect } from 'react';
import styles from './App.module.css';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainViewport from './components/layout/MainViewport';
import RightPanel from './components/layout/RightPanel';
import MainMenu from './components/menu/MainMenu';
import SettingsPanel from './components/menu/SettingsPanel';
import { useGameState } from './hooks/useGameState';
import CharacterCreator from './components/creation/CharacterCreator';

const App: React.FC = () => {
    const { isActive, startGame, endGame } = useGameState();
    const [showSettings, setShowSettings] = useState(false);
    const [showLobby, setShowLobby] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);

    // Close modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
                setShowSettings(false);
                setShowLobby(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const confirmAction = (message: string) => {
        if (!isActive) return true;
        return window.confirm(message);
    };

    const handleNewGame = () => {
        if (confirmAction("Starting a new adventure will stop the current game without saving. Proceed?")) {
            setIsCreatingCharacter(true);
            setShowMenu(false);
        }
    };

    const handleCharacterComplete = (state: any) => {
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

    const handleSettingsSave = (newSettings: any) => {
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

    return (
        <div className={styles.appShell}>
            {isCreatingCharacter ? (
                <CharacterCreator
                    onComplete={handleCharacterComplete}
                    onCancel={() => setIsCreatingCharacter(false)}
                />
            ) : !isActive ? (
                <>
                    <MainMenu
                        onNewGame={handleNewGame}
                        onLoadGame={handleLoadGame}
                        onMultiplayer={() => setShowLobby(true)}
                        onSettings={() => setShowSettings(true)}
                        onQuit={() => window.close()}
                    />
                    {showSettings && (
                        <SettingsPanel
                            onClose={() => setShowSettings(false)}
                            onSave={handleSettingsSave}
                            initialSettings={defaultSettings}
                        />
                    )}
                    {showLobby && (
                        <div className={styles.modalOverlay}>
                            <div className={styles.placeholderModal}>
                                <h2>Multiplayer Lobby</h2>
                                <p>Coming Soon!</p>
                                <button onClick={() => setShowLobby(false)}>Close</button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <Header
                        onLobby={() => setShowLobby(true)}
                        onSettings={() => setShowSettings(true)}
                        onMenu={() => setShowMenu(true)}
                    />
                    <div className={styles.mainContent}>
                        <Sidebar className={styles.sidebar} />
                        <MainViewport className={styles.viewport} />
                        <RightPanel className={styles.rightPanel} />
                    </div>
                    {/* In-game Modals */}
                    {showSettings && (
                        <SettingsPanel
                            onClose={() => setShowSettings(false)}
                            onSave={handleSettingsSave}
                            initialSettings={defaultSettings}
                        />
                    )}
                    {showMenu && (
                        <div className={styles.modalOverlay}>
                            <MainMenu
                                onNewGame={handleNewGame}
                                onLoadGame={handleLoadGame}
                                onMultiplayer={() => { setShowLobby(true); setShowMenu(false); }}
                                onSettings={() => { setShowSettings(true); setShowMenu(false); }}
                                onQuit={handleQuit}
                            />
                            <button className={styles.closeOverlay} onClick={() => setShowMenu(false)}>Return to Game</button>
                        </div>
                    )}
                    {showLobby && (
                        <div className={styles.modalOverlay}>
                            <div className={styles.placeholderModal}>
                                <h2>Multiplayer Lobby</h2>
                                <p>Coming Soon!</p>
                                <button onClick={() => setShowLobby(false)}>Close</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default App;
