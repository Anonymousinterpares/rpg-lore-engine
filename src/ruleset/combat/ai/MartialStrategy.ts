import {
    CompanionStrategy, CombatContext, AIAction,
    getNearestTarget, buildAttackOrMove, hasSpellSlots
} from './CompanionStrategy';

/**
 * Martial Strategy — Fighter, Barbarian, Paladin, Monk
 *
 * Behavior:
 * - Prioritizes enemies threatening the player (tank role)
 * - Uses Second Wind when below 40% HP
 * - Uses Action Surge when multiple enemies are adjacent
 * - Prefers melee targets; moves toward nearest enemy if out of range
 * - At low HP: still fights (martial pride) unless below 15%
 */
export class MartialStrategy implements CompanionStrategy {
    decideAutonomous(ctx: CombatContext): AIAction | null {
        const { actor, enemies, player, grid } = ctx;

        // Second Wind: if below 40% HP and has the feature available
        if (actor.hp.current / actor.hp.max < 0.4) {
            const hasSecondWind = (actor as any).featureUsages?.['Second Wind'];
            if (hasSecondWind && hasSecondWind.current > 0) {
                return { type: 'ABILITY', targetId: actor.id, actionId: 'Second Wind' };
            }
        }

        // Tank behavior: prioritize enemies adjacent to or threatening the player
        if (player) {
            const enemiesNearPlayer = enemies.filter(e => {
                const dist = grid.getDistance(player.position, e.position);
                return dist <= 2; // Within melee threat range
            });

            if (enemiesNearPlayer.length > 0) {
                // Attack the strongest threat to the player (highest HP = biggest danger)
                const biggestThreat = [...enemiesNearPlayer].sort((a, b) => b.hp.current - a.hp.current)[0];
                return buildAttackOrMove(actor, biggestThreat, grid);
            }
        }

        // Default: attack nearest enemy
        const nearest = getNearestTarget(actor, enemies, grid);
        return nearest ? buildAttackOrMove(actor, nearest, grid) : null;
    }
}
