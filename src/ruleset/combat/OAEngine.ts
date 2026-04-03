/**
 * Opportunity Attack Engine
 *
 * Handles detection and resolution of opportunity attacks during combat movement.
 * D&D 5e: When a creature moves out of an enemy's reach, that enemy can use their
 * reaction to make one melee attack against the moving creature.
 *
 * Exceptions:
 * - Disengage action prevents OAs
 * - Sentinel feat: OA reduces target speed to 0; can OA when ally attacked within 5ft; ignore Disengage
 * - Polearm Master feat: enemies entering reach (10ft) provoke OA
 * - War Caster: NOT implemented (auto melee attack instead per design decision)
 */

import { CombatResolutionEngine } from './CombatResolutionEngine';
import { CombatGridManager } from './grid/CombatGridManager';
import { MechanicsEngine } from './MechanicsEngine';
import { Dice } from './Dice';

interface Combatant {
    id: string;
    name: string;
    hp: { current: number; max: number; temp: number };
    ac: number;
    stats: Record<string, number>;
    statusEffects: any[];
    conditions: any[];
    position: { x: number; y: number };
    tactical: { cover: string; reach: number; isRanged: boolean; range?: { normal: number; long: number } };
    type: string;
    isPlayer?: boolean;
    resources: { actionSpent: boolean; bonusActionSpent: boolean; reactionSpent: boolean };
    movementRemaining: number;
    [key: string]: any;
}

export interface OAResult {
    attackerId: string;
    attackerName: string;
    targetId: string;
    targetName: string;
    hit: boolean;
    damage: number;
    message: string;
    targetKilled: boolean;
    sentinelStopsMovement: boolean;  // Sentinel: target speed = 0
}

export interface OAWarning {
    combatantName: string;
    combatantId: string;
    reach: number; // in feet
}

export class OAEngine {

    /**
     * Check if a planned movement path would trigger OAs.
     * Returns warnings (for UI display on easy/normal difficulty).
     */
    public static getOAWarnings(
        mover: Combatant,
        path: { x: number; y: number }[],
        combatants: Combatant[],
        grid: CombatGridManager
    ): OAWarning[] {
        if (path.length < 2) return [];
        if (mover.statusEffects.some(e => e.id === 'disengage')) return [];

        const warnings: OAWarning[] = [];
        const startPos = path[0];

        // Find all enemies whose reach the mover is currently within
        const enemies = combatants.filter(c =>
            !this.areSameFaction(c, mover) && // Different faction
            c.hp.current > 0 &&
            !c.resources.reactionSpent &&
            c.id !== mover.id
        );

        for (const enemy of enemies) {
            const reachCells = Math.ceil((enemy.tactical.reach || 5) / 5);
            const distStart = grid.getDistance(startPos, enemy.position);

            // Currently in this enemy's reach?
            if (distStart <= reachCells) {
                // Check if any step in the path moves OUT of reach
                for (let i = 1; i < path.length; i++) {
                    const distStep = grid.getDistance(path[i], enemy.position);
                    if (distStep > reachCells) {
                        // Sentinel: can't be avoided by Disengage
                        const hasSentinel = (enemy as any).feats?.includes('Sentinel') ||
                            (enemy as any).statusEffects?.some((e: any) => e.id === 'sentinel');
                        warnings.push({
                            combatantName: enemy.name,
                            combatantId: enemy.id,
                            reach: (enemy.tactical.reach || 5),
                        });
                        break;
                    }
                }
            }

            // Polearm Master: entering reach also provokes (check for enemies with this feat)
            // For player as mover, this would be enemies with polearm — rare for monsters
            // For AI moving toward player, check if player has Polearm Master
        }

        return warnings;
    }

    /**
     * Resolve OAs along a movement path, step by step.
     * Returns results and the index at which movement should stop (if target killed or Sentinel).
     */
    public static resolveOAsOnPath(
        mover: Combatant,
        path: { x: number; y: number }[],
        combatants: Combatant[],
        grid: CombatGridManager,
        playerCharacter?: any // For feat checking on player
    ): { results: OAResult[]; stopAtIndex: number } {
        if (path.length < 2) return { results: [], stopAtIndex: path.length - 1 };

        const hasDisengage = mover.statusEffects.some(e => e.id === 'disengage');
        const results: OAResult[] = [];
        let stopAtIndex = path.length - 1;

        const enemies = combatants.filter(c =>
            !this.areSameFaction(c, mover) &&
            c.hp.current > 0 &&
            c.id !== mover.id
        );

        // Track which enemies have already attacked (one OA per enemy per movement)
        const attackedThisMove = new Set<string>();

        for (let stepIdx = 1; stepIdx <= stopAtIndex; stepIdx++) {
            const prevPos = path[stepIdx - 1];
            const currPos = path[stepIdx];

            for (const enemy of enemies) {
                if (attackedThisMove.has(enemy.id)) continue;
                if (enemy.resources.reactionSpent) continue;
                if (enemy.hp.current <= 0) continue;

                const reachCells = Math.ceil((enemy.tactical.reach || 5) / 5);
                const distPrev = grid.getDistance(prevPos, enemy.position);
                const distCurr = grid.getDistance(currPos, enemy.position);

                // Standard OA: was in reach, now leaving reach
                if (distPrev <= reachCells && distCurr > reachCells) {
                    // Check Sentinel: ignores Disengage
                    const hasSentinel = this.hasFeat(enemy, 'Sentinel', playerCharacter);

                    // Disengage prevents OA (unless Sentinel)
                    if (hasDisengage && !hasSentinel) continue;

                    const oaResult = this.executeOA(enemy, mover);
                    attackedThisMove.add(enemy.id);
                    enemy.resources.reactionSpent = true;

                    results.push(oaResult);

                    // If Sentinel and hit: target speed = 0 → stop movement
                    if (hasSentinel && oaResult.hit) {
                        oaResult.sentinelStopsMovement = true;
                        mover.movementRemaining = 0;
                        stopAtIndex = stepIdx;
                    }

                    // If target killed → stop movement
                    if (oaResult.targetKilled) {
                        stopAtIndex = stepIdx;
                        return { results, stopAtIndex };
                    }
                }

                // Polearm Master: entering reach provokes OA (on the enemy's side)
                // This means: if the MOVER is entering an enemy's reach AND the enemy has Polearm Master
                if (distPrev > reachCells && distCurr <= reachCells) {
                    const hasPolearm = this.hasFeat(enemy, 'Polearm Master', playerCharacter);
                    if (hasPolearm && reachCells >= 2) { // Only with actual reach weapon (10ft = 2 cells)
                        if (hasDisengage && !this.hasFeat(enemy, 'Sentinel', playerCharacter)) continue;

                        const oaResult = this.executeOA(enemy, mover);
                        attackedThisMove.add(enemy.id);
                        enemy.resources.reactionSpent = true;
                        oaResult.message = `${enemy.name} strikes with the butt-end as ${mover.name} enters reach! ` + oaResult.message;
                        results.push(oaResult);

                        if (oaResult.targetKilled) {
                            stopAtIndex = stepIdx;
                            return { results, stopAtIndex };
                        }
                    }
                }
            }

            // If movement was stopped by Sentinel, break
            if (stopAtIndex === stepIdx && results.some(r => r.sentinelStopsMovement)) break;
        }

        return { results, stopAtIndex };
    }

    /**
     * Execute a single opportunity attack.
     */
    private static executeOA(attacker: Combatant, target: Combatant): OAResult {
        // Determine attack bonus (STR mod + proficiency estimate)
        const strMod = MechanicsEngine.getModifier(attacker.stats.STR || 10);
        const dexMod = MechanicsEngine.getModifier(attacker.stats.DEX || 10);
        const statMod = attacker.tactical.isRanged ? dexMod : strMod;

        // Estimate proficiency from level or CR
        const prof = attacker.isPlayer ? MechanicsEngine.getProficiencyBonus((attacker as any).level || 1) :
            MechanicsEngine.getMonsterProficiency(Number((attacker as any).cr) || 1);

        const modifiers = [
            { label: attacker.tactical.isRanged ? 'DEX' : 'STR', value: statMod, source: 'Stat' },
            { label: 'Prof', value: prof, source: 'Rules' }
        ];

        // Damage formula: use default melee (simplified)
        const damageFormula = '1d8'; // Default weapon damage for OA
        const dmgBonus = statMod;

        const result = CombatResolutionEngine.resolveAttack(
            attacker as any, target as any, modifiers, damageFormula, dmgBonus,
            false, false, 'Bright'
        );

        // Apply damage to target
        if (result.damage > 0) {
            target.hp.current -= result.damage;
            if (target.hp.temp && target.hp.temp > 0) {
                const absorbed = Math.min(target.hp.temp, result.damage);
                target.hp.temp -= absorbed;
            }
        }

        const killed = target.hp.current <= 0;
        const hitMsg = result.type === 'CRIT'
            ? `CRITICAL opportunity attack!`
            : result.type === 'HIT'
                ? `Opportunity attack hits!`
                : `Opportunity attack misses.`;

        return {
            attackerId: attacker.id,
            attackerName: attacker.name,
            targetId: target.id,
            targetName: target.name,
            hit: result.damage > 0,
            damage: result.damage,
            message: `${attacker.name} makes an opportunity attack against ${target.name} as they leave reach. ${hitMsg}${result.damage > 0 ? ` ${result.damage} damage.` : ''}`,
            targetKilled: killed,
            sentinelStopsMovement: false,
        };
    }

    /**
     * Check if a combatant has a specific feat.
     * For player combatants, checks the playerCharacter data.
     * For others, checks playerCharacter (if it's the player) or a feats array on the combatant.
     */
    private static hasFeat(combatant: Combatant, featName: string, playerCharacter?: any): boolean {
        // If this combatant IS the player character
        if (combatant.isPlayer && playerCharacter?.feats) {
            return playerCharacter.feats.includes(featName);
        }
        // For companions/monsters: check a feats array if present on the combatant
        if ((combatant as any).feats?.includes(featName)) return true;
        // Also check via playerCharacter if the feat was passed as context for the enemy
        // (e.g., for Sentinel on an enemy — feats can be set on monster combatant data)
        return false;
    }

    /** Check if two combatants are on the same side (allies). */
    private static areSameFaction(a: Combatant, b: Combatant): boolean {
        const aFriendly = a.type === 'player' || a.type === 'companion' || a.type === 'summon';
        const bFriendly = b.type === 'player' || b.type === 'companion' || b.type === 'summon';
        return aFriendly === bFriendly; // Both friendly or both enemy
    }
}
