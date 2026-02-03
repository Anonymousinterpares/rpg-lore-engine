import { BIOME_DEFINITIONS } from '../data/StaticData';
import { BiomeType } from '../schemas/BiomeSchema';

export class BiomeGenerationEngine {
    private static definitions = BIOME_DEFINITIONS;

    /**
     * Selects a biome for a new hex based on its neighbors.
     */
    public static selectBiome(neighbors: { biome: BiomeType }[], clusterSizes: Record<BiomeType, number>): BiomeType {
        // 1. Calculate weights
        const finalWeights: Record<string, number> = {};

        for (const def of this.definitions) {
            let weight = def.baseAppearanceWeight;

            // Adjacency modifications
            for (const neighbor of neighbors) {
                if (def.adjacencyModifiers && (def.adjacencyModifiers as any)[neighbor.biome]) {
                    weight += (def.adjacencyModifiers as any)[neighbor.biome];
                }
            }

            // Cluster penalty
            const currentSize = clusterSizes[def.id as BiomeType] || 0;
            if (currentSize >= def.maxClusterSize) {
                weight *= (1 - def.clusterPenaltyMultiplier);
            }

            finalWeights[def.id] = Math.max(0, weight);
        }

        // 2. Weighted random selection
        const total = Object.values(finalWeights).reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;

        for (const [id, weight] of Object.entries(finalWeights)) {
            roll -= weight;
            if (roll <= 0) return id as BiomeType;
        }

        return 'Plains'; // Fallback
    }
}
