import { CombatantState } from './types';
import { Dice } from './Dice';
import { hasCondition, addCondition, removeCondition } from './ConditionUtils';

export interface DeathSaveResult {
    success: boolean;
    critical: boolean; // 1 or 20
    message: string;
    totalSuccesses: number;
    totalFailures: number;
    isDead: boolean;
    isRevived: boolean;
}

export class DeathEngine {
    /**
     * Handles the state change when a combatant drops to 0 HP.
     */
    public static handleDowned(combatant: CombatantState): string {
        if (!hasCondition(combatant.conditions, 'Unconscious')) {
            addCondition(combatant.conditions, 'Unconscious');
        }

        // Initialize death saves tracker
        if (combatant.isPlayer) {
            combatant.deathSaves = { successes: 0, failures: 0 };
            return `${combatant.name} has fallen and is making death saving throws!`;
        } else {
            return `${combatant.name} has been defeated.`;
        }
    }

    /**
     * Rolls a death saving throw for a player character.
     * Tracks cumulative successes/failures on the combatant's deathSaves field.
     * 3 successes = stabilized. 3 failures = dead. Nat 20 = revive at 1 HP. Nat 1 = 2 failures.
     */
    public static rollDeathSave(combatant: CombatantState): DeathSaveResult {
        if (!combatant.deathSaves) {
            combatant.deathSaves = { successes: 0, failures: 0 };
        }

        const roll = Dice.roll('1d20');
        let isDead = false;
        let isRevived = false;

        if (roll === 20) {
            // Natural 20: regain 1 HP, conscious
            combatant.hp.current = 1;
            removeCondition(combatant.conditions, 'Unconscious');
            combatant.deathSaves = { successes: 0, failures: 0 };
            isRevived = true;
            return {
                success: true, critical: true,
                message: `Natural 20! ${combatant.name} regains 1 HP and is conscious!`,
                totalSuccesses: 0, totalFailures: 0,
                isDead: false, isRevived: true
            };
        }

        if (roll === 1) {
            // Natural 1: counts as two failures
            combatant.deathSaves.failures += 2;
        } else if (roll >= 10) {
            combatant.deathSaves.successes += 1;
        } else {
            combatant.deathSaves.failures += 1;
        }

        const { successes, failures } = combatant.deathSaves;

        if (failures >= 3) {
            isDead = true;
            addCondition(combatant.conditions, 'Dead');
        } else if (successes >= 3) {
            // Stabilized at 0 HP
            removeCondition(combatant.conditions, 'Unconscious');
            addCondition(combatant.conditions, 'Stable');
            combatant.deathSaves = { successes: 0, failures: 0 };
        }

        const rollMsg = roll === 1
            ? `Natural 1! Two failures. (${successes}/${failures})`
            : roll >= 10
                ? `Rolled ${roll}: Success. (${successes} successes, ${failures} failures)`
                : `Rolled ${roll}: Failure. (${successes} successes, ${failures} failures)`;

        return {
            success: roll >= 10 && roll !== 1,
            critical: roll === 1,
            message: `${combatant.name}: ${rollMsg}${isDead ? ' — DEAD!' : ''}`,
            totalSuccesses: successes,
            totalFailures: failures,
            isDead,
            isRevived
        };
    }

    /**
     * Resets death save tracking (called when healed above 0 HP).
     */
    public static resetDeathSaves(combatant: CombatantState): void {
        combatant.deathSaves = { successes: 0, failures: 0 };
        removeCondition(combatant.conditions, 'Unconscious');
        removeCondition(combatant.conditions, 'Stable');
    }

    /**
     * Attempts to stabilize a dying creature.
     */
    public static stabilize(medic: CombatantState, target: CombatantState, medicineBonus: number): string {
        if (!hasCondition(target.conditions, 'Unconscious')) return `${target.name} is not unconscious.`;

        const roll = Dice.roll('1d20') + medicineBonus;
        if (roll >= 10) {
            removeCondition(target.conditions, 'Unconscious');
            addCondition(target.conditions, 'Stable');
            target.hp.current = 0; // Stable at 0 HP
            target.deathSaves = { successes: 0, failures: 0 };
            return `${medic.name} stabilized ${target.name}.`;
        }
        return `${medic.name} failed to stabilize ${target.name} (Rolled ${roll}).`;
    }
}
