import { z } from 'zod';
import { CombatantSchema, CombatStateSchema } from '../schemas/FullSaveStateSchema';

type Combatant = z.infer<typeof CombatantSchema>;
type CombatState = z.infer<typeof CombatStateSchema>;

export enum AITier {
    FERAL = 0,    // INT 1-2: Attack nearest
    BEAST = 1,    // INT 3-6: Basic survival, pack tactics
    CUNNING = 2,  // INT 7-10: Target weak, use cover
    TACTICAL = 3, // INT 11-15: Target casters/healers
    STRATEGIC = 4 // INT 16+: Advanced party analysis
}

export interface AIAction {
    type: 'ATTACK' | 'SPELL' | 'ABILITY' | 'MOVE' | 'RETREAT';
    targetId: string;
    actionId?: string; // e.g., spell name or action name
}

export class CombatAI {
    /**
     * Derives AI tier from INT score
     */
    public static getTier(intScore: number): AITier {
        if (intScore <= 2) return AITier.FERAL;
        if (intScore <= 6) return AITier.BEAST;
        if (intScore <= 12) return AITier.CUNNING;
        if (intScore <= 15) return AITier.TACTICAL;
        return AITier.STRATEGIC;
    }

    /**
     * Decides the best action for a combatant
     */
    public static decideAction(actor: Combatant, state: CombatState): AIAction {
        const intScore = actor.stats['INT'] || 10;
        const tier = this.getTier(intScore);

        // Define "Enemies" based on actor type
        // If actor is enemy, targets are players/companions/summons
        // If actor is companion/summon, targets are enemies
        const targets = state.combatants.filter(c => {
            if (c.hp.current <= 0) return false;

            if (actor.type === 'enemy') {
                return c.type !== 'enemy';
            } else {
                return c.type === 'enemy';
            }
        });

        if (targets.length === 0) return { type: 'MOVE', targetId: '' };

        // 1. Survival Check (Tier 1+)
        if (tier >= AITier.BEAST && actor.hp.current < actor.hp.max * 0.2) {
            // Low health survival instinct
            if (tier >= AITier.TACTICAL) {
                // Tactical might try to heal or retreat to cover
                // For now, just generic retreat
                return { type: 'RETREAT', targetId: '' };
            }
            return { type: 'ATTACK', targetId: this.getNearestTarget(actor, targets).id }; // Fight back?
        }

        // 2. Target Selection
        let target = targets[0];
        switch (tier) {
            case AITier.FERAL:
                target = this.getNearestTarget(actor, targets);
                break;
            case AITier.BEAST:
                // Prioritize same target as allies
                target = this.getAllyTarget(actor, state, targets) || this.getNearestTarget(actor, targets);
                break;
            case AITier.CUNNING:
                // Target lowest HP (squishy)
                target = targets.sort((a, b) => a.hp.current - b.hp.current)[0];
                break;
            case AITier.TACTICAL:
            case AITier.STRATEGIC:
                // Prioritize "threats" (simplified: target with lowest max HP usually indicates a caster)
                target = targets.sort((a, b) => a.hp.max - b.hp.max)[0];
                break;
        }

        return { type: 'ATTACK', targetId: target.id };
    }

    private static getNearestTarget(actor: Combatant, targets: Combatant[]): Combatant {
        // Simplified distance (we don't have grid coords yet, so just pick first for now)
        return targets[0];
    }

    private static getAllyTarget(actor: Combatant, state: CombatState, enemies: Combatant[]): Combatant | null {
        // This would require tracking who allies are attacking
        return null;
    }
}
