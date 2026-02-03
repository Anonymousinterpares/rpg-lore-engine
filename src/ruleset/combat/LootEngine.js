import * as fs from 'fs';
import * as path from 'path';
import { CurrencyEngine } from './CurrencyEngine';
import { Dice } from './Dice';
const MAPPINGS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'mappings');
const ITEM_DIR = path.join(__dirname, '..', '..', '..', 'data', 'item');
export class LootEngine {
    static weaponMapping = null;
    static armorMapping = null;
    static lootTiers = null;
    static loadMappings() {
        if (!this.weaponMapping) {
            this.weaponMapping = JSON.parse(fs.readFileSync(path.join(MAPPINGS_DIR, 'weapon_action_mapping.json'), 'utf-8'));
        }
        if (!this.armorMapping) {
            this.armorMapping = JSON.parse(fs.readFileSync(path.join(MAPPINGS_DIR, 'armor_ac_mapping.json'), 'utf-8'));
        }
        if (!this.lootTiers) {
            this.lootTiers = JSON.parse(fs.readFileSync(path.join(MAPPINGS_DIR, 'loot_tiers.json'), 'utf-8'));
        }
    }
    /**
     * Determines what equipment (weapons/armor) a monster drops.
     */
    static getEquipmentDrops(monster) {
        this.loadMappings();
        const drops = [];
        const type = monster.type.toLowerCase();
        // 1. Weapon Drops
        if (this.weaponMapping) {
            for (const action of monster.actions) {
                const itemFile = this.weaponMapping[action.name];
                if (itemFile) {
                    const item = this.loadItem(itemFile);
                    if (item)
                        drops.push(item);
                }
            }
        }
        // 2. Armor Drops
        if (this.armorMapping && this.armorMapping.droppableTypes.includes(type)) {
            const ac = monster.ac;
            const mapping = this.armorMapping.mappings.find((m) => ac >= m.minAC && ac <= m.maxAC);
            if (mapping && mapping.item) {
                const item = this.loadItem(mapping.item);
                if (item)
                    drops.push(item);
            }
        }
        return drops;
    }
    /**
     * Generates random treasure (gold + bonus items) based on CR.
     */
    static getTreasureDrops(cr) {
        this.loadMappings();
        const gold = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        const items = [];
        if (!this.lootTiers)
            return { gold, items };
        const tier = this.lootTiers.tiers.find((t) => cr >= t.minCR && cr <= t.maxCR)
            || this.lootTiers.tiers[this.lootTiers.tiers.length - 1];
        // 1. Gold Generation
        const roll = Dice.roll(tier.goldDice);
        const amount = roll * (tier.goldMultiplier || 1);
        gold[tier.goldDenom] = amount;
        // 2. Bonus Item Generation
        if (Math.random() < tier.itemChance) {
            const bonusItem = this.getRandomItemOfValue(tier.maxItemValue);
            if (bonusItem)
                items.push(bonusItem);
        }
        return { gold: CurrencyEngine.normalize(gold), items };
    }
    /**
     * Comprehensive loot generation for a defeated monster.
     */
    static processDefeat(monster) {
        const equipDrops = this.getEquipmentDrops(monster);
        const treasure = this.getTreasureDrops(Number(monster.cr) || 0);
        const items = [...equipDrops, ...treasure.items];
        // Spellcaster drops
        if (monster.spellcasting) {
            const spellcasting = monster.spellcasting;
            for (const [lv, data] of Object.entries(spellcasting.slots)) {
                const level = parseInt(lv);
                for (const spellName of data.spells) {
                    if (Math.random() < 0.2) {
                        items.push(this.generateSpellScroll(spellName, level));
                    }
                }
            }
        }
        return {
            gold: treasure.gold,
            items: items
        };
    }
    static loadItem(fileName) {
        try {
            const filePath = path.join(ITEM_DIR, `${fileName}.json`);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        }
        catch (e) {
            console.error(`Failed to load item: ${fileName}`, e);
        }
        return null;
    }
    static getRandomItemOfValue(maxValueInCopper) {
        // In a real implementation, we'd have an index of items by value.
        // For now, we'll pick a few common treasure items or return null.
        // A better way would be to scan ITEM_DIR occasionally.
        const commonTreasure = ['Amulet', 'Pouch', 'Flask_or_tankard', 'Mirror__steel'];
        const selection = commonTreasure[Math.floor(Math.random() * commonTreasure.length)];
        const item = this.loadItem(selection);
        if (item && item.cost) {
            const value = CurrencyEngine.toCopper(item.cost);
            if (value <= maxValueInCopper)
                return item;
        }
        return null;
    }
    static generateSpellScroll(spellName, level) {
        return {
            id: `scroll_${Math.random().toString(36).substr(2, 9)}`,
            name: `Spell Scroll: ${spellName}`,
            type: 'Spell Scroll',
            spellName: spellName,
            spellLevel: level,
            weight: 0,
            cost: this.getScrollCost(level),
            description: `A magic scroll containing the spell ${spellName}.`,
            quantity: 1,
            equipped: false
        };
    }
    static getScrollCost(level) {
        const costs = [50, 100, 250, 500, 2500, 5000, 15000, 25000, 50000, 100000];
        return { cp: 0, sp: 0, ep: 0, gp: costs[level] || 50, pp: 0 };
    }
}
