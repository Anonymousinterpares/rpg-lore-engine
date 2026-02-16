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
     * Determines infrastructure type between two adjacent biomes.
     * Implements §2.4 Topographical Flow & Transitions:
     *   1. Termination  — Ocean/Coast/Mountain → None
     *   2. Disappearing — Volcanic/Desert → fading trail
     *   3. Road         — Both Road-eligible
     *   4. Upgrade      — Path-eligible ↔ Urban/Farmland → Road
     *   5. Downgrade    — Path-eligible ↔ Plains → Path
     *   6. Path         — Both Path-eligible
     *   7. Ancient      — 5% magical shortcut (non-Ocean)
     */
    public static rollForInfrastructure(biomeA: BiomeType, biomeB: BiomeType): InfrastructureType {
        // 1. TERMINATION: Ocean/Coast/Mountain kills all infrastructure
        if (TERMINATED.includes(biomeA) || TERMINATED.includes(biomeB)) return 'None';

        // 2. DISAPPEARING: Volcanic/Desert gets a fading trail stub
        if (DISAPPEARING.includes(biomeA) || DISAPPEARING.includes(biomeB)) {
            return Math.random() < 0.25 ? 'Disappearing' : 'None';
        }

        const canRoadA = INFRA_RULES.allowedRoad.includes(biomeA);
        const canRoadB = INFRA_RULES.allowedRoad.includes(biomeB);
        const canPathA = INFRA_RULES.allowedPath.includes(biomeA);
        const canPathB = INFRA_RULES.allowedPath.includes(biomeB);

        // 3. ROAD: Both biomes are Road-eligible → Road
        if (canRoadA && canRoadB) {
            return Math.random() < INFRA_RULES.roadProbability ? 'Road' : 'None';
        }

        // 4/5. TRANSITION: One Road-eligible, other Path-eligible
        if ((canRoadA && canPathB) || (canRoadB && canPathA)) {
            const roadBiome = canRoadA ? biomeA : biomeB;

            // UPGRADE (§2.4): Path entering Urban/Farmland → Road
            if (INFRA_RULES.civilized.includes(roadBiome)) {
                return Math.random() < INFRA_RULES.roadProbability ? 'Road' : 'None';
            }

            // DOWNGRADE (§2.4): Road entering wilderness via Plains → Path
            return Math.random() < INFRA_RULES.pathProbability ? 'Path' : 'None';
        }

        // 6. PATH: Both Path-eligible → Path
        if (canPathA && canPathB) {
            return Math.random() < INFRA_RULES.pathProbability ? 'Path' : 'None';
        }

        // 7. ANCIENT: Magical shortcuts, rare (5%), ignore most biome constraints
        if (Math.random() < 0.05) {
            return 'Ancient';
        }

        return 'None';
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
