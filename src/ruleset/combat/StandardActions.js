import { CombatEngine } from './CombatEngine';
import { Dice } from './Dice';
export const StandardActions = {
    /**
     * Standard Melee/Ranged Attack
     */
    attack: (attacker, target, bonus, damage, dmgBonus, isRanged = false) => {
        if (attacker.resources.actionSpent)
            return 'Action already spent.';
        // Determine advantage/disadvantage based on conditions
        let advantage = 'none';
        // Ranged in Melee rule
        if (isRanged && !attacker.conditions.includes('CrossbowExpert')) {
            // For now, we assume if we are attacking in combat, enemies are close.
            // A more robust system would need coordinates/distance.
            // Heuristic: If target has reach 5 and we are in combat, we are "in melee".
            advantage = 'disadvantage';
        }
        if (target.conditions.includes('Prone')) {
            if (isRanged)
                advantage = 'disadvantage';
            else
                advantage = 'advantage';
        }
        if (attacker.conditions.includes('Blinded'))
            advantage = 'disadvantage';
        if (target.conditions.includes('Invisible'))
            advantage = 'disadvantage';
        if (combatantIsDodging(target))
            advantage = 'disadvantage';
        const result = CombatEngine.resolveAttack(attacker, target, bonus, damage, dmgBonus, advantage);
        attacker.resources.actionSpent = true;
        return result.message;
    },
    /**
     * Dodge Action
     */
    dodge: (combatant) => {
        if (combatant.resources.actionSpent)
            return 'Action already spent.';
        combatant.conditions.push('Dodging');
        combatant.resources.actionSpent = true;
        return `${combatant.name} takes a defensive stance, focusing on dodging incoming attacks.`;
    },
    /**
     * Dash Action
     */
    dash: (combatant) => {
        if (combatant.resources.actionSpent)
            return 'Action already spent.';
        combatant.resources.actionSpent = true;
        return `${combatant.name} dashes forward, doubling their movement speed for this turn.`;
    },
    /**
     * Disengage Action
     */
    disengage: (combatant) => {
        if (combatant.resources.actionSpent)
            return 'Action already spent.';
        combatant.resources.actionSpent = true;
        return `${combatant.name} disengages, moving carefully to avoid opportunity attacks.`;
    },
    /**
     * Grapple Action
     */
    grapple: (attacker, target, attackerAthletics, targetAthleticsOrAcrobatics) => {
        if (attacker.resources.actionSpent)
            return 'Action already spent.';
        // Simplified contested check
        const attackRoll = Dice.d20() + attackerAthletics;
        const defenseRoll = Dice.d20() + targetAthleticsOrAcrobatics;
        attacker.resources.actionSpent = true;
        if (attackRoll >= defenseRoll) {
            target.conditions.push('Grappled');
            target.tactical.isGrappledBy = attacker.id;
            attacker.tactical.isGrappling = target.id;
            return `${attacker.name} successfully grapples ${target.name}! (${attackRoll} vs ${defenseRoll})`;
        }
        else {
            return `${attacker.name} fails to grapple ${target.name}. (${attackRoll} vs ${defenseRoll})`;
        }
    },
    /**
     * Shove Action
     */
    shove: (attacker, target, attackerAthletics, targetAthleticsOrAcrobatics, type) => {
        if (attacker.resources.actionSpent)
            return 'Action already spent.';
        const attackRoll = Dice.d20() + attackerAthletics;
        const defenseRoll = Dice.d20() + targetAthleticsOrAcrobatics;
        attacker.resources.actionSpent = true;
        if (attackRoll >= defenseRoll) {
            if (type === 'prone') {
                target.conditions.push('Prone');
                return `${attacker.name} shoves ${target.name} prone! (${attackRoll} vs ${defenseRoll})`;
            }
            else {
                return `${attacker.name} shoves ${target.name} 5 feet away! (${attackRoll} vs ${defenseRoll})`;
            }
        }
        else {
            return `${attacker.name} fails to shove ${target.name}. (${attackRoll} vs ${defenseRoll})`;
        }
    },
    /**
     * Two-Weapon Fighting Attack (Bonus Action)
     */
    twoWeaponAttack: (attacker, target, bonus, damage) => {
        if (attacker.resources.bonusActionSpent)
            return 'Bonus Action already spent.';
        // No modifier to damage for off-hand unless fighting style exists
        const result = CombatEngine.resolveAttack(attacker, target, bonus, damage, 0);
        attacker.resources.bonusActionSpent = true;
        return `[OFF-HAND] ${result.message}`;
    },
    /**
     * Opportunity Attack (Reaction)
     */
    opportunityAttack: (attacker, target, bonus, damage, dmgBonus) => {
        if (attacker.resources.reactionSpent)
            return 'Reaction already spent.';
        const result = CombatEngine.resolveAttack(attacker, target, bonus, damage, dmgBonus);
        attacker.resources.reactionSpent = true;
        return `[OPPORTUNITY ATTACK] ${result.message}`;
    },
    /**
     * Cast a Spell
     */
    castSpell: (caster, target, spell, slotLevel) => {
        if (caster.resources.actionSpent && spell.level > 0)
            return 'Action already spent.';
        // Use SpellcastingEngine for the heavy lifting
        const { SpellcastingEngine } = require('./SpellcastingEngine');
        const result = SpellcastingEngine.castSpell(caster, target, spell, slotLevel);
        if (!result.includes('cannot cast')) {
            caster.resources.actionSpent = true;
        }
        return result;
    }
};
function combatantIsDodging(c) {
    return c.conditions.includes('Dodging');
}
