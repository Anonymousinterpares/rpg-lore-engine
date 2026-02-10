import { Combatant, GridPosition, TerrainFeature } from '../../schemas/CombatSchema';
import { CombatGridManager } from './CombatGridManager';
import { Weather } from '../../schemas/BaseSchemas';
import { BIOME_TACTICAL_DATA } from '../BiomeRegistry';
import { NarrativeGenerator } from './NarrativeGenerator';

export interface TacticalSubOption {
    id: string;
    label: string;           // e.g., "⚡ Sprint to Cover"
    description: string;     // e.g., "30ft move, 20ft remaining"
    command: string;          // e.g., "/move 34 12 sprint"
    pros?: string[];
    cons?: string[];
}

export interface TacticalOption {
    id: string;
    label: string;
    description: string;
    targetPosition: GridPosition;
    type: 'SAFETY' | 'FLANKING' | 'AGGRESSION' | 'RETREAT' | 'COVER';
    command: string;
    pros?: string[];
    cons?: string[];
    risk?: string;
    subOptions?: TacticalSubOption[];
}

export class CombatAnalysisEngine {
    private gridManager: CombatGridManager;

    constructor(gridManager: CombatGridManager) {
        this.gridManager = gridManager;
    }

    public getContextualOptions(
        combatant: Combatant,
        allCombatants: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const options: TacticalOption[] = [];
        const reachable = this.gridManager.getReachablePositions(combatant.position, combatant.movementRemaining, allCombatants);
        const enemies = allCombatants.filter(c => !c.isPlayer && c.type === 'enemy' && c.hp.current > 0);
        const allies = allCombatants.filter(c => (c.isPlayer || c.type === 'companion' || c.type === 'summon') && c.id !== combatant.id);

        // 1. Aggression Options (Charge, Stalk, Press)
        options.push(...this.getAggressionOptions(combatant, reachable, enemies, allCombatants, biome, weather));

        // 2. Positioning & Safety (Hunker, High Ground, Corner Peek)
        options.push(...this.getSafetyOptions(combatant, reachable, enemies, biome, weather));

        // 3. Teamwork (Flank, Phalanx, Rescue)
        options.push(...this.getFlankingOptions(combatant, reachable, enemies, allies, biome, weather));

        // 4. Retreat Options (Fade, Withdraw, Vanish)
        options.push(...this.getRetreatOptions(combatant, reachable, enemies, allies, biome, weather));

        // 5. Environmental Awareness (Cover Approaches)
        options.push(...this.getCoverOptions(combatant, reachable, allCombatants, biome, weather));

        return options;
    }

    private getAggressionOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        allCombatants: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        enemies.forEach(enemy => {
            const dist = this.gridManager.getDistance(combatant.position, enemy.position);
            const pathDist = this.gridManager.getDistanceVector(combatant.position, enemy.position);

            // A1. Charge (Strict linear move, now uses Sprint speed for consistency)
            if (pathDist > 6 && pathDist === dist && weather.type !== 'Blizzard' && weather.type !== 'Snow') {
                const sprintSpeed = combatant.movementSpeed * 2;
                const targetPos = this.getApproachPosition(reachable, enemy.position, 1); // getApproachPosition uses reachable which might be 1x? need to check

                // Let's recalculate reachable for aggression if we want 2x range for Charge
                const reachableAggro = this.gridManager.getReachablePositions(combatant.position, sprintSpeed, allCombatants);
                const betterTargetPos = this.getApproachPosition(reachableAggro, enemy.position, 1);

                if (betterTargetPos) {
                    const actualMoveDist = this.gridManager.getDistance(combatant.position, betterTargetPos);
                    const nar = NarrativeGenerator.generate('charge', combatant, enemy.position, biome, weather, '', actualMoveDist);
                    options.push({
                        id: `charge_${enemy.id}`,
                        label: nar.label,
                        description: nar.description,
                        targetPosition: betterTargetPos,
                        type: 'AGGRESSION',
                        command: `/move ${betterTargetPos.x} ${betterTargetPos.y} sprint`,
                        pros: ['Move Max Speed (2x)'],
                        cons: ['Reckless (-2 AC)']
                    });
                }
            }

            // A2. Stalk (Stealthy approach)
            if (pathDist > 4) {
                const targetPos = this.getApproachPosition(reachable, enemy.position, 1);
                if (targetPos) {
                    const actualMoveDist = this.gridManager.getDistance(combatant.position, targetPos);
                    const nar = NarrativeGenerator.generate('stalk', combatant, enemy.position, biome, weather, '', actualMoveDist);
                    options.push({
                        id: `stalk_${enemy.id}`,
                        label: nar.label,
                        description: nar.description,
                        targetPosition: targetPos,
                        type: 'AGGRESSION',
                        command: `/move ${targetPos.x} ${targetPos.y}`,
                        pros: ['Stealth Check vs Biome DC', 'Potential Advantage'],
                        cons: ['Half Speed']
                    });
                }
            }

            // A3. Press (Close engagement)
            if (dist <= 2) {
                const targetPos = this.getApproachPosition(reachable, enemy.position, 1);
                if (targetPos) {
                    const nar = NarrativeGenerator.generate('press', combatant, enemy, biome, weather, '');
                    options.push({
                        id: `press_${enemy.id}`,
                        label: nar.label,
                        description: nar.description,
                        targetPosition: targetPos,
                        type: 'AGGRESSION',
                        command: `/move ${targetPos.x} ${targetPos.y}`
                    });
                }
            }
        });

        return options.slice(0, 3);
    }

    private getSafetyOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const options: TacticalOption[] = [];
        const candidates: { pos: GridPosition, score: number, feature: TerrainFeature }[] = [];

        reachable.forEach(pos => {
            const feature = this.gridManager.getFeatureAt(pos);
            if (!feature) return;

            let safety = 0;
            enemies.forEach(enemy => {
                safety += this.coverToScore(this.gridManager.getCover(enemy.position, pos));
            });

            if (safety > 0) candidates.push({ pos, score: safety, feature });
        });

        candidates.sort((a, b) => b.score - a.score);
        candidates.slice(0, 3).forEach((c, idx) => {
            const relDir = this.gridManager.getRelativeDirection(combatant.position, c.pos);
            const nar = NarrativeGenerator.generate('hunker_down', combatant, c.feature, biome, weather, relDir);
            options.push({
                id: `safety_${idx}`,
                label: nar.label,
                description: nar.description,
                targetPosition: c.pos,
                type: 'SAFETY',
                command: `/move ${c.pos.x} ${c.pos.y}`,
                pros: [c.feature.coverBonus === 'FULL' ? '+5 AC' : '+2 AC']
            });
        });

        return options;
    }

    private getFlankingOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        allies: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        enemies.forEach(enemy => {
            const engagedAlly = allies.find(ally => this.gridManager.getDistance(ally.position, enemy.position) === 1);
            if (!engagedAlly) return;

            reachable.forEach(pos => {
                if (this.gridManager.getDistance(pos, enemy.position) !== 1) return;

                const allyVec = { x: engagedAlly.position.x - enemy.position.x, y: engagedAlly.position.y - enemy.position.y };
                const myVec = { x: pos.x - enemy.position.x, y: pos.y - enemy.position.y };
                const dot = allyVec.x * myVec.x + allyVec.y * myVec.y;

                if (dot < -0.3) {
                    const nar = NarrativeGenerator.generate('flank', combatant, enemy, biome, weather, this.gridManager.getRelativeDirection(combatant.position, pos));
                    options.push({
                        id: `flank_${enemy.id}`,
                        label: nar.label,
                        description: nar.description,
                        targetPosition: pos,
                        type: 'FLANKING',
                        command: `/move ${pos.x} ${pos.y}`,
                        pros: ['Advantage on Melee']
                    });
                }
            });
        });

        // Phalanx logic
        allies.forEach(ally => {
            if (this.gridManager.getDistance(combatant.position, ally.position) <= 2) {
                const adjToAlly = reachable.find(p => this.gridManager.getDistance(p, ally.position) === 1);
                if (adjToAlly) {
                    const nar = NarrativeGenerator.generate('phalanx', combatant, ally, biome, weather, '');
                    options.push({
                        id: `phalanx_${ally.id}`,
                        label: nar.label,
                        description: nar.description,
                        targetPosition: adjToAlly,
                        type: 'FLANKING',
                        command: `/move ${adjToAlly.x} ${adjToAlly.y}`,
                        pros: ['+1 AC from Cover'],
                        cons: ['AoE Vulnerability']
                    });
                }
            }
        });

        return options.slice(0, 3);
    }

    private getRetreatOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        allies: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        // Farthest point from enemies - Only show if in melee or close (<= 2 cells / 10ft)
        const isNearEnemy = enemies.some(e => this.gridManager.getDistance(combatant.position, e.position) <= 2);
        if (!isNearEnemy) return [];

        let farthest: GridPosition | null = null;
        let maxDist = 0;
        reachable.forEach(pos => {
            let minDist = Math.min(...enemies.map(e => this.gridManager.getDistance(pos, e.position)));
            if (minDist > maxDist) {
                maxDist = minDist;
                farthest = pos;
            }
        });

        if (farthest) {
            const actualMoveDist = this.gridManager.getDistance(combatant.position, farthest);
            const nar = NarrativeGenerator.generate('fade_back', combatant, null, biome, weather, '', actualMoveDist, maxDist);
            const targetPos: GridPosition = farthest;
            options.push({
                id: 'retreat_fade',
                label: nar.label,
                description: nar.description,
                targetPosition: targetPos,
                type: 'RETREAT',
                command: `/move ${targetPos.x} ${targetPos.y}`,
                cons: ['Provokes Opportunity Attack']
            });
        }

        // Vanish (if Fog or cover nearby)
        if (weather.type === 'Fog' || weather.type === 'Storm') {
            const nar = NarrativeGenerator.generate('vanish', combatant, null, biome, weather, '');
            options.push({
                id: 'retreat_vanish',
                label: nar.label,
                description: nar.description,
                targetPosition: combatant.position,
                type: 'RETREAT',
                command: `/hide`,
                pros: ['Hide Check vs Biome DC']
            });
        }

        return options;
    }

    private getCoverOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        allCombatants: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const features = this.gridManager.getAllFeatures();
        const coverFeatures = features
            .filter(f => f.coverBonus !== 'NONE')
            .map(f => ({
                feature: f,
                dist: this.gridManager.getDistance(combatant.position, f.position),
                featureName: this.getFeatureName(f, biome)
            }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 4); // Top 4 nearest covers

        return coverFeatures.map(item => {
            const fullSpeed = combatant.movementRemaining;
            const sprintSpeed = combatant.movementSpeed * 2; // Sprint = Dash (2x base speed)
            const halfSpeed = Math.floor(fullSpeed / 2);
            const relDir = this.gridManager.getRelativeDirection(combatant.position, item.feature.position);

            // Calculate approach positions for each mode
            const sprintPos = this.getApproachPositionWithRange(
                combatant.position, item.feature.position, sprintSpeed, allCombatants);
            const normalPos = this.getApproachPositionWithRange(
                combatant.position, item.feature.position, fullSpeed, allCombatants);
            const evasivePos = this.getApproachPositionWithRange(
                combatant.position, item.feature.position, halfSpeed, allCombatants);

            const sprintDist = sprintPos ? this.gridManager.getDistance(combatant.position, sprintPos) : 0;
            const normalDist = normalPos ? this.gridManager.getDistance(combatant.position, normalPos) : 0;
            const evasiveDist = evasivePos ? this.gridManager.getDistance(combatant.position, evasivePos) : 0;
            const sprintRemaining = Math.max(0, item.dist - sprintDist);
            const normalRemaining = Math.max(0, item.dist - normalDist);
            const evasiveRemaining = Math.max(0, item.dist - evasiveDist);

            const coverLabel = item.feature.coverBonus === 'FULL' ? 'Full Cover'
                : item.feature.coverBonus === 'THREE_QUARTERS' ? '¾ Cover (+5 AC)'
                    : 'Half Cover (+2 AC)';

            return {
                id: `cover_${item.feature.id}`,
                label: `${item.featureName} — ${coverLabel}`,
                description: `${relDir}, ${item.dist * 5}ft away${sprintRemaining === 0 ? ' — ✓ Reachable' : ''}`,
                targetPosition: item.feature.position,
                type: 'COVER',
                command: '', // Parent item is informational/grouping only
                subOptions: [
                    {
                        id: `cover_sprint_${item.feature.id}`,
                        label: '⚡ Sprint to Cover',
                        description: sprintRemaining === 0
                            ? `${sprintDist * 5}ft (arrive!)`
                            : `${sprintDist * 5}ft move, ${sprintRemaining * 5}ft remaining`,
                        command: sprintPos ? `/move ${sprintPos.x} ${sprintPos.y} sprint` : '',
                        cons: ['-2 AC']
                    },
                    {
                        id: `cover_approach_${item.feature.id}`,
                        label: '🏃 Approach Cover',
                        description: normalRemaining === 0
                            ? `${normalDist * 5}ft (arrive!)`
                            : `${normalDist * 5}ft move, ${normalRemaining * 5}ft remaining`,
                        command: normalPos ? `/move ${normalPos.x} ${normalPos.y}` : ''
                    },
                    {
                        id: `cover_evasive_${item.feature.id}`,
                        label: '🐍 Evasive Approach',
                        description: evasiveRemaining === 0
                            ? `${evasiveDist * 5}ft (arrive!)`
                            : `${evasiveDist * 5}ft move, ${evasiveRemaining * 5}ft remaining`,
                        command: evasivePos ? `/move ${evasivePos.x} ${evasivePos.y} evasive` : '',
                        pros: ['+2 vs Ranged']
                    }
                ]
            };
        });
    }

    private getFeatureName(feature: TerrainFeature, biome: string): string {
        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];
        return biomeData.features[feature.type] || feature.type;
    }

    private getApproachPositionWithRange(
        start: GridPosition,
        target: GridPosition,
        maxRange: number,
        occupants: Combatant[]
    ): GridPosition | null {
        const path = this.gridManager.findPath(start, target, occupants);
        if (!path || path.length <= 1) return null;

        // Find how many steps we can take (excluding the target cell itself as it's occupied by a feature)
        // A feature is NOT an occupant in the pathfinder sense usually, but path[path.length-1] is the target.
        const stepsToCover = path.length - 1;
        const actualSteps = Math.min(maxRange, stepsToCover);

        // If we reach the cover, we stay adjacent to it or on it? 
        // Ruleset says: move to the cover. If feature is walkable, we can be on it.
        // Let's assume we move as far as the path allowed.
        return path[actualSteps];
    }

    private getApproachPosition(reachable: GridPosition[], target: GridPosition, idealDist: number): GridPosition | null {
        let best: GridPosition | null = null;
        let minDist = Infinity;
        reachable.forEach(pos => {
            const d = this.gridManager.getDistance(pos, target);
            if (d < minDist && d >= idealDist) {
                minDist = d;
                best = pos;
            }
        });
        return best;
    }

    private coverToScore(cover: 'None' | 'Half' | 'Three-Quarters' | 'Full'): number {
        switch (cover) {
            case 'Full': return 4;
            case 'Three-Quarters': return 3;
            case 'Half': return 2;
            default: return 0;
        }
    }
}
