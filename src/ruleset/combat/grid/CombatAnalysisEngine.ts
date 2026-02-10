import { Combatant, GridPosition, TerrainFeature } from '../../schemas/CombatSchema';
import { CombatGridManager } from './CombatGridManager';
import { Weather } from '../../schemas/BaseSchemas';
import { BIOME_TACTICAL_DATA } from '../BiomeRegistry';
import { NarrativeGenerator } from './NarrativeGenerator';

export interface TacticalOption {
    id: string;
    label: string;
    description: string;
    targetPosition: GridPosition;
    type: 'SAFETY' | 'FLANKING' | 'AGGRESSION' | 'RETREAT';
    command: string;
    pros?: string[];
    cons?: string[];
    risk?: string;
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
        options.push(...this.getAggressionOptions(combatant, reachable, enemies, biome, weather));

        // 2. Positioning & Safety (Hunker, High Ground, Corner Peek)
        options.push(...this.getSafetyOptions(combatant, reachable, enemies, biome, weather));

        // 3. Teamwork (Flank, Phalanx, Rescue)
        options.push(...this.getFlankingOptions(combatant, reachable, enemies, allies, biome, weather));

        // 4. Retreat Options (Fade, Withdraw, Vanish)
        options.push(...this.getRetreatOptions(combatant, reachable, enemies, allies, biome, weather));

        return options;
    }

    private getAggressionOptions(
        combatant: Combatant,
        reachable: GridPosition[],
        enemies: Combatant[],
        biome: string,
        weather: Weather
    ): TacticalOption[] {
        const options: TacticalOption[] = [];

        enemies.forEach(enemy => {
            const dist = this.gridManager.getDistance(combatant.position, enemy.position);
            const pathDist = this.gridManager.getDistanceVector(combatant.position, enemy.position);

            // A1. Charge (Strict linear move, disabled in Blizzard)
            if (pathDist > 6 && pathDist === dist && weather.type !== 'Blizzard' && weather.type !== 'Snow') {
                const targetPos = this.getApproachPosition(reachable, enemy.position, 1);
                if (targetPos) {
                    const nar = NarrativeGenerator.generate('charge', combatant, enemy, biome, weather, '', pathDist);
                    options.push({
                        id: `charge_${enemy.id}`,
                        label: nar.label,
                        description: nar.description,
                        targetPosition: targetPos,
                        type: 'AGGRESSION',
                        command: `/move ${targetPos.x} ${targetPos.y}`,
                        pros: ['Move Max Speed'],
                        cons: ['Reckless (-2 AC)']
                    });
                }
            }

            // A2. Stalk (Stealthy approach)
            if (pathDist > 4) {
                const targetPos = this.getApproachPosition(reachable, enemy.position, 1);
                if (targetPos) {
                    const nar = NarrativeGenerator.generate('stalk', combatant, enemy, biome, weather, '', pathDist);
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

        // Farthest point from enemies
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
            const nar = NarrativeGenerator.generate('fade_back', combatant, null, biome, weather, '', maxDist);
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

    private getFeatureName(feature: TerrainFeature, biome: string): string {
        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];
        return biomeData.features[feature.type] || feature.type;
    }
}
