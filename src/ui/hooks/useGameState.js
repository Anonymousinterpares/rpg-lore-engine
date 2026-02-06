import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
import { BrowserStorageProvider } from '../../ruleset/combat/BrowserStorageProvider';
import { DataManager } from '../../ruleset/data/DataManager';
const GameContext = createContext(undefined);
export const GameProvider = ({ children }) => {
    const [engine, setEngine] = useState(null);
    const [state, setState] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const updateState = useCallback(() => {
        if (engine) {
            setState({ ...engine.getState() });
        }
    }, [engine]);
    const startGame = useCallback(async (initialState) => {
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
                }
                catch (e) {
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
    const processCommand = useCallback(async (command) => {
        if (!engine)
            return;
        await engine.processTurn(command);
        updateState();
    }, [engine, updateState]);
    useEffect(() => {
        if (isActive && engine) {
            updateState();
        }
    }, [isActive, engine, updateState]);
    return (_jsx(GameContext.Provider, { value: {
            state,
            engine,
            isActive,
            startGame,
            endGame,
            processCommand,
            updateState
        }, children: children }));
};
export const useGameState = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameProvider');
    }
    return context;
};
