import {
    CompanionStrategy, CombatContext, AIAction,
    getNearestTarget, buildAttackOrMove, hasSpellSlots
} from './CompanionStrategy';

/**
 * Caster Strategy — Wizard, Warlock, Sorcerer
 *
 * Behavior:
 * - Prefers ranged/spell attacks, avoids melee
 * - Uses strongest available spell on priority target
 * - If enemy is adjacent: retreats or uses Shield spell
 * - Conserves spell slots: uses cantrips when slots are low
 * - Targets weakest enemy (finish them off with magic)
 */
export class CasterStrategy implements CompanionStrategy {
    decideAutonomous(ctx: CombatContext): AIAction | null {
        const { actor, enemies, allies, grid } = ctx;

        // Check if any enemy is adjacent (danger — retreat or defend)
        const adjacentEnemy = enemies.find(e => grid.getDistance(actor.position, e.position) <= 1.5);

        if (adjacentEnemy) {
            // If has Shield spell and getting attacked → would be handled by reaction system
            // For now: retreat away or use a melee cantrip
            const retreatTarget = allies.find(a => a.isPlayer);
            if (retreatTarget && grid.getDistance(actor.position, retreatTarget.position) > 2) {
                // Move toward player for safety
                return { type: 'MOVE', targetId: retreatTarget.id };
            }
        }

        // Priority 1: Use offensive spells on the weakest enemy
        if (hasSpellSlots(actor)) {
            const offensiveSpell = (actor.preparedSpells || []).find((s: string) =>
                /magic missile|scorching ray|eldritch blast|hex|moonbeam|thunderwave|shatter|fire bolt/i.test(s)
            );
            if (offensiveSpell) {
                const weakest = [...enemies].sort((a, b) => a.hp.current - b.hp.current)[0];
                if (weakest) return { type: 'SPELL', targetId: weakest.id, actionId: offensiveSpell };
            }
        }

        // Priority 2: Cantrips (free, no slot cost) — check for Fire Bolt, Eldritch Blast etc.
        const cantrip = (actor.preparedSpells || []).find((s: string) =>
            /fire bolt|eldritch blast|ray of frost|chill touch|sacred flame|produce flame|vicious mockery/i.test(s)
        );
        if (cantrip) {
            const nearest = getNearestTarget(actor, enemies, grid);
            if (nearest) return { type: 'SPELL', targetId: nearest.id, actionId: cantrip };
        }

        // Fallback: attack with weapon (quarterstaff etc.)
        const nearest = getNearestTarget(actor, enemies, grid);
        return nearest ? buildAttackOrMove(actor, nearest, grid) : null;
    }
}
