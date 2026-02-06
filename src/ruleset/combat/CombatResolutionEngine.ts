import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';
import { Spell } from '../schemas/SpellSchema';
import { z } from 'zod';
import { CombatantSchema } from '../schemas/FullSaveStateSchema';

type Combatant = z.infer<typeof CombatantSchema>;

export interface CombatActionResult {
    type: 'HIT' | 'MISS' | 'CRIT' | 'SAVE_SUCCESS' | 'SAVE_FAIL' | 'HEAL' | 'EFFECT';
    damage: number;
    heal: number;
    message: string;
    details: {
        roll?: number;
        modifier?: number;
        proficiency?: number;
        total?: number;
        targetAC?: number;
        saveDC?: number;
        isCrit?: boolean;
    };
}

export class CombatResolutionEngine {
    /**
     * Resolves a physical attack (weapon or unarmed)
     */
    public static resolveAttack(
        attacker: Combatant,
        target: Combatant,
        attackBonus: number,
        damageFormula: string,
        statMod: number
    ): CombatActionResult {
        const d20 = Dice.d20();
        const isCrit = d20 === 20;
        const total = d20 + attackBonus;
        const hit = isCrit || total >= target.ac;

        let damage = 0;
        let message = '';

        if (hit) {
            damage = Dice.roll(damageFormula);
            if (isCrit) {
                // Simplified crit: roll damage twice
                damage += Dice.roll(damageFormula);
                message = `${attacker.name} scores a CRITICAL HIT on ${target.name}!`;
            } else {
                message = `${attacker.name} hits ${target.name}.`;
            }
            // Add stat modifier to damage (simplified)
            damage += statMod;
            if (damage < 1) damage = 1;

            message += ` Dealing ${damage} damage.`;
        } else {
            message = `${attacker.name} misses ${target.name}.`;
        }

        return {
            type: isCrit ? 'CRIT' : (hit ? 'HIT' : 'MISS'),
            damage,
            heal: 0,
            message,
            details: {
                roll: d20,
                modifier: attackBonus,
                total,
                targetAC: target.ac,
                isCrit
            }
        };
    }

    /**
     * Resolves a spell action
     */
    public static resolveSpell(
        caster: Combatant,
        target: Combatant,
        spell: Spell,
        spellAttackBonus: number,
        spellSaveDC: number
    ): CombatActionResult {
        let type: CombatActionResult['type'] = 'EFFECT';
        let damage = 0;
        let heal = 0;
        let message = '';
        let details: any = {};

        // 1. Resolve Hit/Save
        if (spell.save) {
            const saveAbility = spell.save.ability as any;
            const targetStat = target.stats[saveAbility] || 10;
            const targetMod = MechanicsEngine.getModifier(targetStat);
            const saveRoll = Dice.d20();
            const saveTotal = saveRoll + targetMod; // Simplified save, ignoring proficiency for now
            const saveSuccess = saveTotal >= spellSaveDC;

            type = saveSuccess ? 'SAVE_SUCCESS' : 'SAVE_FAIL';
            details = { roll: saveRoll, modifier: targetMod, total: saveTotal, saveDC: spellSaveDC };

            if (spell.damage) {
                damage = Dice.roll(spell.damage.dice);
                if (saveSuccess && spell.save.effect === 'half') {
                    damage = Math.floor(damage / 2);
                } else if (saveSuccess && spell.save.effect === 'none') {
                    damage = 0;
                }
            }

            message = `${target.name} makes a ${saveAbility} save vs ${caster.name}'s ${spell.name}: ${saveRoll} + ${targetMod} = ${saveTotal}. `;
            message += saveSuccess ? `SUCCESS.` : `FAILURE.`;
            if (damage > 0) message += ` Taking ${damage} damage.`;

        } else if (spell.damage) {
            // Assume spell attack if no save mentioned
            const d20 = Dice.d20();
            const isCrit = d20 === 20;
            const total = d20 + spellAttackBonus;
            const hit = isCrit || total >= target.ac;

            type = isCrit ? 'CRIT' : (hit ? 'HIT' : 'MISS');
            details = { roll: d20, modifier: spellAttackBonus, total, targetAC: target.ac, isCrit };

            if (hit) {
                damage = Dice.roll(spell.damage.dice);
                if (isCrit) damage += Dice.roll(spell.damage.dice);
                message = `${caster.name} casts ${spell.name} on ${target.name}. ${isCrit ? 'CRITICAL ' : ''}HIT! Dealing ${damage} damage.`;
            } else {
                message = `${caster.name} casts ${spell.name} on ${target.name} but MISSES.`;
            }
        } else if (spell.description.toLowerCase().includes('heal')) {
            // Very simplified heal detection
            type = 'HEAL';
            const damageObj = spell.damage as any;
            heal = Dice.roll(damageObj?.dice || '1d4'); // Fallback
            message = `${caster.name} casts ${spell.name} on ${target.name}, healing ${heal} HP.`;
        } else {
            message = `${caster.name} casts ${spell.name} on ${target.name}.`;
        }

        return { type, damage, heal, message, details };
    }

    /**
     * Applies damage to a combatant, handling HP updates
     */
    public static applyDamage(target: Combatant, amount: number): void {
        target.hp.current -= amount;
        if (target.hp.current < 0) target.hp.current = 0;
    }

    /**
     * Applies healing to a combatant
     */
    public static applyHealing(target: Combatant, amount: number): void {
        target.hp.current += amount;
        if (target.hp.current > target.hp.max) target.hp.current = target.hp.max;
    }
}
