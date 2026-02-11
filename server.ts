import express from 'express';
import * as path from 'path';
import { FileStorageProvider } from './src/ruleset/combat/FileStorageProvider';

import { fileURLToPath } from 'url';

const app = express();
const port = 3001;
const storage = new FileStorageProvider();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '50mb' }));

// Simple CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const rootSavesDir = path.join(__dirname, 'saves');

// Helper to safely resolve paths to the local saves directory
const resolvePath = (clientPath: string) => {
    // 1. Normalize slashes
    let normalized = clientPath.replace(/\\/g, '/');

    // 2. Strip leading slashes and 'saves/' prefix if present
    // This allows the client to send "/saves/file.json" or just "file.json"
    normalized = normalized.replace(/^\/+/, '');
    if (normalized.startsWith('saves/')) {
        normalized = normalized.substring(6);
    }

    // 3. Join with local root
    return path.join(rootSavesDir, normalized);
};

app.post('/api/exists', async (req, res) => {
    const { path: filePath } = req.body;
    const absolutePath = resolvePath(filePath);
    const exists = await storage.exists(absolutePath);
    res.json({ exists });
});

app.post('/api/read', async (req, res) => {
    const { path: filePath } = req.body;
    const absolutePath = resolvePath(filePath);
    try {
        const content = await storage.read(absolutePath);
        res.json({ content });
    } catch (e) {
        res.status(404).json({ error: (e as Error).message });
    }
});

app.post('/api/write', async (req, res) => {
    const { path: filePath, data } = req.body;
    const absolutePath = resolvePath(filePath);
    try {
        await storage.write(absolutePath, data);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.post('/api/mkdir', async (req, res) => {
    const { path: dirPath } = req.body;
    const absolutePath = resolvePath(dirPath);
    try {
        await storage.mkdir(absolutePath);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.listen(port, () => {
    console.log(`[RPG Backend] Server running at http://localhost:${port}`);
    console.log(`[RPG Backend] Saves directory: ${rootSavesDir}`);
});
