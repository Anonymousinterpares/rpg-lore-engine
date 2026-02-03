import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
const GameContext = createContext(undefined);
import { BrowserStorageProvider } from '../../ruleset/combat/BrowserStorageProvider';
export const GameProvider = ({ children, initialGameState }) => {
    const [engine] = useState(() => new GameLoop(initialGameState, '/', new BrowserStorageProvider()));
    const [state, setState] = useState(initialGameState);
    const updateState = useCallback(() => {
        setState({ ...engine.getState() });
    }, [engine]);
    const processCommand = useCallback(async (command) => {
        await engine.processTurn(command);
        updateState();
    }, [engine, updateState]);
    useEffect(() => {
        updateState();
    }, [updateState]);
    return (_jsx(GameContext.Provider, { value: { state, engine, processCommand, updateState }, children: children }));
};
export const useGameState = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameProvider');
    }
    return context;
};
