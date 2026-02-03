import { BIOME_DEFINITIONS } from '../data/StaticData';
export class BiomeGenerationEngine {
    static definitions = BIOME_DEFINITIONS;
    /**
     * Selects a biome for a new hex based on its neighbors.
     */
    static selectBiome(neighbors, clusterSizes) {
        // 1. Calculate weights
        const finalWeights = {};
        for (const def of this.definitions) {
            let weight = def.baseAppearanceWeight;
            // Adjacency modifications
            for (const neighbor of neighbors) {
                if (def.adjacencyModifiers && def.adjacencyModifiers[neighbor.biome]) {
                    weight += def.adjacencyModifiers[neighbor.biome];
                }
            }
            // Cluster penalty
            const currentSize = clusterSizes[def.id] || 0;
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
            if (roll <= 0)
                return id;
        }
        return 'Plains'; // Fallback
    }
}
