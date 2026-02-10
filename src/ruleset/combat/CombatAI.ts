import { z } from 'zod';
import { CombatantSchema, CombatStateSchema } from '../schemas/FullSaveStateSchema';
import { CombatGridManager } from './grid/CombatGridManager';

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
        if (!state.grid) {
            // Fallback if no grid exists (should not happen in valid combat)
            return { type: 'ATTACK', targetId: '' };
        }

        // 1. Setup Grid Manager for Spatial Reasoning
        const gridManager = new CombatGridManager(state.grid);

        const intScore = actor.stats['INT'] || 10;
        const tier = this.getTier(intScore);

        // 2. Identify Potential Targets
        const targets = state.combatants.filter(c => {
            if (c.hp.current <= 0) return false;
            return actor.type === 'enemy' ? c.type !== 'enemy' : c.type === 'enemy';
        });

        if (targets.length === 0) return { type: 'MOVE', targetId: '' };

        // 3. Select Primary Target (Strategy Phase)
        let primaryTarget: Combatant | null = null;

        // Simple targeting logic based on tier
        if (tier >= AITier.BEAST) {
            // Tier 1+: Stick to closest or weak
            primaryTarget = this.getNearestTarget(actor, targets, gridManager);
        } else {
            // Feral: Just closest
            primaryTarget = this.getNearestTarget(actor, targets, gridManager);
        }

        if (!primaryTarget) return { type: 'MOVE', targetId: '' };

        // 4. Range Verification (Tactical Phase)
        const distance = gridManager.getDistance(actor.position, primaryTarget.position);

        // Default reach is 1 (5ft), unless specified otherwise
        const reach = 1;

        if (distance <= reach) {
            // Target is in range -> ATTACK
            return { type: 'ATTACK', targetId: primaryTarget.id };
        } else {
            // Target is out of range -> MOVE to closest valid position
            // Find a path to the target
            // NOTE: The GameLoop will handle the actual pathfinding and movement execution
            // We just signal the intent to MOVE towards this target
            return { type: 'MOVE', targetId: primaryTarget.id };
        }
    }

    private static getNearestTarget(actor: Combatant, targets: Combatant[], grid: CombatGridManager): Combatant {
        let nearest: Combatant = targets[0];
        let minDist = Infinity;

        for (const t of targets) {
            const dist = grid.getDistance(actor.position, t.position);
            if (dist < minDist) {
                minDist = dist;
                nearest = t;
            }
        }
        return nearest;
    }

    private static getAllyTarget(actor: Combatant, state: CombatState, enemies: Combatant[]): Combatant | null {
        // Placeholder for Pack Tactics
        return null;
    }
}
