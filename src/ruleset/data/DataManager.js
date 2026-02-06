/**
 * DataManager
 *
 * Responsible for loading and serving static game data (Races, Classes, Backgrounds)
 * from the JSON files in the /data directory.
 *
 * Uses Vite's import.meta.glob for efficient bundling and loading.
 */
export class DataManager {
    static races = {};
    static classes = {};
    static backgrounds = {};
    static items = {}; // Keyed by Lowercase Name/ID for flexible lookup
    static monsterMapping = {};
    static initialized = false;
    static async initialize() {
        if (this.initialized)
            return;
        // Load Races
        const raceModules = import.meta.glob('../../../data/race/*.json');
        for (const path in raceModules) {
            const mod = await raceModules[path]();
            // Default export or the JSON object itself
            const race = mod.default || mod;
            if (race.name) {
                this.races[race.name] = race;
            }
        }
        // Load Classes
        const classModules = import.meta.glob('../../../data/class/*.json');
        for (const path in classModules) {
            const mod = await classModules[path]();
            const cls = mod.default || mod;
            if (cls.name) {
                this.classes[cls.name] = cls;
            }
        }
        // Load Backgrounds
        const bgModules = import.meta.glob('../../../data/backgrounds/*.json');
        for (const path in bgModules) {
            const mod = await bgModules[path]();
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
            const mod = await itemModules[path]();
            const item = mod.default || mod;
            if (item.name) {
                // Index by name
                this.items[item.name] = item;
                // Index by lowercase name (and potential ID format)
                this.items[item.name.toLowerCase()] = item;
                this.items[item.name.toLowerCase().replace(/ /g, '_')] = item;
            }
        }
        // Load Biome-Monster Mapping
        const mappingModule = await import('../../../data/mappings/biome_monster_mapping.json');
        this.monsterMapping = mappingModule.default || mappingModule;
        this.initialized = true;
        console.log(`[DataManager] Initialized with ${Object.keys(this.races).length} Races, ${Object.keys(this.classes).length} Classes, ${Object.keys(this.backgrounds).length} Backgrounds, ${Object.keys(this.items).length} Items (indexed).`);
    }
    static getRaces() {
        return Object.values(this.races);
    }
    static getClasses() {
        return Object.values(this.classes);
    }
    static getBackgrounds() {
        return Object.values(this.backgrounds);
    }
    static getRace(name) {
        return this.races[name];
    }
    static getClass(name) {
        return this.classes[name];
    }
    static getBackground(name) {
        return this.backgrounds[name];
    }
    static getItem(idOrName) {
        const key = idOrName.toLowerCase();
        // Try exact match first
        if (this.items[idOrName])
            return this.items[idOrName];
        // Try lowercase key
        if (this.items[key])
            return this.items[key];
        // Try replacing underscores with spaces (common in IDs)
        if (this.items[key.replace(/_/g, ' ')])
            return this.items[key.replace(/_/g, ' ')];
        return undefined;
    }
    static spells = {};
    static spellLookup = {};
    static async loadSpells() {
        if (Object.keys(this.spells).length > 0)
            return;
        const spellModules = import.meta.glob('../../../data/spell/*.json');
        for (const path in spellModules) {
            const mod = await spellModules[path]();
            const spell = mod.default || mod;
            if (spell.name) {
                this.spells[spell.name] = spell;
                this.spellLookup[spell.name.toLowerCase()] = spell;
            }
        }
    }
    static getSpell(name) {
        return this.spells[name] || this.spellLookup[name.toLowerCase()];
    }
    static getSpells() {
        return Object.values(this.spells);
    }
    /**
     * Filters spells by class and maximum level.
     * Useful for character creation and preparation filtering.
     */
    static getSpellsByClass(className, maxLevel = 9) {
        return Object.values(this.spells).filter(s => s.classes?.includes(className) && s.level <= maxLevel);
    }
    static monsters = {};
    static monsterLookup = {};
    static async loadMonsters() {
        if (Object.keys(this.monsters).length > 0)
            return;
        const monsterModules = import.meta.glob('../../../data/monster/*.json');
        for (const path in monsterModules) {
            try {
                const mod = await monsterModules[path]();
                const monster = mod.default || mod;
                if (monster.name) {
                    this.monsters[monster.name] = monster;
                    this.monsterLookup[monster.name.toLowerCase()] = monster;
                }
            }
            catch (e) {
                console.error(`[DataManager] Failed to load monster from ${path}:`, e);
            }
        }
    }
    static getMonster(name) {
        return this.monsters[name] || this.monsterLookup[name.toLowerCase()];
    }
    static getMonstersByBiome(biome) {
        return this.monsterMapping[biome] || [];
    }
}
