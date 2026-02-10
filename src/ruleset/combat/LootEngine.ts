import { Monster } from '../schemas/MonsterSchema';
import { Currency, CurrencyEngine } from './CurrencyEngine';
import { Dice } from './Dice';
import { DataManager } from '../data/DataManager';

// Static Imports for browser compatibility (Vite handles this)
import weaponMappingData from '../../../data/mappings/weapon_action_mapping.json';
import armorMappingData from '../../../data/mappings/armor_ac_mapping.json';
import lootTiersData from '../../../data/mappings/loot_tiers.json';

export interface LootResult {
    gold: Currency;
    items: any[];
}

export class LootEngine {
    private static weaponMapping = weaponMappingData as Record<string, string>;
    private static armorMapping = armorMappingData as any;
    private static lootTiers = lootTiersData as any;

    /**
     * Determines what equipment (weapons/armor) a monster drops.
     */
    public static getEquipmentDrops(monster: Monster): any[] {
        const drops: any[] = [];
        const type = monster.type.toLowerCase();

        // 1. Weapon Drops
        if (this.weaponMapping) {
            for (const action of monster.actions) {
                const itemFile = this.weaponMapping[action.name];
                if (itemFile) {
                    const item = DataManager.getItem(itemFile);
                    if (item) drops.push(JSON.parse(JSON.stringify(item))); // Clone to avoid mutation
                }
            }
        }

        // 2. Armor Drops
        if (this.armorMapping && this.armorMapping.droppableTypes.includes(type)) {
            const ac = monster.ac;
            const mapping = this.armorMapping.mappings.find((m: any) => ac >= m.minAC && ac <= m.maxAC);
            if (mapping && mapping.item) {
                const item = DataManager.getItem(mapping.item);
                if (item) drops.push(JSON.parse(JSON.stringify(item)));
            }
        }

        return drops;
    }

    /**
     * Generates random treasure (gold + bonus items) based on CR.
     */
    public static getTreasureDrops(cr: number): LootResult {
        const gold: Currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        const items: any[] = [];

        if (!this.lootTiers) return { gold, items };

        const tier = this.lootTiers.tiers.find((t: any) => cr >= t.minCR && cr <= t.maxCR)
            || this.lootTiers.tiers[this.lootTiers.tiers.length - 1];

        // 1. Gold Generation
        const roll = Dice.roll(tier.goldDice);
        const amount = roll * (tier.goldMultiplier || 1);
        (gold as any)[tier.goldDenom] = amount;

        // 2. Bonus Item Generation
        if (Math.random() < tier.itemChance) {
            const bonusItem = this.getRandomItemOfValue(tier.maxItemValue);
            if (bonusItem) items.push(bonusItem);
        }

        return { gold: CurrencyEngine.normalize(gold), items };
    }

    /**
     * Comprehensive loot generation for a defeated monster.
     */
    public static processDefeat(monster: Monster): LootResult {
        const equipDrops = this.getEquipmentDrops(monster);
        const treasure = this.getTreasureDrops(Number(monster.cr) || 0);
        const items = [...equipDrops, ...treasure.items];

        // Spellcaster drops
        if ((monster as any).spellcasting) {
            const spellcasting = (monster as any).spellcasting;
            for (const [lv, data] of Object.entries(spellcasting.slots)) {
                const level = parseInt(lv);
                for (const spellName of (data as any).spells) {
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

    private static getRandomItemOfValue(maxValueInCopper: number): any | null {
        const commonTreasure = ['Amulet', 'Pouch', 'Flask_or_tankard', 'Mirror__steel'];
        const selection = commonTreasure[Math.floor(Math.random() * commonTreasure.length)];
        const item = DataManager.getItem(selection);

        if (item && item.cost) {
            const value = CurrencyEngine.toCopper(item.cost);
            if (value <= maxValueInCopper) return JSON.parse(JSON.stringify(item));
        }
        return null;
    }

    public static generateSpellScroll(spellName: string, level: number): any {
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
            equipped: false,
            instanceId: `scroll_${Date.now()}_${Math.random()}`
        };
    }

    private static getScrollCost(level: number) {
        const costs = [50, 100, 250, 500, 2500, 5000, 15000, 25000, 50000, 100000];
        return { cp: 0, sp: 0, ep: 0, gp: costs[level] || 50, pp: 0 };
    }
}

