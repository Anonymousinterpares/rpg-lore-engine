import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Spell } from '../schemas/SpellSchema';
import { CurrencyEngine } from './CurrencyEngine';
import { Item } from '../schemas/ItemSchema';

export class SpellbookEngine {
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
        if (!ability) return 0; // Not a preparation-based caster or non-caster

        const stats = pc.stats as Record<string, number>;
        const score = stats[ability] || 10;
        const mod = Math.floor((score - 10) / 2);

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
