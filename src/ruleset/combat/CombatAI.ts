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
    type: 'ATTACK' | 'SPELL' | 'ABILITY' | 'MOVE' | 'RETREAT' | 'DODGE';
    targetId: string;
    actionId?: string; // e.g., spell name or action name
}

export type DirectiveBehavior = 'AGGRESSIVE' | 'DEFENSIVE' | 'SUPPORT' | 'FOCUS' | 'PROTECT';

export interface TacticalDirective {
    behavior: DirectiveBehavior;
    targetName?: string;
    rawText: string;
}

/**
 * Parses player text input into a structured TacticalDirective.
 * Zero LLM calls — pure keyword matching.
 */
export function parseDirective(input: string, combatants: Combatant[]): TacticalDirective {
    const lower = input.toLowerCase().trim();

    // FOCUS: "focus <enemy>" / "attack <enemy>" / "kill <enemy>"
    const focusMatch = lower.match(/(?:focus|target|attack|kill|hit)\s+(?:the\s+)?(.+)/);
    if (focusMatch) {
        return { behavior: 'FOCUS', targetName: focusMatch[1].trim(), rawText: input };
    }

    // PROTECT: "protect <ally>" / "guard <ally>" / "defend <ally>"
    const protectMatch = lower.match(/(?:protect|guard|defend|shield|cover)\s+(?:the\s+)?(.+)/);
    if (protectMatch) {
        return { behavior: 'PROTECT', targetName: protectMatch[1].trim(), rawText: input };
    }

    // SUPPORT: "heal" / "support" / "help" / "buff"
    if (/\b(heal|support|help|buff|cure|restore|aid)\b/.test(lower)) {
        return { behavior: 'SUPPORT', rawText: input };
    }

    // DEFENSIVE: "defend" / "careful" / "stay back" / "dodge" / "tank" / "defensive"
    if (/\b(defend|defensive|careful|stay back|be careful|dodge|tank|cautious|hold position|hold the line|hang back|play safe|safe)\b/.test(lower)) {
        return { behavior: 'DEFENSIVE', rawText: input };
    }

    // AGGRESSIVE: "all out" / "charge" / "go all in" / "attack" (without target)
    if (/\b(aggressive|charge|all out|go all in|full attack|berser|rage|offensive)\b/.test(lower)) {
        return { behavior: 'AGGRESSIVE', rawText: input };
    }

    // Default: treat as AGGRESSIVE if nothing matches
    return { behavior: 'AGGRESSIVE', rawText: input };
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
     * Decides the best action for a combatant.
     * Companions read the player's tactical directive to modify behavior.
     */
    public static decideAction(actor: Combatant, state: CombatState): AIAction {
        if (!state.grid) {
            return { type: 'ATTACK', targetId: '' };
        }

        const gridManager = new CombatGridManager(state.grid);
        const intScore = actor.stats['INT'] || 10;
        const isCompanion = actor.type === 'companion';

        // Get per-companion directive first, then fall back to global party directive
        const perCompanion = isCompanion ? (state as any).companionDirectives?.[actor.id] as TacticalDirective | undefined : undefined;
        const globalDirective = isCompanion ? (state as any).partyDirective as TacticalDirective | undefined : undefined;
        const directive = perCompanion || globalDirective;

        // Identify potential targets
        const enemies = state.combatants.filter(c => {
            if (c.hp.current <= 0) return false;
            if (c.conditions?.some?.((cond: any) => (cond.id || cond) === 'Unconscious')) return false;
            return c.type === 'enemy';
        });

        const allies = state.combatants.filter(c => {
            if (c.hp.current <= 0) return false;
            return c.type === 'player' || c.type === 'companion' || c.type === 'summon';
        });

        // For enemies: target non-enemies. For allies: target enemies.
        const targets = actor.type === 'enemy'
            ? state.combatants.filter(c => c.hp.current > 0 && c.type !== 'enemy' && !c.conditions?.some?.((cond: any) => (cond.id || cond) === 'Unconscious'))
            : enemies;

        if (targets.length === 0) return { type: 'MOVE', targetId: '' };

        // --- COMPANION DIRECTIVE-DRIVEN BEHAVIOR ---
        if (isCompanion && directive) {
            const result = this.applyDirective(actor, directive, targets, allies, enemies, state, gridManager);
            if (result) return result;
        }

        // --- CLASS-SPECIFIC STRATEGY (companions without directive, or directive returned null) ---
        if (isCompanion) {
            try {
                const { getStrategyForCompanion, buildCombatContext } = require('./ai/StrategyRegistry');
                const strategy = getStrategyForCompanion(actor, state);
                if (strategy) {
                    const ctx = buildCombatContext(actor, state, gridManager);
                    const classAction = strategy.decideAutonomous(ctx);
                    if (classAction) return classAction;
                }
            } catch (e) {
                // Strategy module not loaded — fall through to default
            }
        }

        // --- DEFAULT BEHAVIOR (enemies, or companions with no strategy match) ---
        let primaryTarget = this.getNearestTarget(actor, targets, gridManager);
        if (!primaryTarget) return { type: 'MOVE', targetId: '' };

        return this.buildAttackOrMove(actor, primaryTarget, gridManager);
    }

    /**
     * Applies a player directive to modify companion behavior.
     * Returns an AIAction if the directive overrides default behavior, null otherwise.
     */
    private static applyDirective(
        actor: Combatant,
        directive: TacticalDirective,
        targets: Combatant[],
        allies: Combatant[],
        enemies: Combatant[],
        state: CombatState,
        grid: CombatGridManager
    ): AIAction | null {
        switch (directive.behavior) {
            case 'FOCUS': {
                // Target specific enemy by name
                if (directive.targetName) {
                    const named = targets.find(t =>
                        t.name.toLowerCase().includes(directive.targetName!.toLowerCase())
                    );
                    if (named) return this.buildAttackOrMove(actor, named, grid);
                }
                // Fallback: attack weakest enemy
                const weakest = [...targets].sort((a, b) => a.hp.current - b.hp.current)[0];
                return weakest ? this.buildAttackOrMove(actor, weakest, grid) : null;
            }

            case 'AGGRESSIVE': {
                // Attack weakest enemy (finish them off)
                const weakest = [...targets].sort((a, b) => a.hp.current - b.hp.current)[0];
                return weakest ? this.buildAttackOrMove(actor, weakest, grid) : null;
            }

            case 'DEFENSIVE': {
                // If low HP, dodge instead of attacking — check this FIRST
                if (actor.hp.current / actor.hp.max < 0.3) {
                    return { type: 'DODGE', targetId: actor.id };
                }
                // Prioritize enemies threatening the player
                const player = allies.find(a => a.isPlayer);
                if (player) {
                    const threatToPlayer = this.getNearestTarget(player, enemies, grid);
                    if (threatToPlayer) return this.buildAttackOrMove(actor, threatToPlayer, grid);
                }
                return null; // Fall through to default
            }

            case 'SUPPORT': {
                // Check if any ally needs healing (below 50% HP)
                const woundedAlly = allies
                    .filter(a => a.id !== actor.id && a.hp.current > 0)
                    .sort((a, b) => (a.hp.current / a.hp.max) - (b.hp.current / b.hp.max))[0];

                if (woundedAlly && woundedAlly.hp.current / woundedAlly.hp.max < 0.5) {
                    // Check if actor has healing spells
                    const healingSpell = (actor.preparedSpells || []).find((s: string) =>
                        /cure|heal|restore|mend/i.test(s)
                    );
                    if (healingSpell && this.hasSpellSlots(actor)) {
                        return { type: 'SPELL', targetId: woundedAlly.id, actionId: healingSpell };
                    }
                }
                // No healing available: attack nearest enemy (still useful)
                return null;
            }

            case 'PROTECT': {
                // Position near the named ally and attack enemies threatening them
                const targetName = directive.targetName?.toLowerCase();
                const isSelf = targetName === 'me' || targetName === 'player' || targetName === 'myself';
                const protectTarget = isSelf || !targetName
                    ? allies.find(a => a.isPlayer)
                    : allies.find(a => a.name.toLowerCase().includes(targetName));

                if (protectTarget) {
                    // Find enemy closest to the protected ally
                    const threatToAlly = this.getNearestTarget(protectTarget, enemies, grid);
                    if (threatToAlly) return this.buildAttackOrMove(actor, threatToAlly, grid);
                }
                return null;
            }
        }

        return null;
    }

    /**
     * Builds an ATTACK action if target is in range, MOVE otherwise.
     */
    private static buildAttackOrMove(actor: Combatant, target: Combatant, grid: CombatGridManager): AIAction {
        const distance = grid.getDistance(actor.position, target.position);
        let reach = actor.tactical?.isRanged ? 20 : Math.ceil((actor.tactical?.reach || 5) / 5);
        if (actor.tactical?.range) {
            reach = Math.ceil(actor.tactical.range.long / 5);
        }

        if (distance <= reach) {
            return { type: 'ATTACK', targetId: target.id };
        } else {
            return { type: 'MOVE', targetId: target.id };
        }
    }

    /**
     * Checks if a combatant has any spell slots remaining.
     */
    private static hasSpellSlots(actor: Combatant): boolean {
        if (!actor.spellSlots) return false;
        for (const lv of Object.keys(actor.spellSlots)) {
            if ((actor.spellSlots as any)[lv]?.current > 0) return true;
        }
        return false;
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
