import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
import { GameState } from '../../ruleset/combat/GameStateManager';
import { NetworkStorageProvider } from '../../ruleset/combat/NetworkStorageProvider';
import { IStorageProvider } from '../../ruleset/combat/IStorageProvider';
import { DataManager } from '../../ruleset/data/DataManager';
import { TacticalOption } from '../../ruleset/combat/grid/CombatAnalysisEngine';

interface GameContextType {
    state: GameState | null;
    engine: GameLoop | null;
    isActive: boolean;
    isLoading: boolean;
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
        if (!engine) return;
        try {
            await engine.processTurn(command);
            // No need for updateState() here anymore as the engine will notify us via subscription
        } finally {
            // No global loading screen for regular commands
        }
    }, [engine]);

    const loadGame = useCallback(async (saveId: string) => {
        setIsLoading(true);
        try {
            const tempEngine = new GameLoop(state || ({} as GameState), '/', storage);
            await tempEngine.initialize();
            const newState = await tempEngine.getStateManager().loadGame(saveId);
            if (newState) {
                await startGame(newState);
            }
        } finally {
            setIsLoading(false);
        }
    }, [state, storage, startGame]);

    const loadLastSave = useCallback(async () => {
        const tempEngine = new GameLoop(state || ({} as GameState), '/', storage);
        await tempEngine.initialize();
        const registry = await tempEngine.getStateManager().getSaveRegistry();
        if (registry.slots.length > 0) {
            // Sort by date to find the most recent
            const lastSave = [...registry.slots].sort((a, b) =>
                new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime()
            )[0];
            await loadGame(lastSave.id);
        }
    }, [state, storage, loadGame]);

    const saveGame = useCallback(async (slotName: string, summary?: string, thumbnail?: string) => {
        if (engine && state) {
            await engine.getStateManager().saveGame(state, slotName, summary, thumbnail);
            updateState();
        }
    }, [engine, state, updateState]);

    const deleteSave = useCallback(async (saveId: string) => {
        const tempEngine = engine || new GameLoop(state || ({} as GameState), '/', storage);
        if (!engine) await tempEngine.initialize();
        return await tempEngine.getStateManager().deleteSave(saveId);
    }, [engine, state, storage]);

    const getSaveRegistry = useCallback(async () => {
        const tempEngine = new GameLoop(state || ({} as GameState), '/', storage);
        await tempEngine.initialize();
        return await tempEngine.getStateManager().getSaveRegistry();
    }, [state, storage]);

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
