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

const rootDir = __dirname;
const rootSavesDir = path.join(rootDir, 'saves');

// Helper to safely resolve paths to the local saves directory or root files
const resolvePath = (clientPath: string) => {
    // 1. Normalize slashes
    let normalized = clientPath.replace(/\\/g, '/');

    // 2. Strip leading slashes
    normalized = normalized.replace(/^\/+/, '');

    // 3. Special case for root-level settings.json
    if (normalized === 'settings.json') {
        return path.join(rootDir, 'settings.json');
    }

    // 4. Strip 'saves/' prefix if present (normalized for internal logic)
    if (normalized.startsWith('saves/')) {
        normalized = normalized.substring(6);
    }

    // 5. Join with saves root
    const resolvedPath = path.join(rootSavesDir, normalized);

    // Security: Prevent directory traversal (e.g. "../filename")
    const relative = path.relative(rootSavesDir, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Access denied: Invalid path');
    }

    return resolvedPath;
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

// --- Forged Item Catalog ---
const forgedDir = path.join(rootDir, 'data', 'item', 'forged');

app.post('/api/forged/persist', async (req, res) => {
    const { item } = req.body;
    if (!item || !item.name) {
        return res.status(400).json({ error: 'Missing item or item.name' });
    }

    try {
        // Ensure forged directory exists
        const fs = await import('fs');
        if (!fs.existsSync(forgedDir)) {
            fs.mkdirSync(forgedDir, { recursive: true });
        }

        // Sanitize filename
        const filename = item.name
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 100) + '.json';
        const filePath = path.join(forgedDir, filename);

        // Dedup: skip if already exists
        if (fs.existsSync(filePath)) {
            return res.json({ persisted: false, reason: 'duplicate' });
        }

        fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf-8');
        console.log(`[Server] Forged item persisted: ${filename}`);
        res.json({ persisted: true, filename });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.listen(port, () => {
    console.log(`[RPG Backend] Server running at http://localhost:${port}`);
    console.log(`[RPG Backend] Saves directory: ${rootSavesDir}`);
});
