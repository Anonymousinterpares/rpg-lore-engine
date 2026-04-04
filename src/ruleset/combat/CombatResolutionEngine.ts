import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';
import { VisibilityEngine, LightLevel } from './VisibilityEngine';
import { Spell } from '../schemas/SpellSchema';
import { z } from 'zod';
import { CombatantSchema, Modifier, RollDetails } from '../schemas/CombatSchema';

type Combatant = z.infer<typeof CombatantSchema>;

export interface CombatActionResult {
    type: 'HIT' | 'MISS' | 'CRIT' | 'RANGED_HIT' | 'RANGED_MISS' | 'RANGED_CRIT' | 'SAVE_SUCCESS' | 'SAVE_FAIL' | 'HEAL' | 'EFFECT';
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
        rollDetails?: RollDetails;
    };
}

export class CombatResolutionEngine {
    /**
     * Resolves a physical attack (weapon or unarmed)
     */
    public static resolveAttack(
        attacker: Combatant,
        target: Combatant,
        attackModifiers: Modifier[],
        damageFormula: string,
        statMod: number,
        isRanged: boolean = false,
        forceDisadvantage: boolean = false,
        lightLevel: LightLevel = 'Bright',
        featureContext?: {
            critRange?: number;
            sneakAttackDice?: number;
            hasAllyNearTarget?: boolean;
            isFinesseOrRanged?: boolean;
            rerollDamageBelow?: number;
            forceAdvantage?: boolean;   // Reckless Attack, Assassinate
            forceCrit?: boolean;        // Assassinate on surprised
            ignoreCover?: boolean;      // Sharpshooter
            evasion?: boolean;          // Target has Evasion
            uncannyDodge?: boolean;     // Target has Uncanny Dodge (halve one attack)
        }
    ): CombatActionResult {
        // Prevent friendly fire: allies cannot attack allies, enemies cannot attack enemies
        const attackerIsAlly = attacker.type === 'player' || attacker.type === 'companion' || attacker.type === 'summon';
        const targetIsAlly = target.type === 'player' || target.type === 'companion' || target.type === 'summon';
        if (attackerIsAlly === targetIsAlly) {
            return {
                type: 'MISS',
                damage: 0,
                heal: 0,
                message: `${attacker.name} cannot attack ${target.name} — they are an ally!`,
                details: { roll: 0, total: 0, targetAC: target.ac }
            };
        }

        // Darkvision/lighting checks
        const attackerVision = VisibilityEngine.getVisibilityEffect(attacker as any, lightLevel);
        const targetVision = VisibilityEngine.getVisibilityEffect(target as any, lightLevel);
        // Attacker blinded in darkness → disadvantage; target blinded → attacker has advantage
        const darkDisadvantage = attackerVision.blinded || attackerVision.disadvantage;
        const darkAdvantage = targetVision.blinded;

        const hasDodgeDisadvantage = target.statusEffects.some(e => e.id === 'dodge');
        const isSprinting = target.statusEffects.some(e => e.id === 'sprint_reckless');
        const isEvasive = target.statusEffects.some(e => e.id === 'evasive_movement');
        const isPhalanxTarget = target.statusEffects.some(e => e.id === 'phalanx_formation');
        const isHunkered = target.statusEffects.some(e => e.id === 'hunkered_down');

        const hasPressAdvantage = attacker.statusEffects.some(e => e.id === 'press_advantage');
        const isUnseen = attacker.statusEffects.some(e => e.id === 'unseen');
        const isFlanking = attacker.statusEffects.some(e => e.id === 'flanking');

        const featureAdvantage = featureContext?.forceAdvantage ?? false;
        const attackAdvantage = featureAdvantage || (!isRanged && (hasPressAdvantage || isUnseen || isFlanking)) || darkAdvantage;
        const attackDisadvantage = hasDodgeDisadvantage || forceDisadvantage || darkDisadvantage;
        // Advantage and disadvantage cancel each other out (D&D 5e)
        const finalAdvantage = (attackAdvantage && !attackDisadvantage) ? 'advantage' : 'none';
        const finalDisadvantage = (attackDisadvantage && !attackAdvantage) ? 'disadvantage' : 'none';

        const d20 = (finalAdvantage === 'advantage') ? Dice.advantage() :
            (finalDisadvantage === 'disadvantage') ? Dice.disadvantage() : Dice.d20();
        const critThreshold = featureContext?.critRange ?? 20;
        const isCrit = featureContext?.forceCrit || d20 >= critThreshold;

        // Calculate effective AC
        let effectiveAC = target.ac;
        // Apply AC bonuses from status effects (Shield, Mage Armor, etc.)
        if (target.statusEffects) {
            for (const eff of target.statusEffects) {
                if (eff.stat === 'ac' && typeof eff.modifier === 'number') {
                    effectiveAC += eff.modifier;
                }
            }
        }
        if (isSprinting) effectiveAC -= 2;
        if (isPhalanxTarget) effectiveAC += 1;
        if (isHunkered && !featureContext?.ignoreCover) {
            const cover = target.tactical?.cover || 'None';
            if (cover === 'Full') effectiveAC += 0;
            else if (cover === 'Three-Quarters') effectiveAC += 5;
            else if (cover === 'Half') effectiveAC += 2;
            else if (cover === 'Quarter') effectiveAC += 1;
        }

        // Evasive: +2 AC vs ranged attacks only
        const isRangedAttacker = isRanged || (attacker.tactical?.isRanged || false);
        if (isEvasive && (isRangedAttacker || forceDisadvantage)) effectiveAC += 2;

        // Calculate total attack bonus from modifiers
        const attackBonus = attackModifiers.reduce((sum, mod) => sum + mod.value, 0);
        const total = d20 + attackBonus;
        const hit = isCrit || total >= effectiveAC;

        let damage = 0;
        let message = '';

        if (hit) {
            damage = Dice.roll(damageFormula);
            // Great Weapon Fighting: reroll low damage dice
            if (featureContext?.rerollDamageBelow && damage <= featureContext.rerollDamageBelow) {
                damage = Dice.roll(damageFormula); // Reroll and must use new result
            }
            if (isCrit) {
                let critExtra = Dice.roll(damageFormula);
                if (featureContext?.rerollDamageBelow && critExtra <= featureContext.rerollDamageBelow) {
                    critExtra = Dice.roll(damageFormula);
                }
                damage += critExtra;
                message = `${attacker.name} scores a CRITICAL HIT on ${target.name}!`;
            } else {
                message = `${attacker.name} hits ${target.name}.`;
            }
            // Add stat modifier to damage (simplified)
            damage += statMod;

            // Sneak Attack (Rogue): requires finesse/ranged weapon + advantage or ally near target
            const sneakDice = featureContext?.sneakAttackDice ?? 0;
            if (sneakDice > 0 && featureContext?.isFinesseOrRanged) {
                const hasAdvantage = finalAdvantage === 'advantage';
                const hasAlly = featureContext?.hasAllyNearTarget ?? false;
                if (hasAdvantage || hasAlly) {
                    let sneakDmg = 0;
                    for (let i = 0; i < sneakDice; i++) sneakDmg += Dice.roll('1d6');
                    damage += sneakDmg;
                    if (isCrit) {
                        // Sneak Attack dice also double on crit
                        for (let i = 0; i < sneakDice; i++) sneakDmg += Dice.roll('1d6');
                        damage += sneakDmg;
                    }
                    message += ` Sneak Attack! (+${sneakDmg} damage)`;
                }
            }

            if (damage < 1) damage = 1;

            // Rage damage resistance: half bludgeoning/piercing/slashing
            if (target.statusEffects?.some(e => e.id === 'rage')) {
                // Physical damage types that Rage resists (simplified: weapon attacks are physical)
                const preDmg = damage;
                damage = Math.floor(damage / 2);
                if (damage < preDmg) {
                    message += ` (Rage halves to ${damage})`;
                }
            }

            message += ` Dealing ${damage} damage.`;
        } else {
            message = `${attacker.name} misses ${target.name}.`;
        }

        const rollDetails: RollDetails = {
            baseRoll: d20,
            modifiers: attackModifiers,
            total: total,
            isCrit: isCrit,
            isCritFail: d20 === 1
        };

        return {
            type: isCrit ? 'CRIT' : (hit ? 'HIT' : 'MISS'),
            damage,
            heal: 0,
            message,
            details: {
                roll: d20,
                modifier: attackBonus,
                total: total,
                targetAC: effectiveAC,
                isCrit: isCrit,
                rollDetails: rollDetails
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
        spellSaveDC: number,
        coverSaveBonus: number = 0 // +2 for half cover, +5 for three-quarters (D&D 5e)
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
            const totalMod = targetMod + coverSaveBonus;
            const saveTotal = saveRoll + totalMod;
            const saveSuccess = saveTotal >= spellSaveDC;

            type = saveSuccess ? 'SAVE_SUCCESS' : 'SAVE_FAIL';
            success = !saveSuccess;
            details = { roll: saveRoll, modifier: totalMod, total: saveTotal, saveDC: spellSaveDC, coverBonus: coverSaveBonus };

            const coverNote = coverSaveBonus > 0 ? ` (+${coverSaveBonus} cover)` : '';
            message = `${target.name} makes a ${saveAbility} save vs ${caster.name}'s ${spell.name}: ${saveRoll} + ${targetMod}${coverNote} = ${saveTotal}. `;
            message += saveSuccess ? `SUCCESS.` : `FAILURE.`;
        } else if (category === 'DAMAGE' || category === 'DEBUFF' || category === 'CONTROL') {
            // Default to Spell Attack if no save and it's offensive
            const hasDisadvantage = target.statusEffects.some(e => e.id === 'dodge');
            const isSprinting = target.statusEffects.some(e => e.id === 'sprint_reckless');
            const isEvasive = target.statusEffects.some(e => e.id === 'evasive_movement');

            const d20 = hasDisadvantage ? Dice.disadvantage() : Dice.d20();
            const isCrit = d20 === 20;

            // Calculate effective AC
            let effectiveAC = target.ac;
            if (isSprinting) effectiveAC -= 2;

            // Evasive: +2 AC vs aimed spells (ranged category spells that aren't AoE)
            const isAimed = !spell.save;
            if (isEvasive && isAimed) effectiveAC += 2;

            const total = d20 + spellAttackBonus;
            const hit = isCrit || total >= effectiveAC;

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

                    // Evasion (Rogue 7+, Monk 7+): DEX save success = 0 damage, fail = half
                    if (spell.save && (spell.save.ability === 'DEX' || spell.save.ability === 'dexterity')) {
                        const hasEvasion = target.statusEffects?.some(e => e.id === 'evasion') ||
                            (target as any).evasion;
                        if (hasEvasion) {
                            if (type === 'SAVE_SUCCESS') {
                                damage = 0;
                            } else {
                                damage = Math.floor(damage / 2);
                            }
                        }
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
