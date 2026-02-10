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
        statMod: number,
        forceDisadvantage: boolean = false
    ): CombatActionResult {
        const hasDodgeDisadvantage = target.statusEffects.some(e => e.id === 'dodge');
        const d20 = (hasDodgeDisadvantage || forceDisadvantage) ? Dice.disadvantage() : Dice.d20();
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

        const effect = spell.effect;
        const category = effect?.category || 'UTILITY';

        // 1. Resolve Hit or Save based on spell properties
        let success = true; // For caster: does it hit? For target: do they fail save?

        if (spell.save) {
            const saveAbility = spell.save.ability as 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
            const targetStat = target.stats[saveAbility] || 10;
            const targetMod = MechanicsEngine.getModifier(targetStat);
            const saveRoll = Dice.d20();
            const saveTotal = saveRoll + targetMod;
            const saveSuccess = saveTotal >= spellSaveDC;

            type = saveSuccess ? 'SAVE_SUCCESS' : 'SAVE_FAIL';
            success = !saveSuccess; // Caster "succeeds" if target fails save
            details = { roll: saveRoll, modifier: targetMod, total: saveTotal, saveDC: spellSaveDC };

            message = `${target.name} makes a ${saveAbility} save vs ${caster.name}'s ${spell.name}: ${saveRoll} + ${targetMod} = ${saveTotal}. `;
            message += saveSuccess ? `SUCCESS.` : `FAILURE.`;
        } else if (category === 'DAMAGE' || category === 'DEBUFF' || category === 'CONTROL') {
            // Default to Spell Attack if no save and it's offensive
            const hasDisadvantage = target.statusEffects.some(e => e.id === 'dodge');
            const d20 = hasDisadvantage ? Dice.disadvantage() : Dice.d20();
            const isCrit = d20 === 20;
            const total = d20 + spellAttackBonus;
            const hit = isCrit || total >= target.ac;

            type = isCrit ? 'CRIT' : (hit ? 'HIT' : 'MISS');
            success = hit;
            details = { roll: d20, modifier: spellAttackBonus, total, targetAC: target.ac, isCrit };

            if (hit) {
                message = `${caster.name} casts ${spell.name} on ${target.name}. ${isCrit ? 'CRITICAL ' : ''}HIT! `;
            } else {
                message = `${caster.name} casts ${spell.name} on ${target.name} but MISSES.`;
                return { type, damage: 0, heal: 0, message, details };
            }
        } else {
            // Helpful spells (HEAL, BUFF, SUMMON) usually auto-succeed on targets
            message = `${caster.name} casts ${spell.name} on ${target.name}. `;
        }

        // 2. Apply Effects based on success and category
        switch (category) {
            case 'DAMAGE':
                if (spell.damage) {
                    damage = Dice.roll(spell.damage.dice);
                    if (details.isCrit) damage += Dice.roll(spell.damage.dice);

                    // Handle half damage on save success
                    if (type === 'SAVE_SUCCESS' && spell.save?.effect === 'half') {
                        damage = Math.floor(damage / 2);
                    } else if (type === 'SAVE_SUCCESS') {
                        damage = 0;
                    }
                }
                if (damage > 0) message += `Dealing ${damage} damage.`;
                break;

            case 'HEAL':
                type = 'HEAL';
                heal = Dice.roll(spell.damage?.dice || '1d8') + MechanicsEngine.getModifier(caster.stats['WIS'] || caster.stats['CHA'] || caster.stats['INT'] || 10);
                message += `Healing ${heal} HP.`;
                break;

            case 'BUFF':
            case 'DEBUFF':
                type = 'EFFECT';
                // Effects are handled by adding to statusEffects array in GameLoop or here
                message += success ? `Target is ${category === 'BUFF' ? 'bolstered' : 'afflicted'}.` : `Effect resisted.`;
                break;

            case 'CONTROL':
                type = 'EFFECT';
                if (success && spell.condition) {
                    message += `Target is ${spell.condition}!`;
                }
                break;

            case 'SUMMON':
                type = 'EFFECT';
                message += `Creatures are called forth!`;
                break;
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
