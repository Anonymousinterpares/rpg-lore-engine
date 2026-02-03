import express, { Request, Response } from 'express';
import { SessionInfo, SessionInfoSchema } from '../schemas/MultiplayerSchemas';

export class SignalingServer {
    private app = express();
    private sessions: Map<string, SessionInfo> = new Map();
    private port: number;

    constructor(port: number = 4000) {
        this.port = port;
        this.app.use(express.json());
        this.setupRoutes();

        // Cleanup expired sessions every minute
        setInterval(() => this.cleanupSessions(), 60000);
    }

    private setupRoutes() {
        // GET /sessions - List all active sessions
        this.app.get('/sessions', (req: Request, res: Response) => {
            res.json(Array.from(this.sessions.values()));
        });

        // POST /sessions - Register or update a session
        this.app.post('/sessions', (req: Request, res: Response) => {
            try {
                const session: SessionInfo = SessionInfoSchema.parse(req.body);
                this.sessions.set(session.sessionId, {
                    ...session,
                    lastPing: new Date().toISOString()
                });
                res.json({ success: true });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        // DELETE /sessions/:id - Remove a session
        this.app.delete('/sessions/:id', (req: Request, res: Response) => {
            const id = req.params.id;
            if (typeof id === 'string') {
                this.sessions.delete(id);
            }
            res.json({ success: true });
        });
    }

    private cleanupSessions() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            const lastPing = new Date(session.lastPing).getTime();
            if (now - lastPing > 300000) { // 5 minutes timeout
                console.log(`Removing expired session ${id}`);
                this.sessions.delete(id);
            }
        }
    }

    public start() {
        this.app.listen(this.port, () => {
            console.log(`Signaling server (Lobby) started on port ${this.port}`);
        });
    }
}
