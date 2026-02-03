import { useCallback } from 'react';
import { useGameState } from './useGameState';

export const useActions = () => {
    const { processCommand } = useGameState();

    const move = useCallback((direction: string) => {
        return processCommand(`/move ${direction}`);
    }, [processCommand]);

    const attack = useCallback((targetId?: string) => {
        const cmd = targetId ? `/attack ${targetId}` : '/attack';
        return processCommand(cmd);
    }, [processCommand]);

    const rest = useCallback((isLong: boolean = false) => {
        const cmd = isLong ? '/rest long' : '/rest';
        return processCommand(cmd);
    }, [processCommand]);

    const gather = useCallback((nodeId: string) => {
        return processCommand(`/gather ${nodeId}`);
    }, [processCommand]);

    const talk = useCallback((npcId: string) => {
        return processCommand(`/talk ${npcId}`);
    }, [processCommand]);

    const craft = useCallback((recipeId: string) => {
        return processCommand(`/craft ${recipeId}`);
    }, [processCommand]);

    const useItem = useCallback((itemId: string) => {
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
