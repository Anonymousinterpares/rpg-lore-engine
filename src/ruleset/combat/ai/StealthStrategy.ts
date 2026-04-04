import {
    CompanionStrategy, CombatContext, AIAction,
    getNearestTarget, buildAttackOrMove, hasSpellSlots
} from './CompanionStrategy';

/**
 * Stealth Strategy — Rogue, Ranger
 *
 * Behavior:
 * - Targets weakest enemy (finish off stragglers for Sneak Attack bonus)
 * - Prefers targets that allies are already adjacent to (flanking for Sneak Attack)
 * - Uses ranged attacks if has ranged weapon and target isn't adjacent
 * - Avoids being surrounded: if 2+ enemies adjacent, disengage/retreat
 * - Uses Hunter's Mark at start of combat (Ranger)
 */
export class StealthStrategy implements CompanionStrategy {
    decideAutonomous(ctx: CombatContext): AIAction | null {
        const { actor, enemies, allies, grid, state } = ctx;

        // Round 1: Ranger uses Hunter's Mark if available
        if (state.round <= 1 && hasSpellSlots(actor)) {
            const huntersMark = (actor.preparedSpells || []).find((s: string) =>
                /hunter's mark/i.test(s)
            );
            if (huntersMark) {
                const target = this.pickSneakTarget(enemies, allies, grid) || getNearestTarget(actor, enemies, grid);
                if (target) return { type: 'SPELL', targetId: target.id, actionId: huntersMark };
            }
        }

        // Check if surrounded (2+ enemies adjacent) — dodge to disengage
        const adjacentEnemies = enemies.filter(e => grid.getDistance(actor.position, e.position) <= 1.5);
        if (adjacentEnemies.length >= 2) {
            return { type: 'DODGE', targetId: actor.id }; // Disengage
        }

        // Priority: Pick sneak attack target (flanking)
        const sneakTarget = this.pickSneakTarget(enemies, allies, grid);
        if (sneakTarget) return buildAttackOrMove(actor, sneakTarget, grid);

        // Fallback: target weakest
        const weakest = [...enemies].sort((a, b) => a.hp.current - b.hp.current)[0];
        return weakest ? buildAttackOrMove(actor, weakest, grid) : null;
    }

    /**
     * Finds an enemy that an ally is adjacent to — enables Sneak Attack (flanking).
     * Prefers the weakest such target.
     */
    private pickSneakTarget(enemies: CombatContext['enemies'], allies: CombatContext['allies'], grid: CombatContext['grid']): CombatContext['enemies'][0] | null {
        const flankable = enemies.filter(enemy => {
            return allies.some(ally =>
                ally.id !== 'player' && // Don't count self
                grid.getDistance(ally.position, enemy.position) <= 1.5
            );
        });

        if (flankable.length === 0) return null;

        // Pick weakest flankable target
        return [...flankable].sort((a, b) => a.hp.current - b.hp.current)[0];
    }
}
