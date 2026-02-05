import { Race } from '../schemas/RaceSchema';
import { CharacterClass } from '../schemas/ClassSchema';
import { Background } from '../schemas/BackgroundSchema';
import { Item } from '../schemas/ItemSchema';
import { Spell } from '../schemas/SpellSchema';

/**
 * DataManager
 * 
 * Responsible for loading and serving static game data (Races, Classes, Backgrounds)
 * from the JSON files in the /data directory.
 * 
 * Uses Vite's import.meta.glob for efficient bundling and loading.
 */
export class DataManager {
    private static races: Record<string, Race> = {};
    private static classes: Record<string, CharacterClass> = {};
    private static backgrounds: Record<string, Background> = {};
    private static items: Record<string, Item> = {}; // Keyed by Lowercase Name/ID for flexible lookup
    private static initialized = false;

    public static async initialize() {
        if (this.initialized) return;

        // Load Races
        const raceModules = import.meta.glob('../../../data/race/*.json');
        for (const path in raceModules) {
            const mod: any = await raceModules[path]();
            // Default export or the JSON object itself
            const race = mod.default || mod;
            if (race.name) {
                this.races[race.name] = race;
            }
        }

        // Load Classes
        const classModules = import.meta.glob('../../../data/class/*.json');
        for (const path in classModules) {
            const mod: any = await classModules[path]();
            const cls = mod.default || mod;
            if (cls.name) {
                this.classes[cls.name] = cls;
            }
        }

        // Load Backgrounds
        const bgModules = import.meta.glob('../../../data/backgrounds/*.json');
        for (const path in bgModules) {
            const mod: any = await bgModules[path]();
            const bg = mod.default || mod;
            // Backgrounds use 'id' or 'name' as key? Schema has 'id' and 'name'.
            // Let's use 'name' for display consistency, or 'id' for internal reference.
            // Using Name for now as it matches directory keying usually.
            if (bg.name) {
                this.backgrounds[bg.name] = bg;
            }
        }

        // Load Items
        const itemModules = import.meta.glob('../../../data/item/*.json');
        for (const path in itemModules) {
            const mod: any = await itemModules[path]();
            const item = mod.default || mod;
            if (item.name) {
                // Index by name
                this.items[item.name] = item;
                // Index by lowercase name (and potential ID format)
                this.items[item.name.toLowerCase()] = item;
                this.items[item.name.toLowerCase().replace(/ /g, '_')] = item;
            }
        }

        this.initialized = true;
        console.log(`[DataManager] Initialized with ${Object.keys(this.races).length} Races, ${Object.keys(this.classes).length} Classes, ${Object.keys(this.backgrounds).length} Backgrounds, ${Object.keys(this.items).length} Items (indexed).`);
    }

    public static getRaces(): Race[] {
        return Object.values(this.races);
    }

    public static getClasses(): CharacterClass[] {
        return Object.values(this.classes);
    }

    public static getBackgrounds(): Background[] {
        return Object.values(this.backgrounds);
    }

    public static getRace(name: string): Race | undefined {
        return this.races[name];
    }

    public static getClass(name: string): CharacterClass | undefined {
        return this.classes[name];
    }

    public static getBackground(name: string): Background | undefined {
        return this.backgrounds[name];
    }

    public static getItem(idOrName: string): Item | undefined {
        const key = idOrName.toLowerCase();
        // Try exact match first
        if (this.items[idOrName]) return this.items[idOrName];
        // Try lowercase key
        if (this.items[key]) return this.items[key];
        // Try replacing underscores with spaces (common in IDs)
        if (this.items[key.replace(/_/g, ' ')]) return this.items[key.replace(/_/g, ' ')];

        return undefined;
    }

    private static spells: Record<string, Spell> = {};

    public static async loadSpells() {
        if (Object.keys(this.spells).length > 0) return;
        const spellModules = import.meta.glob('../../../data/spell/*.json');
        for (const path in spellModules) {
            const mod: any = await spellModules[path]();
            const spell = mod.default || mod;
            if (spell.name) {
                this.spells[spell.name] = spell;
                this.spells[spell.name.toLowerCase()] = spell;
            }
        }
    }

    public static getSpell(name: string): Spell | undefined {
        return this.spells[name] || this.spells[name.toLowerCase()];
    }

    public static getSpells(): Spell[] {
        return Object.values(this.spells);
    }
}
