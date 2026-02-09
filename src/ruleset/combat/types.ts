import { CombatantSchema as CombatantStateSchema, Combatant as CombatantState } from '../schemas/CombatSchema';

export { CombatantStateSchema };
export type { CombatantState };

export interface CombatAction {
    name: string;
    description: string;
    execute: (source: CombatantState, target: CombatantState) => string;
}
