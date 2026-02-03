import { CurrencyEngine } from './CurrencyEngine';
export class SpellbookEngine {
    /**
     * Adds a spell to a Wizard's spellbook from a scroll.
     */
    static copyFromScroll(pc, scroll, spell) {
        if (scroll.type !== 'Spell Scroll')
            return "Item is not a spell scroll.";
        if (pc.class !== 'Wizard')
            return "Only Wizards use spellbooks.";
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
        pc.inventory.gold = CurrencyEngine.subtract(pc.inventory.gold, currencyCost);
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
     * Prepares spells for the day.
     */
    static prepareSpells(pc, spellNames) {
        // Logic for max prepared spells based on class/level/stat
        // Simplified for now: allow any from known/spellbook
        pc.preparedSpells = spellNames.filter(name => pc.knownSpells.includes(name) || pc.spellbook.includes(name));
        return `Prepared ${pc.preparedSpells.length} spells.`;
    }
}
