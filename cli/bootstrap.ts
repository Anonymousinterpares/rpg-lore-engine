/**
 * bootstrap.ts — Node.js environment setup for the RPG engine
 *
 * 1. Shims localStorage (used by AgentManager, LLMClient, SettingsManager)
 * 2. Patches DataManager with fs-based data loading
 * 3. Resolves project root path
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { patchDataManagerForNode } from './DataManagerCLI';

// --- localStorage shim ---
const storage = new Map<string, string>();
const localStorageShim = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (index: number) => [...storage.keys()][index] ?? null,
};
(globalThis as any).localStorage = localStorageShim;

/**
 * Resolves the project root directory (where package.json lives).
 */
export function getProjectRoot(): string {
    // cli/ is one level below project root
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..');
}

/**
 * Loads .env file from project root into process.env.
 * Simple parser: KEY=VALUE lines, ignores comments and blank lines.
 */
function loadEnvFile(rootDir: string): void {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

/**
 * Full bootstrap: shims + .env loading + data loading.
 * Call this once at the start of any CLI entry point.
 */
export async function bootstrapCLI(projectRoot?: string): Promise<string> {
    const root = projectRoot || getProjectRoot();
    loadEnvFile(root);
    await patchDataManagerForNode(root);
    return root;
}
