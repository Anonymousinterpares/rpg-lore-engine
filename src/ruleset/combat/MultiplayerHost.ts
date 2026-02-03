import express, { Request, Response } from 'express';
import {
    MultiplayerGameState,
    MultiplayerGameStateSchema,
    PlayerAction,
    PlayerActionSchema,
    ChatMessage,
    ChatMessageSchema
} from '../schemas/MultiplayerSchemas';
import { FullSaveState } from '../schemas/FullSaveStateSchema';
import { v4 as uuidv4 } from 'uuid';

export class MultiplayerHost {
    private app = express();
    private state: MultiplayerGameState;
    private port: number;

    constructor(initialState: FullSaveState, hostPlayerName: string, port: number = 3000) {
        this.port = port;
        this.app.use(express.json());

        const hostId = 'host-player';
        this.state = {
            sessionId: uuidv4(),
            turnNumber: 1,
            currentPlayerId: hostId,
            players: [{
                playerId: hostId,
                playerName: hostPlayerName,
                characterId: initialState.character.name,
                isConnected: true,
                lastSeen: new Date().toISOString()
            }],
            gameState: initialState,
            chatHistory: []
        };

        this.setupRoutes();
    }

    private setupRoutes() {
        // GET /state - Poll for current state
        this.app.get('/state', (req: Request, res: Response) => {
            res.json(this.state);
        });

        // POST /join - Join session
        this.app.post('/join', (req: Request, res: Response) => {
            const { playerName, characterId } = req.body;
            if (!playerName || !characterId) {
                return res.status(400).json({ error: "Missing playerName or characterId" });
            }

            const existingPlayer = this.state.players.find(p => p.playerName === playerName);
            if (existingPlayer) {
                existingPlayer.isConnected = true;
                existingPlayer.lastSeen = new Date().toISOString();
                return res.json({ playerId: existingPlayer.playerId });
            }

            const playerId = uuidv4();
            this.state.players.push({
                playerId,
                playerName,
                characterId,
                isConnected: true,
                lastSeen: new Date().toISOString()
            });

            this.addSystemMessage(`${playerName} has joined the session.`);
            res.json({ playerId });
        });

        // POST /action - Submit action
        this.app.post('/action', (req: Request, res: Response) => {
            try {
                const action: PlayerAction = PlayerActionSchema.parse(req.body);

                // Authoritative check: Is it this player's turn?
                if (action.playerId !== this.state.currentPlayerId) {
                    return res.status(403).json({ error: "Not your turn" });
                }

                this.applyAction(action);
                res.json({ success: true });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        // POST /chat - Send chat message
        this.app.post('/chat', (req: Request, res: Response) => {
            const { playerId, content } = req.body;
            const player = this.state.players.find(p => p.playerId === playerId);
            if (!player) return res.status(403).json({ error: "Unknown player" });

            const msg: ChatMessage = {
                messageId: uuidv4(),
                playerId,
                playerName: player.playerName,
                content,
                timestamp: new Date().toISOString(),
                type: 'player'
            };

            this.state.chatHistory.push(msg);
            if (this.state.chatHistory.length > 200) this.state.chatHistory.shift();
            res.json({ success: true });
        });
    }

    private applyAction(action: PlayerAction) {
        console.log(`Applying action ${action.actionType} from player ${action.playerId}`);

        // In a real implementation, we would call the relevant engine methods here
        // For now, we simulate the state update

        if (action.actionType === 'END_TURN' || action.actionType === 'PASS') {
            this.advanceTurn();
        }

        // Update the timestamp for the player
        const player = this.state.players.find(p => p.playerId === action.playerId);
        if (player) player.lastSeen = new Date().toISOString();
    }

    private advanceTurn() {
        this.state.turnNumber++;
        const currentIndex = this.state.players.findIndex(p => p.playerId === this.state.currentPlayerId);
        const nextIndex = (currentIndex + 1) % this.state.players.length;
        this.state.currentPlayerId = this.state.players[nextIndex].playerId;

        this.addSystemMessage(`Turn ${this.state.turnNumber} started. It's ${this.state.players[nextIndex].playerName}'s turn.`);
    }

    private addSystemMessage(content: string) {
        this.state.chatHistory.push({
            messageId: uuidv4(),
            playerId: 'system',
            playerName: 'Game',
            content,
            timestamp: new Date().toISOString(),
            type: 'system'
        });
    }

    public start() {
        this.app.listen(this.port, () => {
            console.log(`Multiplayer host started on port ${this.port}`);
            console.log(`Session ID: ${this.state.sessionId}`);
        });
    }
}
