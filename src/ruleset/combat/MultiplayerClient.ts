import { MultiplayerGameState, PlayerAction, ChatMessage } from '../schemas/MultiplayerSchemas';

export class MultiplayerClient {
    private hostEndpoint: string;
    private playerId?: string;
    private playerName?: string;

    constructor(hostEndpoint: string) {
        this.hostEndpoint = hostEndpoint.replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Joins a multiplayer session
     */
    public async join(playerName: string, characterId: string): Promise<string> {
        const response = await fetch(`${this.hostEndpoint}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, characterId })
        });

        if (!response.ok) {
            throw new Error(`Failed to join session: ${response.statusText}`);
        }

        const data = await response.json() as { playerId: string };
        this.playerId = data.playerId;
        this.playerName = playerName;
        return this.playerId;
    }

    /**
     * Polls the host for the current game state
     */
    public async getState(): Promise<MultiplayerGameState> {
        const response = await fetch(`${this.hostEndpoint}/state`);
        if (!response.ok) {
            throw new Error(`Failed to fetch state: ${response.statusText}`);
        }

        return await response.json() as MultiplayerGameState;
    }

    /**
     * Submits an action to the host
     */
    public async submitAction(action: Omit<PlayerAction, 'playerId' | 'actionId'>): Promise<void> {
        if (!this.playerId) throw new Error("Not joined to a session");

        const fullAction: PlayerAction = {
            ...action,
            playerId: this.playerId,
            actionId: Math.random().toString(36).substr(2, 9) // Simple ID for now
        };

        const response = await fetch(`${this.hostEndpoint}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullAction)
        });

        if (!response.ok) {
            const error = await response.json() as { error: string };
            throw new Error(`Action failed: ${error.error}`);
        }
    }

    /**
     * Sends a chat message
     */
    public async sendChat(content: string): Promise<void> {
        if (!this.playerId) throw new Error("Not joined to a session");

        const response = await fetch(`${this.hostEndpoint}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: this.playerId, content })
        });

        if (!response.ok) {
            throw new Error(`Failed to send chat: ${response.statusText}`);
        }
    }

    public getPlayerId(): string | undefined {
        return this.playerId;
    }
}
