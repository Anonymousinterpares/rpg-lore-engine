import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Spell } from '../schemas/SpellSchema';
import { CurrencyEngine } from './CurrencyEngine';
import { Item } from '../schemas/ItemSchema';

export class SpellbookEngine {
    /**
     * Determines if a class is a "Known Spells" caster (Always Prepared).
     */
    public static isKnownSpellsCaster(className: string): boolean {
        return ['Sorcerer', 'Warlock', 'Bard', 'Ranger'].includes(className);
    }

    /**
     * Determines if a class is a "Source" (Preparation) caster.
     */
    public static isSourceCaster(className: string): boolean {
        return ['Wizard', 'Cleric', 'Druid', 'Paladin'].includes(className);
    }

    /**
     * Returns the maximum spell level a character can cast/prepare based on their level.
     * Uses standard 5e progression for full/half/third casters.
     */
    public static getMaxSpellLevel(pc: PlayerCharacter): number {
        const isFullCaster = ['Wizard', 'Cleric', 'Druid', 'Sorcerer', 'Bard'].includes(pc.class);
        const isHalfCaster = ['Paladin', 'Ranger'].includes(pc.class);

        if (isFullCaster) {
            if (pc.level >= 17) return 9;
            if (pc.level >= 15) return 8;
            if (pc.level >= 13) return 7;
            if (pc.level >= 11) return 6;
            if (pc.level >= 9) return 5;
            if (pc.level >= 7) return 4;
            if (pc.level >= 5) return 3;
            if (pc.level >= 3) return 2;
            return 1;
        }

        if (isHalfCaster) {
            if (pc.level >= 17) return 5;
            if (pc.level >= 13) return 4;
            if (pc.level >= 9) return 3;
            if (pc.level >= 5) return 2;
            if (pc.level >= 2) return 1;
        }

        return 0;
    }
    /**
     * Adds a spell to a Wizard's spellbook from a scroll.
     */
    public static copyFromScroll(pc: PlayerCharacter, scroll: Item, spell: Spell): string {
        if (scroll.type !== 'Spell Scroll') return "Item is not a spell scroll.";
        if (pc.class !== 'Wizard') return "Only Wizards use spellbooks.";

        // 1. Check if spell is already in spellbook
        if (pc.spellbook.includes(spell.name)) {
            return `${spell.name} is already in your spellbook.`;
        }

        // 2. Check Capacity (Simplified: max 100 spells)
        if (pc.spellbook.length >= 100) {
            return "Spellbook is full (100 spells).";
        }

        // 3. Check Cost (50gp per level)
        const cost = spell.level * 50;
        const currencyCost = { cp: 0, sp: 0, ep: 0, gp: cost, pp: 0 };

        if (!CurrencyEngine.canAfford(pc.inventory.gold, currencyCost)) {
            return `Cannot afford copying materials. Needs ${cost}gp.`;
        }

        // 4. Process
        pc.inventory.gold = CurrencyEngine.subtract(pc.inventory.gold, currencyCost)!;
        pc.spellbook.push(spell.name);

        // Remove scroll from inventory
        const scrollIndex = pc.inventory.items.findIndex(i => i.name === scroll.name);
        if (scrollIndex !== -1) {
            pc.inventory.items[scrollIndex].quantity--;
            if (pc.inventory.items[scrollIndex].quantity <= 0) {
                pc.inventory.items.splice(scrollIndex, 1);
            }
        }

        return `Successfully copied ${spell.name} to your spellbook.`;
    }

    /**
     * Calculates the maximum number of spells a character can prepare.
     * Formula: max(1, AbilityModifier + Level)
     */
    public static getMaxPreparedCount(pc: PlayerCharacter): number {
        // Casting abilities by class
        const castingAbilities: Record<string, string> = {
            'Wizard': 'INT',
            'Cleric': 'WIS',
            'Druid': 'WIS',
            'Paladin': 'CHA',
            'Bard': 'CHA',
            'Sorcerer': 'CHA',
            'Warlock': 'CHA',
            'Ranger': 'WIS'
        };

        const ability = castingAbilities[pc.class];
        if (!ability) return 0;

        // Known casters: Their preparation count is simply how many they know.
        if (this.isKnownSpellsCaster(pc.class)) {
            return pc.knownSpells.length;
        }

        const stats = pc.stats as Record<string, number>;
        const score = stats[ability] || 10;
        const mod = Math.floor((score - 10) / 2);

        // Paladin/Ranger (half casters) use floor(Level/2) + mod
        if (pc.class === 'Paladin' || pc.class === 'Ranger') {
            return Math.max(1, mod + Math.floor(pc.level / 2));
        }

        return Math.max(1, mod + pc.level);
    }

    /**
     * Prepares spells for the day.
     */
    public static prepareSpells(pc: PlayerCharacter, spellNames: string[]): { success: boolean, message: string } {
        const max = this.getMaxPreparedCount(pc);

        if (spellNames.length > max) {
            return { success: false, message: `Too many spells! You can only prepare ${max}.` };
        }

        // Validate all spells are known or in spellbook
        const invalid = spellNames.filter(name =>
            !pc.knownSpells.includes(name) && !pc.spellbook.includes(name)
        );

        if (invalid.length > 0) {
            return { success: false, message: `You don't know: ${invalid.join(', ')}` };
        }

        pc.preparedSpells = [...spellNames];
        return { success: true, message: `Prepared ${pc.preparedSpells.length} spells.` };
    }
}
