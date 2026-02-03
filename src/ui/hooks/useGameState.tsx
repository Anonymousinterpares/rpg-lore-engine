import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GameLoop } from '../../ruleset/combat/GameLoop';
import { GameState } from '../../ruleset/combat/GameStateManager';

interface GameContextType {
    state: GameState | null;
    engine: GameLoop | null;
    processCommand: (command: string) => Promise<void>;
    updateState: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode; initialGameState: GameState }> = ({ children, initialGameState }) => {
    const [engine] = useState(() => new GameLoop(initialGameState));
    const [state, setState] = useState<GameState>(initialGameState);

    const updateState = useCallback(() => {
        setState({ ...engine.getState() });
    }, [engine]);

    const processCommand = useCallback(async (command: string) => {
        await engine.processTurn(command);
        updateState();
    }, [engine, updateState]);

    useEffect(() => {
        updateState();
    }, [updateState]);

    return (
        <GameContext.Provider value={{ state, engine, processCommand, updateState }}>
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
