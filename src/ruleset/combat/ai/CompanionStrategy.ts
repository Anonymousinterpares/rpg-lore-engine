import { z } from 'zod';
import { CombatantSchema, CombatStateSchema } from '../../schemas/FullSaveStateSchema';
import { CombatGridManager } from '../grid/CombatGridManager';

export type Combatant = z.infer<typeof CombatantSchema>;
export type CombatState = z.infer<typeof CombatStateSchema>;

export interface AIAction {
    type: 'ATTACK' | 'SPELL' | 'ABILITY' | 'MOVE' | 'RETREAT' | 'DODGE';
    targetId: string;
    actionId?: string;
}

export interface CombatContext {
    actor: Combatant;
    enemies: Combatant[];
    allies: Combatant[];
    player: Combatant | undefined;
    grid: CombatGridManager;
    state: CombatState;
}

/**
 * Base interface for class-specific companion AI strategies.
 * Each strategy defines autonomous behavior — what the companion does
 * when no player directive overrides them, or how they enhance a directive.
 */
export interface CompanionStrategy {
    /**
     * Returns an autonomous action based on class logic.
     * Called when no directive is set, or the directive returned null.
     * Return null to fall through to default nearest-enemy behavior.
     */
    decideAutonomous(ctx: CombatContext): AIAction | null;
}

/**
 * Utility: find nearest target from a reference point.
 */
export function getNearestTarget(ref: Combatant, targets: Combatant[], grid: CombatGridManager): Combatant | null {
    if (targets.length === 0) return null;
    let nearest = targets[0];
    let minDist = Infinity;
    for (const t of targets) {
        const dist = grid.getDistance(ref.position, t.position);
        if (dist < minDist) { minDist = dist; nearest = t; }
    }
    return nearest;
}

/**
 * Utility: build ATTACK if in range, MOVE otherwise.
 */
export function buildAttackOrMove(actor: Combatant, target: Combatant, grid: CombatGridManager): AIAction {
    const distance = grid.getDistance(actor.position, target.position);
    let reach = actor.tactical?.isRanged ? 20 : Math.ceil((actor.tactical?.reach || 5) / 5);
    if (actor.tactical?.range) reach = Math.ceil(actor.tactical.range.long / 5);
    return distance <= reach
        ? { type: 'ATTACK', targetId: target.id }
        : { type: 'MOVE', targetId: target.id };
}

/**
 * Utility: check if actor has available spell slots.
 */
export function hasSpellSlots(actor: Combatant): boolean {
    if (!actor.spellSlots) return false;
    for (const lv of Object.keys(actor.spellSlots)) {
        if ((actor.spellSlots as any)[lv]?.current > 0) return true;
    }
    return false;
}

/**
 * Maps companion class to strategy archetype.
 */
export const CLASS_STRATEGY_MAP: Record<string, string> = {
    'Fighter': 'martial', 'Barbarian': 'martial',
    'Rogue': 'stealth', 'Ranger': 'stealth',
    'Wizard': 'caster', 'Warlock': 'caster', 'Sorcerer': 'caster',
    'Cleric': 'support', 'Druid': 'support', 'Bard': 'support',
    'Paladin': 'martial', 'Monk': 'martial',
};
