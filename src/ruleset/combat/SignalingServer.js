import express from 'express';
import { SessionInfoSchema } from '../schemas/MultiplayerSchemas';
export class SignalingServer {
    app = express();
    sessions = new Map();
    port;
    constructor(port = 4000) {
        this.port = port;
        this.app.use(express.json());
        this.setupRoutes();
        // Cleanup expired sessions every minute
        setInterval(() => this.cleanupSessions(), 60000);
    }
    setupRoutes() {
        // GET /sessions - List all active sessions
        this.app.get('/sessions', (req, res) => {
            res.json(Array.from(this.sessions.values()));
        });
        // POST /sessions - Register or update a session
        this.app.post('/sessions', (req, res) => {
            try {
                const session = SessionInfoSchema.parse(req.body);
                this.sessions.set(session.sessionId, {
                    ...session,
                    lastPing: new Date().toISOString()
                });
                res.json({ success: true });
            }
            catch (err) {
                res.status(400).json({ error: err.message });
            }
        });
        // DELETE /sessions/:id - Remove a session
        this.app.delete('/sessions/:id', (req, res) => {
            const id = req.params.id;
            if (typeof id === 'string') {
                this.sessions.delete(id);
            }
            res.json({ success: true });
        });
    }
    cleanupSessions() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            const lastPing = new Date(session.lastPing).getTime();
            if (now - lastPing > 300000) { // 5 minutes timeout
                console.log(`Removing expired session ${id}`);
                this.sessions.delete(id);
            }
        }
    }
    start() {
        this.app.listen(this.port, () => {
            console.log(`Signaling server (Lobby) started on port ${this.port}`);
        });
    }
}
