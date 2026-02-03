import { Dice } from './Dice';
export class DeathEngine {
    /**
     * Handles the state change when a combatant drops to 0 HP.
     */
    static handleDowned(combatant) {
        if (!combatant.conditions.includes('Unconscious')) {
            combatant.conditions.push('Unconscious');
        }
        if (combatant.isPlayer) {
            return `${combatant.name} has fallen and is making death saving throws!`;
        }
        else {
            return `${combatant.name} has been defeated.`;
        }
    }
    /**
     * Rolls a death saving throw for a player character.
     * In a real implementation, we'd need to track successes/failures in the state.
     * This is the logic; the state tracking should be in the GameLoop/State.
     */
    static rollDeathSave() {
        const roll = Dice.roll('1d20');
        if (roll === 20) {
            return { success: true, critical: true, message: 'Natural 20! You regain 1 HP and are conscious.' };
        }
        if (roll === 1) {
            return { success: false, critical: true, message: 'Natural 1! Two failures.' };
        }
        if (roll >= 10) {
            return { success: true, critical: false, message: `Rolled ${roll}: Success.` };
        }
        return { success: false, critical: false, message: `Rolled ${roll}: Failure.` };
    }
    /**
     * Attempts to stabilize a dying creature.
     */
    static stabilize(medic, target, medicineBonus) {
        if (!target.conditions.includes('Unconscious'))
            return `${target.name} is not unconscious.`;
        const roll = Dice.roll('1d20') + medicineBonus;
        if (roll >= 10) {
            target.conditions = target.conditions.filter(c => c !== 'Unconscious');
            target.hp.current = 0; // Stable at 0 HP
            return `${medic.name} stabilized ${target.name}.`;
        }
        return `${medic.name} failed to stabilize ${target.name} (Rolled ${roll}).`;
    }
}
