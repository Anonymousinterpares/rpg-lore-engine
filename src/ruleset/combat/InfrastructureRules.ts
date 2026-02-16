import { BiomeType } from '../schemas/BiomeSchema';

export type InfrastructureType = 'Road' | 'Path' | 'Disappearing' | 'Ancient' | 'None';

export interface InfrastructureRule {
    allowedRoad: BiomeType[];
    allowedPath: BiomeType[];
    /** Civilized biomes that trigger the Upgrade rule (Path → Road) */
    civilized: BiomeType[];
    roadProbability: number;
    pathProbability: number;
}

export const INFRA_RULES: InfrastructureRule = {
    // Roads are common in civilized or open areas (§2.3)
    allowedRoad: ['Urban', 'Farmland', 'Plains'],
    // Paths are common in wilder areas (§2.3) — Mountains excluded per Excluded Zones
    allowedPath: ['Forest', 'Hills', 'Swamp', 'Jungle'],
    // Urban/Farmland trigger Upgrade rule (§2.4)
    civilized: ['Urban', 'Farmland'],

    roadProbability: 0.6,
    pathProbability: 0.4,
};

/** Biomes where infrastructure is terminated (§2.3 Excluded Zones) */
const TERMINATED: BiomeType[] = ['Ocean', 'Coast', 'Mountains'];

/** Biomes where infrastructure becomes a Disappearing Path (§2.4) */
const DISAPPEARING: BiomeType[] = ['Volcanic', 'Desert'];

export class InfrastructureManager {
    /**
     * Determines infrastructure type for each side of a connection between two biomes.
     * Implements §2.4 Topographical Flow & Transitions with Split-Rendering:
     *   1. Termination  — Ocean/Coast/Mountain → None (both sides)
     *   2. Disappearing — Volcanic/Desert → Disappearing (both sides)
     *   3. Swamp Exception — Swamp ↔ Civilized → Path (both sides)
     *   4. Road-Road    — Both Road-eligible → Road (both sides)
     *   5. Transition   — Path-eligible ↔ Urban/Farmland → { Road, Path }
     *   6. Downgrade    — Path-eligible ↔ Plains → Path (both sides)
     *   7. Path-Path    — Both Path-eligible → Path (both sides)
     *   8. Ancient      — 5% magical shortcut (both sides)
     */
    public static rollForInfrastructure(biomeA: BiomeType, biomeB: BiomeType): { sideA: InfrastructureType, sideB: InfrastructureType } {
        const none = { sideA: 'None' as InfrastructureType, sideB: 'None' as InfrastructureType };

        // 1. TERMINATION: Ocean/Coast/Mountain kills all infrastructure
        if (TERMINATED.includes(biomeA) || TERMINATED.includes(biomeB)) return none;

        // 2. DISAPPEARING: Volcanic/Desert gets a fading trail stub
        if (DISAPPEARING.includes(biomeA) || DISAPPEARING.includes(biomeB)) {
            const isInfra = Math.random() < 0.25;
            return isInfra ? { sideA: 'Disappearing', sideB: 'Disappearing' } : none;
        }

        // 3. SWAMP EXCEPTION: Roads don't lead into swamps, even from Farmland/Urban
        if (biomeA === 'Swamp' || biomeB === 'Swamp') {
            const isPath = Math.random() < INFRA_RULES.pathProbability;
            return isPath ? { sideA: 'Path', sideB: 'Path' } : none;
        }

        const canRoadA = INFRA_RULES.allowedRoad.includes(biomeA);
        const canRoadB = INFRA_RULES.allowedRoad.includes(biomeB);
        const canPathA = INFRA_RULES.allowedPath.includes(biomeA);
        const canPathB = INFRA_RULES.allowedPath.includes(biomeB);

        // 4. ROAD-ROAD: Both biomes are Road-eligible → Road (both sides)
        if (canRoadA && canRoadB) {
            const isRoad = Math.random() < INFRA_RULES.roadProbability;
            return isRoad ? { sideA: 'Road', sideB: 'Road' } : none;
        }

        // TRANSITION (§2.4): Connection between Road-eligible and Path-eligible biomes.
        // visual split: Road on the civilized/open side, Path on the wild side.
        // exception: Swamp always downgrades the civilized side to Path (handled above in step 3).
        if ((canRoadA && canPathB) || (canRoadB && canPathA)) {
            return {
                sideA: canRoadA ? 'Road' : 'Path',
                sideB: canRoadB ? 'Road' : 'Path'
            };
        }

        // 7. PATH-PATH: Both Path-eligible → Path (both sides)
        if (canPathA && canPathB) {
            const isPath = Math.random() < INFRA_RULES.pathProbability;
            return isPath ? { sideA: 'Path', sideB: 'Path' } : none;
        }

        // 8. ANCIENT: Magical shortcuts
        if (Math.random() < 0.05) {
            return { sideA: 'Ancient', sideB: 'Ancient' };
        }

        return none;
    }

    /**
     * Decides if a connection should be auto-discovered.
     */
    public static shouldAutoDiscover(type: InfrastructureType, biome: BiomeType): boolean {
        if (type === 'Road') {
            return biome === 'Urban' || biome === 'Farmland' || biome === 'Plains';
        }
        if (type === 'Path') {
            return biome === 'Plains';
        }
        if (type === 'Disappearing') {
            return true; // Disappearing paths are always visible (you can see them fading)
        }
        return false;
    }
}
