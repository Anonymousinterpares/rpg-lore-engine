import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
import { BrowserStorageProvider } from '../../ruleset/combat/BrowserStorageProvider';
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
    const startGame = useCallback((initialState) => {
        const newEngine = new GameLoop(initialState, '/', new BrowserStorageProvider());
        setEngine(newEngine);
        setState(initialState);
        setIsActive(true);
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
