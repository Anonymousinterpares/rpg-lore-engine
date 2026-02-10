import { Combatant, GridPosition, TerrainFeature } from '../../schemas/CombatSchema';
import { CombatGridManager } from './CombatGridManager';

export interface TacticalOption {
    id: string;
    label: string;
    description: string;
    targetPosition: GridPosition;
    type: 'SAFETY' | 'FLANKING' | 'AGGRESSION' | 'RETREAT';
    command: string; // The actual game command to execute
}

export class CombatAnalysisEngine {
    private gridManager: CombatGridManager;

    constructor(gridManager: CombatGridManager) {
        this.gridManager = gridManager;
    }

    /**
     * Generates all contextual tactical options for a combatant.
     */
    public getContextualOptions(
        combatant: Combatant,
        allCombatants: Combatant[],
        biome: string
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        const reachable = this.gridManager.getReachablePositions(
            combatant.position,
            combatant.movementRemaining,
            allCombatants
        );

        const enemies = allCombatants.filter(c => !c.isPlayer && c.type === 'enemy' && c.hp.current > 0);
        const allies = allCombatants.filter(c => c.isPlayer || c.type === 'companion' || c.type === 'summon');

        // 1. Safety Options (Find Cover)
        const safetyOptions = this.getSafetyOptions(combatant, reachable, enemies, biome);
        options.push(...safetyOptions);

        // 2. Flanking Options
        const flankingOptions = this.getFlankingOptions(combatant, reachable, enemies, allies);
        options.push(...flankingOptions);

        // 3. Aggression Options (Close to Enemy)
        const aggressionOptions = this.getAggressionOptions(combatant, reachable, enemies);
        options.push(...aggressionOptions);

        // 4. Retreat Options
        const retreatOptions = this.getRetreatOptions(combatant, reachable, enemies, biome);
        options.push(...retreatOptions);

        return options;
    }

    /**
     * Safety Algorithm: Find positions with better cover.
     */
    private getSafetyOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        biome: string
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        // Calculate current safety score
        let currentSafety = 0;
        enemies.forEach(enemy => {
            const cover = this.gridManager.getCover(enemy.position, combatant.position);
            currentSafety += this.coverToScore(cover);
        });

        // Analyze each reachable position
        const candidates: { pos: GridPosition, score: number, feature?: TerrainFeature }[] = [];

        reachable.forEach(pos => {
            let safety = 0;
            enemies.forEach(enemy => {
                const cover = this.gridManager.getCover(enemy.position, pos);
                safety += this.coverToScore(cover);
            });

            // Find if there's a cover feature at or near this position
            const feature = this.gridManager.getFeatureAt(pos);

            if (safety > currentSafety) {
                candidates.push({ pos, score: safety, feature });
            }
        });

        // Pick top 2 safety positions
        candidates.sort((a, b) => b.score - a.score);
        candidates.slice(0, 2).forEach((candidate, idx) => {
            const featureName = candidate.feature
                ? this.getFeatureName(candidate.feature, biome)
                : 'Better Position';

            options.push({
                id: `safety_${idx}`,
                label: `Take Cover (${featureName})`,
                description: `Move to ${featureName} for better protection`,
                targetPosition: candidate.pos,
                type: 'SAFETY',
                command: `/move ${candidate.pos.x} ${candidate.pos.y}`
            });
        });

        return options;
    }

    /**
     * Flanking Algorithm: Find positions that flank engaged enemies.
     */
    private getFlankingOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        allies: Combatant[]
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        enemies.forEach(enemy => {
            // Check if any ally is adjacent to this enemy
            const engagedAlly = allies.find(ally => {
                const dist = this.gridManager.getDistance(ally.position, enemy.position);
                return dist === 1;
            });

            if (!engagedAlly) return;

            // Find positions that would flank this enemy
            reachable.forEach(pos => {
                const distToEnemy = this.gridManager.getDistance(pos, enemy.position);
                if (distToEnemy !== 1) return; // Must be adjacent

                // Geometric check: is this opposite the ally?
                const allyVector = {
                    x: engagedAlly.position.x - enemy.position.x,
                    y: engagedAlly.position.y - enemy.position.y
                };
                const myVector = {
                    x: pos.x - enemy.position.x,
                    y: pos.y - enemy.position.y
                };

                // Dot product < -0.3 means roughly opposite
                const dot = allyVector.x * myVector.x + allyVector.y * myVector.y;
                if (dot < -0.3) {
                    options.push({
                        id: `flank_${enemy.id}`,
                        label: `Flank ${enemy.name}`,
                        description: `Gain Advantage with ${engagedAlly.name}`,
                        targetPosition: pos,
                        type: 'FLANKING',
                        command: `/move ${pos.x} ${pos.y}`
                    });
                }
            });
        });

        return options;
    }

    /**
     * Aggression Algorithm: Move to engage enemies.
     */
    private getAggressionOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[]
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        enemies.forEach(enemy => {
            const path = this.gridManager.findPath(combatant.position, enemy.position, []);
            if (!path || path.length - 1 > combatant.movementRemaining) return;

            // Find the closest reachable position to the enemy
            let closest: GridPosition | null = null;
            let minDist = Infinity;

            reachable.forEach(pos => {
                const dist = this.gridManager.getDistance(pos, enemy.position);
                if (dist < minDist) {
                    minDist = dist;
                    closest = pos;
                }
            });

            if (closest !== null && minDist <= 1) {
                const targetPos: GridPosition = closest; // Explicit type assertion
                options.push({
                    id: `engage_${enemy.id}`,
                    label: `Approach ${enemy.name}`,
                    description: `Close to melee range (${minDist * 5}ft)`,
                    targetPosition: targetPos,
                    type: 'AGGRESSION',
                    command: `/move ${targetPos.x} ${targetPos.y}`
                });
            }
        });

        return options.slice(0, 2); // Limit to 2 enemies
    }

    /**
     * Retreat Algorithm: Move away from enemies.
     */
    private getRetreatOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        biome: string
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        // Find position farthest from nearest enemy
        let farthest: GridPosition | null = null;
        let maxDist = 0;

        reachable.forEach(pos => {
            let minEnemyDist = Infinity;
            enemies.forEach(enemy => {
                const dist = this.gridManager.getDistance(pos, enemy.position);
                minEnemyDist = Math.min(minEnemyDist, dist);
            });

            if (minEnemyDist > maxDist) {
                maxDist = minEnemyDist;
                farthest = pos;
            }
        });

        if (farthest !== null && maxDist > this.gridManager.getDistance(combatant.position, enemies[0]?.position || { x: 10, y: 10 })) {
            const targetPos: GridPosition = farthest; // Explicit type assertion
            options.push({
                id: 'retreat_back',
                label: 'Retreat',
                description: `Fall back to safer distance`,
                targetPosition: targetPos,
                type: 'RETREAT',
                command: `/move ${targetPos.x} ${targetPos.y}`
            });
        }

        return options;
    }

    private coverToScore(cover: 'None' | 'Half' | 'Three-Quarters' | 'Full'): number {
        switch (cover) {
            case 'Full': return 4;
            case 'Three-Quarters': return 3;
            case 'Half': return 2;
            default: return 0;
        }
    }

    private getFeatureName(feature: TerrainFeature, biome: string): string {
        const biomeMap: Record<string, Record<string, string>> = {
            'Forest': {
                'RUBBLE': 'Mossy Rock',
                'TREE': 'Oak Tree',
                'WALL': 'Ancient Root'
            },
            'Mountain': {
                'RUBBLE': 'Boulder',
                'TREE': 'Pine',
                'WALL': 'Cliff Face'
            },
            'Ruins': {
                'RUBBLE': 'Fallen Pillar',
                'TREE': 'Dead Tree',
                'WALL': 'Crumbling Wall'
            },
            'Swamp': {
                'RUBBLE': 'Overgrown Stone',
                'TREE': 'Mangrove',
                'WALL': 'Sunken Barrier'
            }
        };

        const biomeFeatures = biomeMap[biome] || biomeMap['Forest'];
        return biomeFeatures[feature.type] || feature.type;
    }
}
