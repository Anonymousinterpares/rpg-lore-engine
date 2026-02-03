export class MultiplayerClient {
    hostEndpoint;
    playerId;
    playerName;
    constructor(hostEndpoint) {
        this.hostEndpoint = hostEndpoint.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Joins a multiplayer session
     */
    async join(playerName, characterId) {
        const response = await fetch(`${this.hostEndpoint}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, characterId })
        });
        if (!response.ok) {
            throw new Error(`Failed to join session: ${response.statusText}`);
        }
        const data = await response.json();
        this.playerId = data.playerId;
        this.playerName = playerName;
        return this.playerId;
    }
    /**
     * Polls the host for the current game state
     */
    async getState() {
        const response = await fetch(`${this.hostEndpoint}/state`);
        if (!response.ok) {
            throw new Error(`Failed to fetch state: ${response.statusText}`);
        }
        return await response.json();
    }
    /**
     * Submits an action to the host
     */
    async submitAction(action) {
        if (!this.playerId)
            throw new Error("Not joined to a session");
        const fullAction = {
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
            const error = await response.json();
            throw new Error(`Action failed: ${error.error}`);
        }
    }
    /**
     * Sends a chat message
     */
    async sendChat(content) {
        if (!this.playerId)
            throw new Error("Not joined to a session");
        const response = await fetch(`${this.hostEndpoint}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: this.playerId, content })
        });
        if (!response.ok) {
            throw new Error(`Failed to send chat: ${response.statusText}`);
        }
    }
    getPlayerId() {
        return this.playerId;
    }
}
