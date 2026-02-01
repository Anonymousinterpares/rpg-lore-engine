import { CombatEngine } from './CombatEngine';
import { CombatantState } from './types';
import { Dice } from './Dice';

export const StandardActions = {
    /**
     * Standard Melee/Ranged Attack
     */
    attack: (attacker: CombatantState, target: CombatantState, bonus: number, damage: string, dmgBonus: number) => {
        if (attacker.resources.actionSpent) return 'Action already spent.';

        // Determine advantage/disadvantage based on conditions
        let advantage: 'none' | 'advantage' | 'disadvantage' = 'none';
        if (target.conditions.includes('Prone')) advantage = 'advantage'; // Simple ruling for melee-like
        if (attacker.conditions.includes('Blinded')) advantage = 'disadvantage';
        if (target.conditions.includes('Invisible')) advantage = 'disadvantage';

        const result = CombatEngine.resolveAttack(attacker, target, bonus, damage, dmgBonus, advantage);
        attacker.resources.actionSpent = true;
        return result.message;
    },

    /**
     * Dodge Action
     */
    dodge: (combatant: CombatantState) => {
        if (combatant.resources.actionSpent) return 'Action already spent.';
        combatant.conditions.push('Dodging');
        combatant.resources.actionSpent = true;
        return `${combatant.name} takes a defensive stance, focusing on dodging incoming attacks.`;
    },

    /**
     * Dash Action
     */
    dash: (combatant: CombatantState) => {
        if (combatant.resources.actionSpent) return 'Action already spent.';
        combatant.resources.actionSpent = true;
        return `${combatant.name} dashes forward, doubling their movement speed for this turn.`;
    },

    /**
     * Disengage Action
     */
    disengage: (combatant: CombatantState) => {
        if (combatant.resources.actionSpent) return 'Action already spent.';
        combatant.resources.actionSpent = true;
        return `${combatant.name} disengages, moving carefully to avoid opportunity attacks.`;
    }
};
