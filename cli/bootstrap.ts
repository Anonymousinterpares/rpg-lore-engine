/**
 * bootstrap.ts — Node.js environment setup for the RPG engine
 *
 * 1. Shims localStorage (used by AgentManager, LLMClient, SettingsManager)
 * 2. Patches DataManager with fs-based data loading
 * 3. Resolves project root path
 */

import * as path from 'path';
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
 * Full bootstrap: shims + data loading.
 * Call this once at the start of any CLI entry point.
 */
export async function bootstrapCLI(projectRoot?: string): Promise<string> {
    const root = projectRoot || getProjectRoot();
    await patchDataManagerForNode(root);
    return root;
}
