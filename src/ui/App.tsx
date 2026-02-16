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
import SpellPreparationPanel from './components/book/SpellPreparationPanel';
import WorldMapPage from './components/book/WorldMapPage';
import QuestsPage from './components/book/QuestsPage';
import { BookProvider, BookPageData } from './context/BookContext';
import { Book, Sparkles } from 'lucide-react';
import NotificationOverlay from './components/common/NotificationOverlay';
import SaveLoadModal from './components/menu/SaveLoadModal';
import { SnapshotService } from './services/SnapshotService';
import { NarratorService } from '../ruleset/agents/NarratorService';
import DevOverlay from './components/exploration/DevOverlay';
import { SettingsManager } from '../ruleset/combat/SettingsManager';

const App: React.FC = () => {
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { state, engine, isActive, startGame, endGame, saveGame, deleteSave, loadGame, getSaveRegistry } = useGameState();
    const [saveRegistry, setSaveRegistry] = useState<any>({ slots: [] });

    const [showSettings, setShowSettings] = useState(false);
    const [showLobby, setShowLobby] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [bookOpen, setBookOpen] = useState(false);
    const [activeBookPageId, setActiveBookPageId] = useState<string>('character');
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    const [codexDeepLink, setCodexDeepLink] = useState<{ category: string; entryId?: string } | undefined>(undefined);

    const [appSettings, setAppSettings] = useState(SettingsManager.getGlobalSettings());

    // Initial settings load
    useEffect(() => {
        const initSettings = async () => {
            const loaded = await SettingsManager.loadSettings();
            setAppSettings(loaded);
        };
        initSettings();
    }, []);

    // Refresh registry when modal opens
    useEffect(() => {
        const fetchRegistry = async () => {
            if (showSaveModal || showLoadModal) {
                const registry = await getSaveRegistry();
                setSaveRegistry(registry);
            }
        };
        fetchRegistry();
    }, [showSaveModal, showLoadModal, getSaveRegistry]);

    // Close modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
                setShowSettings(false);
                setShowLobby(false);
                setBookOpen(false);
                setShowSaveModal(false);
                setShowLoadModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Initial load of the save registry to ensure menus are populated immediately
    useEffect(() => {
        getSaveRegistry().then(setSaveRegistry);
    }, [getSaveRegistry]);

    const confirmAction = (message: string) => {
        if (!isActive) return true;
        return window.confirm(message);
    };

    const handleSaveGameAsync = async (id: string, name?: string) => {
        if (!state) return;

        setIsSaving(true);
        try {
            // 1. Capture Snapshot
            const snapshot = SnapshotService.captureMapSnapshot(state);

            // 2. Generate Narrative Summary via LLM
            const summary = await NarratorService.generateSaveSummary(state);
            // 3. Save Logic
            let slotName = 'Adventure';
            if (id === 'new') {
                slotName = name || 'new save';
            } else {
                const existingSlot = saveRegistry.slots.find((s: any) => s.id === id);
                slotName = existingSlot?.slotName || 'Adventure';

                // If we are overwriting a different session ID, cleanup the old one
                if (state.saveId !== id) {
                    await deleteSave(id);
                }
            }

            await saveGame(slotName, summary, snapshot);

            // 4. Update Registry & UI
            const newRegistry = await getSaveRegistry();
            setSaveRegistry(newRegistry);

            // Optional: Keep modal open or show success? For now, close it as per standard flow
            setShowSaveModal(false);
        } catch (e) {
            console.error("Save failed:", e);
            alert("Failed to save chronicle.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadGameAction = async (id: string) => {
        await loadGame(id);
        setShowLoadModal(false);
        setShowMenu(false);
    };

    const handleNewGame = () => {
        if (confirmAction("Starting a new adventure will stop the current game without saving. Proceed?")) {
            setIsCreatingCharacter(true);
            setShowMenu(false);
        }
    };

    const handleCharacterComplete = async (state: any) => {
        setIsCreatingCharacter(false);
        await startGame(state);
    };

    const handleLoadGameRequest = () => {
        if (confirmAction("Loading a chronicle will stop the current game without saving. Proceed?")) {
            setShowLoadModal(true);
            setShowMenu(false);
        }
    };

    const handleQuit = () => {
        endGame();
        setShowMenu(false);
    };

    // Unified handleSettingsSave
    const handleSettingsSave = async (newSettings: any) => {
        console.log("Settings saved:", newSettings);

        // 1. Update persisted storage (json + localstorage)
        await SettingsManager.saveGlobalSettings(newSettings);
        setAppSettings(newSettings);

        // 2. If game is active, update the engine state
        if (engine) {
            await engine.updateSettings(newSettings);
        }
    };

    const currentSettings = state?.settings || appSettings;

    const bookPages: BookPageData[] = [
        {
            id: 'character',
            label: 'Character',
            content: <CharacterSheet onClose={() => setBookOpen(false)} isPage={true} />,
            permanent: true
        },
        {
            id: 'world_map',
            label: 'World Map',
            content: <WorldMapPage />,
            permanent: true
        },
        {
            id: 'quests',
            label: 'Quests',
            content: <QuestsPage />,
            permanent: true,
            hasNotification: state?.activeQuests?.some(q => q.isNew)
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
            id: 'world',
            label: 'World',
            content: <Codex isOpen={true} onClose={() => { }} isPage={true} initialDeepLink={{ category: 'world' }} />,
            permanent: true
        },
        {
            id: 'codex',
            label: 'Codex',
            content: <Codex isOpen={true} onClose={() => { }} isPage={true} initialDeepLink={codexDeepLink} />,
            permanent: true,
            hasNotification: state?.codexEntries?.some(e => e.isNew)
        },
        {
            id: 'settings',
            label: 'Settings',
            content: (
                <SettingsPanel
                    onClose={() => setBookOpen(false)}
                    onSave={handleSettingsSave}
                    initialSettings={currentSettings}
                    isPage={true}
                />
            ),
            permanent: true
        },
        {
            id: 'spellbook',
            label: 'Spellbook',
            content: <SpellPreparationPanel />,
            permanent: true
        }
    ];

    const openCharacterSheet = () => {
        setActiveBookPageId('character');
        setBookOpen(true);
    };

    const openCodex = (category: string = 'mechanics', entryId?: string) => {
        setCodexDeepLink(entryId ? { category, entryId } : undefined);
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


    return (
        <BookProvider initialPages={bookPages} initialActiveId={activeBookPageId}>
            <div className={styles.appShell}>
                {isCreatingCharacter ? (
                    <CharacterCreator
                        onComplete={handleCharacterComplete}
                        onCancel={() => setIsCreatingCharacter(false)}
                        campaignSettings={appSettings}
                    />
                ) : !isActive ? (
                    <>
                        <MainMenu
                            isActive={isActive}
                            onNewGame={handleNewGame}
                            onSaveGame={() => setShowSaveModal(true)}
                            onLoadGame={() => setShowLoadModal(true)}
                            onMultiplayer={() => setShowLobby(true)}
                            onSettings={openSettings}
                            onQuit={() => window.close()}
                        />
                        {showSettings && (
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onSave={handleSettingsSave}
                                initialSettings={currentSettings}
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
                            <RightPanel
                                className={styles.rightPanel}
                                onWorldMap={openWorldMap}
                                onQuests={openQuests}
                            />
                            {state && <DevOverlay state={state} />}
                        </div>
                        {/* In-game Modals */}
                        {showSettings && (
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onSave={handleSettingsSave}
                                initialSettings={currentSettings}
                            />
                        )}
                        {showMenu && (
                            <div className={styles.modalOverlay}>
                                <MainMenu
                                    isActive={isActive}
                                    onNewGame={handleNewGame}
                                    onSaveGame={() => { setShowSaveModal(true); setShowMenu(false); }}
                                    onLoadGame={handleLoadGameRequest}
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
                        <NotificationOverlay onOpenCodex={openCodex} />
                    </>
                )}
                {bookOpen && (
                    <BookModal
                        isOpen={bookOpen}
                        onClose={() => setBookOpen(false)}
                        initialPages={bookPages}
                        activePageId={activeBookPageId}
                    />
                )}
                {showSaveModal && (
                    <SaveLoadModal
                        mode="save"
                        slots={saveRegistry.slots.map((s: any) => ({
                            id: s.id,
                            name: s.slotName,
                            charName: s.characterName,
                            level: s.characterLevel,
                            location: s.locationSummary,
                            lastSaved: new Date(s.lastSaved).toLocaleString(),
                            playTime: `${Math.floor(s.playTimeSeconds / 3600)}h ${Math.floor((s.playTimeSeconds % 3600) / 60)}m`,
                            narrativeSummary: s.narrativeSummary,
                            thumbnail: s.thumbnail
                        }))}
                        onAction={handleSaveGameAsync}
                        onDelete={(id) => {
                            console.log("Delete not fully wired but metadata removed:", id);
                            // This would call gameStateManager.deleteSave
                        }}
                        onClose={() => setShowSaveModal(false)}
                    />
                )}
                {showLoadModal && (
                    <SaveLoadModal
                        mode="load"
                        slots={saveRegistry.slots.map((s: any) => ({
                            id: s.id,
                            name: s.slotName,
                            charName: s.characterName,
                            level: s.characterLevel,
                            location: s.locationSummary,
                            lastSaved: new Date(s.lastSaved).toLocaleString(),
                            playTime: `${Math.floor(s.playTimeSeconds / 3600)}h ${Math.floor((s.playTimeSeconds % 3600) / 60)}m`,
                            narrativeSummary: s.narrativeSummary,
                            thumbnail: s.thumbnail
                        }))}
                        onAction={handleLoadGameAction}
                        onDelete={(id) => {
                            console.log("Delete not fully wired but metadata removed:", id);
                        }}
                        onClose={() => setShowLoadModal(false)}
                    />
                )}
                {isSaving && (
                    <div className={styles.savingOverlay}>
                        <div className={styles.savingContent}>
                            <Sparkles className={styles.savingIcon} />
                            <span>Summarizing Chronicle...</span>
                        </div>
                    </div>
                )}
            </div>
        </BookProvider>
    );
};

export default App;
