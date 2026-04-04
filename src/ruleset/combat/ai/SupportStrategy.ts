import {
    CompanionStrategy, CombatContext, AIAction,
    getNearestTarget, buildAttackOrMove, hasSpellSlots
} from './CompanionStrategy';

/**
 * Support Strategy — Cleric, Druid, Bard
 *
 * Behavior:
 * - PROACTIVE healing: heals any ally below 50% HP without needing SUPPORT directive
 * - Prioritizes the most wounded ally
 * - If no healing needed: uses offensive spells if available, otherwise attacks
 * - Stays at range when possible (positions away from melee)
 * - Uses Bless/buff spells at start of combat (round 1)
 */
export class SupportStrategy implements CompanionStrategy {
    decideAutonomous(ctx: CombatContext): AIAction | null {
        const { actor, enemies, allies, grid, state } = ctx;

        // Priority 1: Heal wounded allies (below 50% HP) — PROACTIVE, no directive needed
        const woundedAllies = allies
            .filter(a => a.id !== actor.id && a.hp.current > 0 && a.hp.current / a.hp.max < 0.5)
            .sort((a, b) => (a.hp.current / a.hp.max) - (b.hp.current / b.hp.max));

        if (woundedAllies.length > 0 && hasSpellSlots(actor)) {
            const healSpell = (actor.preparedSpells || []).find((s: string) =>
                /cure|heal|restore|mend|healing word/i.test(s)
            );
            if (healSpell) {
                return { type: 'SPELL', targetId: woundedAllies[0].id, actionId: healSpell };
            }
        }

        // Priority 2: Buff at start of combat (round 1) — Bless, Bless, Shield of Faith
        if (state.round <= 1 && hasSpellSlots(actor)) {
            const buffSpell = (actor.preparedSpells || []).find((s: string) =>
                /bless|barkskin|shield of faith/i.test(s)
            );
            if (buffSpell) {
                // Buff the player or self
                const buffTarget = allies.find(a => a.isPlayer) || actor;
                return { type: 'SPELL', targetId: buffTarget.id, actionId: buffSpell };
            }
        }

        // Priority 3: Offensive spell if has one and slots available
        if (hasSpellSlots(actor)) {
            const offensiveSpell = (actor.preparedSpells || []).find((s: string) =>
                /guiding bolt|spiritual weapon|moonbeam|thunderwave|shatter|sacred flame/i.test(s)
            );
            if (offensiveSpell) {
                const nearest = getNearestTarget(actor, enemies, grid);
                if (nearest) return { type: 'SPELL', targetId: nearest.id, actionId: offensiveSpell };
            }
        }

        // Priority 4: Melee attack as last resort
        const nearest = getNearestTarget(actor, enemies, grid);
        return nearest ? buildAttackOrMove(actor, nearest, grid) : null;
    }
}
