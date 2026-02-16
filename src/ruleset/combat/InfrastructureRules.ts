import { BiomeType } from '../schemas/BiomeSchema';

export type InfrastructureType = 'Road' | 'Path' | 'None';

export interface InfrastructureRule {
    allowedRoad: BiomeType[];
    allowedPath: BiomeType[];
    roadProbability: number;
    pathProbability: number;
}

export const INFRA_RULES: InfrastructureRule = {
    // Roads are common in civilized or open areas
    allowedRoad: ['Urban', 'Farmland', 'Plains', 'Coast'],
    // Paths are common in wilder areas
    allowedPath: ['Forest', 'Hills', 'Swamp', 'Jungle', 'Mountains'],

    roadProbability: 0.6, // 60% chance to connect stable biomes with roads
    pathProbability: 0.4, // 40% chance to connect wilderness with paths
};

export class InfrastructureManager {
    /**
     * Determines if a connection should be generated between two biomes.
     */
    public static rollForInfrastructure(biomeA: BiomeType, biomeB: BiomeType): InfrastructureType {
        // Exclusion Rule: Ocean, Volcanic, Desert don't get infrastructure by default
        const exclusions: BiomeType[] = ['Ocean', 'Volcanic', 'Desert'];
        if (exclusions.includes(biomeA) || exclusions.includes(biomeB)) return 'None';

        // Road Rule
        if (INFRA_RULES.allowedRoad.includes(biomeA) && INFRA_RULES.allowedRoad.includes(biomeB)) {
            return Math.random() < INFRA_RULES.roadProbability ? 'Road' : 'None';
        }

        // Path Rule (if either is a path-eligible biome)
        if (INFRA_RULES.allowedPath.includes(biomeA) || INFRA_RULES.allowedPath.includes(biomeB)) {
            // Further check: don't connect Paths to Oceans
            if (biomeA === 'Ocean' || biomeB === 'Ocean') return 'None';

            return Math.random() < INFRA_RULES.pathProbability ? 'Path' : 'None';
        }

        return 'None';
    }

    /**
     * Decides if a connection should be auto-discovered.
     */
    public static shouldAutoDiscover(type: InfrastructureType, biome: BiomeType): boolean {
        if (type === 'Road') {
            // Roads in Urban/Farmland are always known
            return biome === 'Urban' || biome === 'Farmland' || biome === 'Plains';
        }
        if (type === 'Path') {
            // Paths are usually hidden unless in Plains
            return biome === 'Plains';
        }
        return false;
    }
}
