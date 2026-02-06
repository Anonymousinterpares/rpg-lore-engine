import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
import { GameState } from '../../ruleset/combat/GameStateManager';
import { BrowserStorageProvider } from '../../ruleset/combat/BrowserStorageProvider';
import { DataManager } from '../../ruleset/data/DataManager';

interface GameContextType {
    state: GameState | null;
    engine: GameLoop | null;
    isActive: boolean;
    startGame: (initialState: GameState) => void;
    endGame: () => void;
    processCommand: (command: string) => Promise<void>;
    updateState: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [engine, setEngine] = useState<GameLoop | null>(null);
    const [state, setState] = useState<GameState | null>(null);
    const [isActive, setIsActive] = useState(false);

    const updateState = useCallback(() => {
        if (engine) {
            setState({ ...engine.getState() });
        }
    }, [engine]);

    const startGame = useCallback(async (initialState: GameState) => {
        DataManager.initialize();
        const newEngine = new GameLoop(initialState, '/', new BrowserStorageProvider());
        setEngine(newEngine);
        setState(initialState);
        setIsActive(true);

        // Auto-trigger opening narration for new games (turn 0)
        if (initialState.worldTime.totalTurns === 0 && initialState.conversationHistory.length === 0) {
            console.log('[GameProvider] New game detected, triggering opening narration...');
            // Use setTimeout to ensure state is set before processing
            setTimeout(async () => {
                try {
                    await newEngine.processTurn('__OPENING_SCENE__');
                    setState({ ...newEngine.getState() });
                } catch (e) {
                    console.error('[GameProvider] Failed to generate opening narration:', e);
                }
            }, 100);
        }
    }, []);

    const endGame = useCallback(() => {
        setIsActive(false);
        setEngine(null);
        setState(null);
    }, []);

    const processCommand = useCallback(async (command: string) => {
        if (!engine) return;
        await engine.processTurn(command);
        updateState();
    }, [engine, updateState]);

    useEffect(() => {
        if (isActive && engine) {
            updateState();
        }
    }, [isActive, engine, updateState]);

    return (
        <GameContext.Provider value={{
            state,
            engine,
            isActive,
            startGame,
            endGame,
            processCommand,
            updateState
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
