import { useState, useCallback, useEffect } from 'react';
import { MultiplayerClient } from '../../ruleset/combat/MultiplayerClient';

export const useMultiplayer = (lobbyUrl: string = 'http://localhost:4000') => {
    const [client, setClient] = useState<MultiplayerClient | null>(null);
    const [lobbies, setLobbies] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshLobbies = useCallback(async () => {
        try {
            const response = await fetch(`${lobbyUrl}/sessions`);
            if (!response.ok) throw new Error('Failed to fetch sessions');
            const list = await response.json();
            setLobbies(list);
        } catch (err) {
            setError('Failed to fetch lobbies');
        }
    }, [lobbyUrl]);

    const hostSession = useCallback(async (name: string, playerId: string) => {
        try {
            // For now, hosting just means registering on the lobby server
            const sessionId = Math.random().toString(36).substr(2, 9);
            const response = await fetch(`${lobbyUrl}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    sessionName: name,
                    hostPlayerId: playerId,
                    playerCount: 1,
                    maxPlayers: 4,
                    lastPing: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error('Failed to register session');

            const newClient = new MultiplayerClient(lobbyUrl);
            setClient(newClient);
            setIsConnected(true);
            return sessionId;
        } catch (err) {
            setError('Failed to host session');
            return null;
        }
    }, [lobbyUrl]);

    const joinSession = useCallback(async (sessionId: string, playerName: string, characterId: string) => {
        try {
            const newClient = new MultiplayerClient(lobbyUrl);
            await newClient.join(playerName, characterId);
            setClient(newClient);
            setIsConnected(true);
        } catch (err) {
            setError('Failed to join session');
        }
    }, [lobbyUrl]);

    const leaveSession = useCallback(() => {
        setClient(null);
        setIsConnected(false);
    }, []);

    useEffect(() => {
        refreshLobbies();
    }, [refreshLobbies]);

    return {
        client,
        lobbies,
        isConnected,
        error,
        refreshLobbies,
        hostSession,
        joinSession,
        leaveSession
    };
};
