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
import BookModal from './components/book/BookModal';
import WorldMapPage from './components/book/WorldMapPage';
import QuestsPage from './components/book/QuestsPage';
import { Book } from 'lucide-react';
const App = () => {
    const { state, isActive, startGame, endGame } = useGameState();
    const [showSettings, setShowSettings] = useState(false);
    const [showLobby, setShowLobby] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [bookOpen, setBookOpen] = useState(false);
    const [activeBookPageId, setActiveBookPageId] = useState('character');
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    // Close modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
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
    // Default settings placeholder
    const defaultSettings = {
        video: { fullscreen: false, vsync: true, resolutionScale: 1.0 },
        audio: { master: 0.8, music: 0.6 },
        gameplay: { difficulty: 'normal', tutorials: true },
        ai: {}
    };
    const handleSettingsSave = (newSettings) => {
        console.log("Settings saved:", newSettings);
        // In the future, this would persist to a store
    };
    const bookPages = [
        {
            id: 'character',
            label: 'Character',
            content: _jsx(CharacterSheet, { onClose: () => setBookOpen(false), isPage: true }),
            permanent: true
        },
        {
            id: 'world_map',
            label: 'World Map',
            content: _jsx(WorldMapPage, {}),
            permanent: true
        },
        {
            id: 'quests',
            label: 'Quests',
            content: _jsx(QuestsPage, {}),
            permanent: true,
            hasNotification: state?.activeQuests?.some(q => q.isNew)
        },
        {
            id: 'equipment',
            label: 'Equipment',
            content: (_jsxs("div", { style: { padding: '60px', textAlign: 'center' }, children: [_jsx("h2", { style: { fontFamily: 'Cinzel, serif', color: '#5d4037' }, children: "Equipment & Paperdoll" }), _jsx("p", { style: { fontStyle: 'italic', opacity: 0.6 }, children: "The Great Forge is still preparing your armory..." }), _jsx(Book, { size: 80, style: { marginTop: '40px', opacity: 0.2 } })] })),
            permanent: true
        },
        {
            id: 'world',
            label: 'World',
            content: _jsx(Codex, { isOpen: true, onClose: () => { }, isPage: true, initialDeepLink: { category: 'world' } }),
            permanent: true
        },
        {
            id: 'codex',
            label: 'Codex',
            content: _jsx(Codex, { isOpen: true, onClose: () => { }, isPage: true }),
            permanent: true
        },
        {
            id: 'settings',
            label: 'Settings',
            content: (_jsx(SettingsPanel, { onClose: () => setBookOpen(false), onSave: handleSettingsSave, initialSettings: defaultSettings, isPage: true })),
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
    const openWorldMap = () => {
        setActiveBookPageId('world_map');
        setBookOpen(true);
    };
    const openQuests = () => {
        setActiveBookPageId('quests');
        setBookOpen(true);
    };
    return (_jsx("div", { className: styles.appShell, children: isCreatingCharacter ? (_jsx(CharacterCreator, { onComplete: handleCharacterComplete, onCancel: () => setIsCreatingCharacter(false) })) : !isActive ? (_jsxs(_Fragment, { children: [_jsx(MainMenu, { onNewGame: handleNewGame, onLoadGame: handleLoadGame, onMultiplayer: () => setShowLobby(true), onSettings: openSettings, onQuit: () => window.close() }), showSettings && (_jsx(SettingsPanel, { onClose: () => setShowSettings(false), onSave: handleSettingsSave, initialSettings: defaultSettings })), showLobby && (_jsx("div", { className: styles.modalOverlay, children: _jsxs("div", { className: styles.placeholderModal, children: [_jsx("h2", { children: "Multiplayer Lobby" }), _jsx("p", { children: "Coming Soon!" }), _jsx("button", { onClick: () => setShowLobby(false), children: "Close" })] }) }))] })) : (_jsxs(_Fragment, { children: [_jsx(Header, { onLobby: () => setShowLobby(true), onSettings: openSettings, onCodex: openCodex, onCharacter: openCharacterSheet, onMenu: () => setShowMenu(true), onEquipment: openEquipment }), _jsxs("div", { className: styles.mainContent, children: [_jsx(Sidebar, { className: styles.sidebar, onCharacter: openCharacterSheet }), _jsx(MainViewport, { className: styles.viewport }), _jsx(RightPanel, { className: styles.rightPanel, onWorldMap: openWorldMap, onQuests: openQuests })] }), showSettings && (_jsx(SettingsPanel, { onClose: () => setShowSettings(false), onSave: handleSettingsSave, initialSettings: defaultSettings })), showMenu && (_jsxs("div", { className: styles.modalOverlay, children: [_jsx(MainMenu, { onNewGame: handleNewGame, onLoadGame: handleLoadGame, onMultiplayer: () => { setShowLobby(true); setShowMenu(false); }, onSettings: () => { openSettings(); setShowMenu(false); }, onQuit: handleQuit }), _jsx("button", { className: styles.closeOverlay, onClick: () => setShowMenu(false), children: "Return to Game" })] })), showLobby && (_jsx("div", { className: styles.modalOverlay, children: _jsxs("div", { className: styles.placeholderModal, children: [_jsx("h2", { children: "Multiplayer Lobby" }), _jsx("p", { children: "Coming Soon!" }), _jsx("button", { onClick: () => setShowLobby(false), children: "Close" })] }) })), bookOpen && (_jsx(BookModal, { isOpen: bookOpen, onClose: () => setBookOpen(false), initialPages: bookPages, activePageId: activeBookPageId }))] })) }));
};
export default App;
