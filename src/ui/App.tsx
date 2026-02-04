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
import Codex from './components/codex/Codex';
import CharacterSheet from './components/character/CharacterSheet';
import BookModal from './components/book/BookModal';
import { BookPageData } from './context/BookContext';
import { Book, User } from 'lucide-react';

const App: React.FC = () => {
    const { isActive, startGame, endGame } = useGameState();
    const [showSettings, setShowSettings] = useState(false);
    const [showLobby, setShowLobby] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [bookOpen, setBookOpen] = useState(false);
    const [activeBookPageId, setActiveBookPageId] = useState<string>('character');
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);

    // Close modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
                setShowSettings(false);
                setShowLobby(false);
                setBookOpen(false);
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

    // Default settings placeholder
    const defaultSettings = {
        video: { fullscreen: false, vsync: true, resolutionScale: 1.0 },
        audio: { master: 0.8, music: 0.6 },
        gameplay: { difficulty: 'normal', tutorials: true },
        ai: {}
    };

    const handleSettingsSave = (newSettings: any) => {
        console.log("Settings saved:", newSettings);
        // In the future, this would persist to a store
    };

    const bookPages: BookPageData[] = [
        {
            id: 'character',
            label: 'Character',
            content: <CharacterSheet onClose={() => setBookOpen(false)} isPage={true} />,
            permanent: true
        },
        {
            id: 'equipment',
            label: 'Equipment',
            content: (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                    <h2 style={{ fontFamily: 'Cinzel, serif', color: '#5d4037' }}>Equipment & Paperdoll</h2>
                    <p style={{ fontStyle: 'italic', opacity: 0.6 }}>The Great Forge is still preparing your armory...</p>
                    <Book size={80} style={{ marginTop: '40px', opacity: 0.2 }} />
                </div>
            ),
            permanent: true
        },
        {
            id: 'codex',
            label: 'Codex',
            content: <Codex isOpen={true} onClose={() => { }} isPage={true} />,
            permanent: true
        },
        {
            id: 'settings',
            label: 'Settings',
            content: (
                <SettingsPanel
                    onClose={() => setBookOpen(false)}
                    onSave={handleSettingsSave}
                    initialSettings={defaultSettings}
                    isPage={true}
                />
            ),
            permanent: true
        }
    ];

    const openCharacterSheet = () => {
        setActiveBookPageId('character');
        setBookOpen(true);
    };

    const openCodex = () => {
        setActiveBookPageId('codex');
        setBookOpen(true);
    };

    const openEquipment = () => {
        setActiveBookPageId('equipment');
        setBookOpen(true);
    };

    const openSettings = () => {
        setActiveBookPageId('settings');
        setBookOpen(true);
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
                        onSettings={openSettings}
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
                        onSettings={openSettings}
                        onCodex={openCodex}
                        onCharacter={openCharacterSheet}
                        onMenu={() => setShowMenu(true)}
                        onEquipment={openEquipment}
                    />
                    <div className={styles.mainContent}>
                        <Sidebar
                            className={styles.sidebar}
                            onCharacter={openCharacterSheet}
                        />
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
                                onSettings={() => { openSettings(); setShowMenu(false); }}
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
                    {bookOpen && (
                        <BookModal
                            isOpen={bookOpen}
                            onClose={() => setBookOpen(false)}
                            initialPages={bookPages}
                            activePageId={activeBookPageId}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default App;
