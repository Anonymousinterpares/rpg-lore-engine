/**
 * DataManagerCLI — Node.js-compatible data loader
 *
 * Replaces Vite's import.meta.glob() with fs-based JSON loading.
 * Monkey-patches DataManager's private static fields so all existing
 * engine code works unchanged.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DataManager } from '../src/ruleset/data/DataManager';

function loadJsonDir(dir: string): any[] {
    if (!fs.existsSync(dir)) {
        console.warn(`[DataManagerCLI] Directory not found: ${dir}`);
        return [];
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const results: any[] = [];
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
            results.push(JSON.parse(raw));
        } catch (e) {
            console.warn(`[DataManagerCLI] Failed to load ${path.join(dir, file)}:`, (e as Error).message);
        }
    }
    return results;
}

export async function patchDataManagerForNode(projectRoot: string): Promise<{
    races: number;
    classes: number;
    backgrounds: number;
    items: number;
    spells: number;
    monsters: number;
    hasBiomeMapping: boolean;
}> {
    const dataDir = path.join(projectRoot, 'data');
    const dm = DataManager as any;

    // Prevent double-init
    if (dm.initialized) {
        return {
            races: Object.keys(dm.races).length,
            classes: Object.keys(dm.classes).length,
            backgrounds: Object.keys(dm.backgrounds).length,
            items: Object.keys(dm.items).length,
            spells: Object.keys(dm.spells).length,
            monsters: Object.keys(dm.monsters).length,
            hasBiomeMapping: Object.keys(dm.monsterMapping).length > 0
        };
    }

    // --- Load Races ---
    const races: Record<string, any> = {};
    for (const race of loadJsonDir(path.join(dataDir, 'race'))) {
        if (race.name) {
            races[race.name] = race;
        }
    }
    dm.races = races;

    // --- Load Classes ---
    const classes: Record<string, any> = {};
    for (const cls of loadJsonDir(path.join(dataDir, 'class'))) {
        if (cls.name) {
            classes[cls.name] = cls;
        }
    }
    dm.classes = classes;

    // --- Load Backgrounds ---
    const backgrounds: Record<string, any> = {};
    for (const bg of loadJsonDir(path.join(dataDir, 'backgrounds'))) {
        if (bg.name) {
            backgrounds[bg.name] = bg;
        }
    }
    dm.backgrounds = backgrounds;

    // --- Load Items (with triple-key indexing matching original DataManager) ---
    const items: Record<string, any> = {};
    for (const item of loadJsonDir(path.join(dataDir, 'item'))) {
        if (item.name) {
            // Inject defaults matching original lines 78-83
            if (!item.id) {
                item.id = item.name.toLowerCase().replace(/\s+/g, '_');
            }
            if (item.quantity === undefined) {
                item.quantity = 1;
            }
            items[item.name] = item;
            items[item.name.toLowerCase()] = item;
            items[item.name.toLowerCase().replace(/ /g, '_')] = item;
        }
    }
    dm.items = items;

    // --- Load Spells (with dual-key indexing) ---
    const spells: Record<string, any> = {};
    const spellLookup: Record<string, any> = {};
    for (const spell of loadJsonDir(path.join(dataDir, 'spell'))) {
        if (spell.name) {
            spells[spell.name] = spell;
            spellLookup[spell.name.toLowerCase()] = spell;
        }
    }
    dm.spells = spells;
    dm.spellLookup = spellLookup;

    // --- Load Monsters (with dual-key indexing) ---
    const monsters: Record<string, any> = {};
    const monsterLookup: Record<string, any> = {};
    for (const monster of loadJsonDir(path.join(dataDir, 'monster'))) {
        if (monster.name) {
            monsters[monster.name] = monster;
            monsterLookup[monster.name.toLowerCase()] = monster;
        }
    }
    dm.monsters = monsters;
    dm.monsterLookup = monsterLookup;

    // --- Load Biome-Monster Mapping ---
    const mappingPath = path.join(dataDir, 'mappings', 'biome_monster_mapping.json');
    if (fs.existsSync(mappingPath)) {
        try {
            dm.monsterMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
        } catch (e) {
            console.warn('[DataManagerCLI] Failed to load biome_monster_mapping.json:', (e as Error).message);
            dm.monsterMapping = {};
        }
    } else {
        dm.monsterMapping = {};
    }

    // Mark as initialized so original DataManager.initialize() becomes a no-op
    dm.initialized = true;

    const uniqueItemCount = loadJsonDir(path.join(dataDir, 'item')).length;

    console.log(`[DataManagerCLI] Loaded: ${Object.keys(races).length} races, ${Object.keys(classes).length} classes, ${Object.keys(backgrounds).length} backgrounds, ${uniqueItemCount} items, ${Object.keys(spells).length} spells, ${Object.keys(monsters).length} monsters`);

    return {
        races: Object.keys(races).length,
        classes: Object.keys(classes).length,
        backgrounds: Object.keys(backgrounds).length,
        items: uniqueItemCount,
        spells: Object.keys(spells).length,
        monsters: Object.keys(monsters).length,
        hasBiomeMapping: Object.keys(dm.monsterMapping).length > 0
    };
}
