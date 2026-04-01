/**
 * ForgedItemCatalog — Handles persistence of Rare+ forged items to disk.
 *
 * Items written to `data/item/forged/` become part of the permanent item database,
 * available as potential loot/shop items in all future sessions.
 *
 * Deduplication by name prevents file collisions.
 */

import { DataManager } from './DataManager';
import { Item } from '../schemas/ItemSchema';

/** Module-level project root — set by CLI bootstrap or server init */
let _projectRoot: string | null = null;

export function setProjectRoot(root: string): void {
    _projectRoot = root;
}

export function getProjectRoot(): string | null {
    return _projectRoot;
}

/**
 * Sanitizes an item name into a safe filename.
 * "Rare Necrotic Longsword +2" → "Rare_Necrotic_Longsword_+2.json"
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '')  // Remove filesystem-unsafe chars
        .replace(/\s+/g, '_')
        .slice(0, 100) // Cap length
        + '.json';
}

// Rarities eligible for persistence
const PERSIST_RARITIES = ['Rare', 'Very Rare', 'Legendary'];

/**
 * Checks if an item should be persisted to the catalog.
 * Uses trueRarity (not perceived) for the check.
 */
export function shouldPersist(item: any): boolean {
    const effectiveRarity = item.trueRarity || item.rarity;
    return item.isForged === true && PERSIST_RARITIES.includes(effectiveRarity);
}

/**
 * Builds a clean item object for persistence using TRUE values (not perceived).
 * The saved file represents the fully identified item.
 */
function buildPersistedItem(item: any): any {
    const trueName = item.trueName || item.name;
    const trueRarity = item.trueRarity || item.rarity;
    // Recalculate true cost based on true rarity
    const baseGp = item._baseCostGp || item.cost?.gp || 0;
    return {
        name: trueName,
        type: item.type,
        cost: item.cost,
        weight: item.weight,
        description: item.description,
        isMagic: item.isMagic || false,
        modifiers: item.modifiers || [],
        tags: item.tags || [],
        quantity: 1,
        rarity: trueRarity,
        itemLevel: item.itemLevel,
        isForged: true,
        forgeSource: item.forgeSource,
        magicalProperties: item.magicalProperties || [],
        // Weapon fields (if present)
        ...(item.damage ? { damage: item.damage } : {}),
        ...(item.properties ? { properties: item.properties } : {}),
        ...(item.range ? { range: item.range } : {}),
        // Armor fields (if present)
        ...(item.acCalculated ? { acCalculated: item.acCalculated } : {}),
        ...(item.strengthReq ? { strengthReq: item.strengthReq } : {}),
        ...(item.stealthDisadvantage ? { stealthDisadvantage: item.stealthDisadvantage } : {}),
        ...(item.acBonus !== undefined ? { acBonus: item.acBonus } : {}),
    };
}

/**
 * Writes a forged item to disk and registers it in DataManager.
 * In Node.js (CLI): writes directly via fs.
 * In browser: sends HTTP POST to the Express server endpoint.
 */
export async function persistForgedItem(item: any, projectRoot: string): Promise<boolean> {
    if (!shouldPersist(item)) return false;

    // Deduplication: skip if true name already in DataManager
    const trueName = item.trueName || item.name;
    if (DataManager.getItem(trueName)) {
        return false;
    }

    const persistedItem = buildPersistedItem(item);
    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
        return persistViaBrowser(persistedItem);
    } else {
        return persistViaFS(persistedItem, projectRoot);
    }
}

/**
 * Browser path: POST to Express server /api/forged/persist
 */
async function persistViaBrowser(item: any): Promise<boolean> {
    try {
        console.log(`[ForgedItemCatalog] Persisting via server: ${item.name}...`);
        const response = await fetch('http://localhost:3001/api/forged/persist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item }),
        });
        const result = await response.json();

        if (result.persisted) {
            DataManager.registerItem(item as Item);
            console.log(`[ForgedItemCatalog] Persisted via server: ${item.name}`);
            return true;
        }
        return false;
    } catch (e) {
        console.warn(`[ForgedItemCatalog] Server persist failed:`, (e as Error).message);
        return false;
    }
}

/**
 * Node.js/CLI path: write directly via fs
 */
async function persistViaFS(item: any, projectRoot: string): Promise<boolean> {
    try {
        const fs = await import('fs');
        const path = await import('path');

        const forgedDir = path.join(projectRoot, 'data', 'item', 'forged');

        if (!fs.existsSync(forgedDir)) {
            fs.mkdirSync(forgedDir, { recursive: true });
        }

        const filename = sanitizeFilename(item.name);
        const filePath = path.join(forgedDir, filename);

        if (fs.existsSync(filePath)) {
            return false;
        }

        fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf-8');

        DataManager.registerItem(item as Item);

        console.log(`[ForgedItemCatalog] Persisted: ${item.name} → ${filename}`);
        return true;
    } catch (e) {
        console.warn(`[ForgedItemCatalog] FS persist failed:`, (e as Error).message);
        return false;
    }
}

/**
 * Convenience: persist using the stored projectRoot (CLI) or HTTP (browser).
 */
export async function tryPersistForgedItem(item: any): Promise<boolean> {
    if (!shouldPersist(item)) return false;
    const trueName = item.trueName || item.name;
    if (DataManager.getItem(trueName)) return false;

    const isBrowser = typeof window !== 'undefined';
    const persistedItem = buildPersistedItem(item);

    if (isBrowser) {
        return persistViaBrowser(persistedItem);
    } else if (_projectRoot) {
        return persistViaFS(persistedItem, _projectRoot);
    }
    return false;
}

/**
 * Loads all forged items from `data/item/forged/` and registers them in DataManager.
 * Called during CLI bootstrap. Uses dynamic import for ESM compatibility.
 */
export async function loadForgedItems(projectRoot: string): Promise<number> {
    try {
        const fs = await import('fs');
        const pathMod = await import('path');

        const forgedDir = pathMod.join(projectRoot, 'data', 'item', 'forged');
        if (!fs.existsSync(forgedDir)) return 0;

        const files = fs.readdirSync(forgedDir).filter((f: string) => f.endsWith('.json'));
        let count = 0;

        for (const file of files) {
            try {
                const raw = fs.readFileSync(pathMod.join(forgedDir, file), 'utf-8');
                const item = JSON.parse(raw);
                if (item.name) {
                    DataManager.registerItem(item);
                    count++;
                }
            } catch (e) {
                console.warn(`[ForgedItemCatalog] Failed to load ${file}:`, (e as Error).message);
            }
        }

        if (count > 0) {
            console.log(`[ForgedItemCatalog] Loaded ${count} forged items from catalog`);
        }
        return count;
    } catch {
        // Not in Node.js context
        return 0;
    }
}
