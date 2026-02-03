import { useCallback } from 'react';
import { useGameState } from './useGameState';
export const useActions = () => {
    const { processCommand } = useGameState();
    const move = useCallback((direction) => {
        return processCommand(`/move ${direction}`);
    }, [processCommand]);
    const attack = useCallback((targetId) => {
        const cmd = targetId ? `/attack ${targetId}` : '/attack';
        return processCommand(cmd);
    }, [processCommand]);
    const rest = useCallback((isLong = false) => {
        const cmd = isLong ? '/rest long' : '/rest';
        return processCommand(cmd);
    }, [processCommand]);
    const gather = useCallback((nodeId) => {
        return processCommand(`/gather ${nodeId}`);
    }, [processCommand]);
    const talk = useCallback((npcId) => {
        return processCommand(`/talk ${npcId}`);
    }, [processCommand]);
    const craft = useCallback((recipeId) => {
        return processCommand(`/craft ${recipeId}`);
    }, [processCommand]);
    const useItem = useCallback((itemId) => {
        return processCommand(`/use ${itemId}`);
    }, [processCommand]);
    return {
        move,
        attack,
        rest,
        gather,
        talk,
        craft,
        useItem
    };
};
