import { Race } from '../schemas/RaceSchema';
import { CharacterClass } from '../schemas/ClassSchema';
import { Background } from '../schemas/BackgroundSchema';
import { Item } from '../schemas/ItemSchema';
import { Spell } from '../schemas/SpellSchema';
import { Monster } from '../schemas/MonsterSchema';

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
    private static monsterMapping: Record<string, { id: string, cr: number }[]> = {};
    private static initialized = false;

    public static async initialize() {
        if (this.initialized) return;

        // Load Races
        const raceModules = import.meta.glob('../../../data/race/*.json');
        for (const path in raceModules) {
            try {
                const mod: any = await raceModules[path]();
                const race = mod.default || mod;
                if (race.name) {
                    this.races[race.name] = race;
                }
            } catch (e) {
                console.warn(`[DataManager] Failed to load race from ${path}:`, e);
            }
        }

        // Load Classes
        const classModules = import.meta.glob('../../../data/class/*.json');
        for (const path in classModules) {
            try {
                const mod: any = await classModules[path]();
                const cls = mod.default || mod;
                if (cls.name) {
                    this.classes[cls.name] = cls;
                }
            } catch (e) {
                console.warn(`[DataManager] Failed to load class from ${path}:`, e);
            }
        }

        // Load Backgrounds
        const bgModules = import.meta.glob('../../../data/backgrounds/*.json');
        for (const path in bgModules) {
            try {
                const mod: any = await bgModules[path]();
                const bg = mod.default || mod;
                if (bg.name) {
                    this.backgrounds[bg.name] = bg;
                }
            } catch (e) {
                console.warn(`[DataManager] Failed to load background from ${path}:`, e);
            }
        }

        // Load Items
        const itemModules = import.meta.glob('../../../data/item/*.json');
        for (const path in itemModules) {
            try {
                const mod: any = await itemModules[path]();
                const item = mod.default || mod;
                if (item.name) {
                    this.items[item.name] = item;
                    this.items[item.name.toLowerCase()] = item;
                    this.items[item.name.toLowerCase().replace(/ /g, '_')] = item;
                }
            } catch (e) {
                console.warn(`[DataManager] Failed to load item from ${path}:`, e);
            }
        }

        // Load Biome-Monster Mapping
        const mappingModule = await import('../../../data/mappings/biome_monster_mapping.json');
        this.monsterMapping = mappingModule.default || mappingModule;

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
        if (this.items[idOrName]) return this.items[idOrName];
        if (this.items[key]) return this.items[key];
        if (this.items[key.replace(/_/g, ' ')]) return this.items[key.replace(/_/g, ' ')];
        return undefined;
    }

    private static spells: Record<string, Spell> = {};
    private static spellLookup: Record<string, Spell> = {};

    public static async loadSpells() {
        if (Object.keys(this.spells).length > 0) return;
        const spellModules = import.meta.glob('../../../data/spell/*.json');
        for (const path in spellModules) {
            try {
                const mod: any = await spellModules[path]();
                const spell = mod.default || mod;
                if (spell.name) {
                    this.spells[spell.name] = spell;
                    this.spellLookup[spell.name.toLowerCase()] = spell;
                }
            } catch (e) {
                console.warn(`[DataManager] Failed to load spell from ${path}:`, e);
            }
        }
    }

    public static getSpell(name: string): Spell | undefined {
        return this.spells[name] || this.spellLookup[name.toLowerCase()];
    }

    public static getSpells(): Spell[] {
        return Object.values(this.spells);
    }

    /**
     * Filters spells by class and maximum level.
     * Useful for character creation and preparation filtering.
     */
    public static getSpellsByClass(className: string, maxLevel: number = 9): Spell[] {
        return Object.values(this.spells).filter(s =>
            s.classes?.includes(className) && s.level <= maxLevel
        );
    }

    private static monsters: Record<string, Monster> = {};
    private static monsterLookup: Record<string, Monster> = {};

    public static async loadMonsters() {
        if (Object.keys(this.monsters).length > 0) return;
        const monsterModules = import.meta.glob('../../../data/monster/*.json');
        for (const path in monsterModules) {
            try {
                const mod: any = await monsterModules[path]();
                const monster = mod.default || mod;
                if (monster.name) {
                    this.monsters[monster.name] = monster;
                    this.monsterLookup[monster.name.toLowerCase()] = monster;
                }
            } catch (e) {
                console.warn(`[DataManager] Skipped monster file ${path} (may be blocked by browser extension)`);
            }
        }
    }

    public static getMonster(name: string): Monster | undefined {
        return this.monsters[name] || this.monsterLookup[name.toLowerCase()];
    }

    public static getMonstersByBiome(biome: string): { id: string, cr: number }[] {
        return this.monsterMapping[biome] || [];
    }
}
