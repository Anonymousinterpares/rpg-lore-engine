import { CombatantState } from './types';
import { Spell } from '../schemas/SpellSchema';
import { Dice } from './Dice';

export class SpellcastingEngine {
    /**
     * Checks if a combatant can cast a specific spell at a specific level.
     */
    public static canCast(caster: CombatantState, spell: Spell, slotLevel: number): boolean {
        // 1. Check if spell level is valid for slot
        if (slotLevel < spell.level) return false;

        // 2. Check slots if not a cantrip
        if (spell.level > 0) {
            const slots = caster.spellSlots?.[slotLevel.toString()];
            if (!slots || slots.current <= 0) return false;
        }

        // 3. Concentration check (Simplified: caster can always drop existing)

        return true;
    }

    /**
     * Executes the spellcasting logic.
     */
    public static castSpell(caster: CombatantState, target: CombatantState, spell: Spell, slotLevel: number): string {
        if (!this.canCast(caster, spell, slotLevel)) {
            return `${caster.name} cannot cast ${spell.name} at level ${slotLevel}.`;
        }

        // 1. Deduct slot
        if (spell.level > 0) {
            caster.spellSlots![slotLevel.toString()].current--;
        }

        // 2. Handle Concentration
        if (spell.concentration) {
            caster.concentration = {
                spellName: spell.name,
                startTurn: 0 // Should be current turn from combat manager
            };
        }

        // 3. Resolve Damage/Effect
        let result = `${caster.name} casts ${spell.name}`;
        if (spell.damage) {
            const damage = Dice.roll(spell.damage.dice);
            target.hp.current -= damage;
            result += ` dealing ${damage} ${spell.damage.type} damage to ${target.name}.`;
        }

        return result;
    }

    /**
     * Handles concentration check when taking damage.
     */
    public static concentrationCheck(caster: CombatantState, damage: number): boolean {
        if (!caster.concentration) return true;

        const dc = Math.max(10, Math.floor(damage / 2));
        const roll = Dice.d20() + 0; // Should add CON mod

        if (roll < dc) {
            caster.concentration = undefined;
            return false;
        }
        return true;
    }
}
