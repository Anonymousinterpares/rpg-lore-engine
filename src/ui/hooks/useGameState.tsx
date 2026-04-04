import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
import { GameStateManager, GameState } from '../../ruleset/combat/GameStateManager';
import { NetworkStorageProvider } from '../../ruleset/combat/NetworkStorageProvider';
import { IStorageProvider } from '../../ruleset/combat/IStorageProvider';
import { DataManager } from '../../ruleset/data/DataManager';
import { TacticalOption } from '../../ruleset/combat/grid/CombatAnalysisEngine';
import { SettingsManager } from '../../ruleset/combat/SettingsManager';

interface GameContextType {
    state: GameState | null;
    engine: GameLoop | null;
    isActive: boolean;
    isLoading: boolean;
    isProcessing: boolean;
    startGame: (initialState: GameState) => Promise<void>;
    endGame: () => void;
    processCommand: (command: string) => Promise<void>;
    updateState: () => void;
    loadGame: (saveId: string) => Promise<void>;
    loadLastSave: () => Promise<void>;
    saveGame: (slotName: string, summary?: string, thumbnail?: string) => Promise<void>;
    deleteSave: (saveId: string) => Promise<boolean>;
    getSaveRegistry: () => Promise<any>;
    getTacticalOptions: () => TacticalOption[];
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [engine, setEngine] = useState<GameLoop | null>(null);
    const [state, setState] = useState<GameState | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const processingRef = useRef(false);

    // Choose storage based on environment or settings
    const [storage] = useState<IStorageProvider>(new NetworkStorageProvider());

    const updateState = useCallback(() => {
        if (engine) {
            setState({ ...engine.getState() });
        }
    }, [engine]);

    const startGame = useCallback(async (initialState: GameState) => {
        setIsLoading(true);
        try {
            await DataManager.initialize();

            // Force-sync global settings (Dev Mode, Video, Audio) to the campaign state
            // This ensures that "system" preferences override what's in the save file
            const globalSettings = await SettingsManager.loadSettings();
            if (initialState.settings) {
                initialState.settings = SettingsManager.syncGlobalToCampaign(initialState.settings, globalSettings);
            } else {
                initialState.settings = globalSettings;
            }

            const newEngine = new GameLoop(initialState, '/', storage);
            await newEngine.initialize();

            setEngine(newEngine);
            setState(initialState);
            setIsActive(true);

            // Auto-trigger opening narration for new games (turn 0)
            if (initialState.worldTime.totalTurns === 0 && initialState.conversationHistory.length === 0) {
                console.log('[GameProvider] New game detected, triggering opening narration...');
                setIsLoading(true);
                // Use setTimeout to ensure state is set before processing
                setTimeout(async () => {
                    try {
                        await newEngine.processTurn('__OPENING_SCENE__');
                        setState({ ...newEngine.getState() });
                    } catch (e) {
                        console.error('[GameProvider] Failed to generate opening narration:', e);
                    } finally {
                        setIsLoading(false);
                    }
                }, 100);
            }
        } catch (e) {
            console.error('[GameProvider] Failed to start game:', e);
        } finally {
            setIsLoading(false);
        }
    }, [storage]);

    const endGame = useCallback(() => {
        setIsActive(false);
        setEngine(null);
        setState(null);
        setIsLoading(false);
    }, []);

    const processCommand = useCallback(async (command: string) => {
        if (!engine || processingRef.current) return;
        processingRef.current = true;
        setIsProcessing(true);
        // Safety timeout: unblock input after 60s even if LLM hangs
        const timeout = setTimeout(() => { processingRef.current = false; setIsProcessing(false); }, 60_000);
        try {
            await engine.processTurn(command);
        } finally {
            clearTimeout(timeout);
            processingRef.current = false;
            setIsProcessing(false);
        }
    }, [engine]);

    const loadGame = useCallback(async (saveId: string) => {
        setIsLoading(true);
        try {
            const manager = new GameStateManager('/', storage);
            const newState = await manager.loadGame(saveId);
            if (newState) {
                await startGame(newState);
            }
        } finally {
            setIsLoading(false);
        }
    }, [storage, startGame]);

    const loadLastSave = useCallback(async () => {
        const manager = new GameStateManager('/', storage);
        const registry = await manager.getSaveRegistry();
        if (registry.slots.length > 0) {
            // Sort by date to find the most recent
            const lastSave = [...registry.slots].sort((a, b) =>
                new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime()
            )[0];
            await loadGame(lastSave.id);
        }
    }, [storage, loadGame]);

    const saveGame = useCallback(async (slotName: string, summary?: string, thumbnail?: string) => {
        if (engine && state) {
            await engine.getStateManager().saveGame(state, slotName, summary, thumbnail);
            updateState();
        }
    }, [engine, state, updateState]);

    const deleteSave = useCallback(async (saveId: string) => {
        if (engine) {
            return await engine.getStateManager().deleteSave(saveId);
        }
        const manager = new GameStateManager('/', storage);
        return await manager.deleteSave(saveId);
    }, [engine, storage]);

    const getSaveRegistry = useCallback(async () => {
        const manager = new GameStateManager('/', storage);
        return await manager.getSaveRegistry();
    }, [storage]);

    const getTacticalOptions = useCallback((): TacticalOption[] => {
        if (!engine) return [];
        return engine.getTacticalOptions();
    }, [engine]);

    useEffect(() => {
        if (isActive && engine) {
            // Subscribe to engine state updates
            const unsubscribe = engine.subscribe((newState: GameState) => {
                setState({ ...newState });
            });

            // Initial state sync
            setState({ ...engine.getState() });

            return () => {
                unsubscribe();
            };
        }
    }, [isActive, engine]);

    return (
        <GameContext.Provider value={{
            state,
            engine,
            isActive,
            isLoading,
            isProcessing,
            startGame,
            endGame,
            processCommand,
            updateState,
            loadGame,
            loadLastSave,
            saveGame,
            deleteSave,
            getSaveRegistry,
            getTacticalOptions
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGameState = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameProvider');
    }
    return context;
};
