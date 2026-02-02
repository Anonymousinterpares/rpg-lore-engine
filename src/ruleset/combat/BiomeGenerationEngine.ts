import { BiomeType, BiomeDefinition } from '../schemas/BiomeSchema';
import * as fs from 'fs';
import * as path from 'path';

export class BiomeGenerationEngine {
    private static definitions: BiomeDefinition[] = [];

    private static loadDefinitions() {
        if (this.definitions.length > 0) return;
        const dataPath = path.join(process.cwd(), 'data', 'biomes', 'biome_definitions.json');
        this.definitions = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    /**
     * Selects a biome for a new hex based on its neighbors.
     */
    public static selectBiome(neighbors: { biome: BiomeType }[], clusterSizes: Record<BiomeType, number>): BiomeType {
        this.loadDefinitions();

        // 1. Calculate weights
        const finalWeights: Record<string, number> = {};

        for (const def of this.definitions) {
            let weight = def.baseAppearanceWeight;

            // Apply adjacency modifiers
            for (const neighbor of neighbors) {
                const modifier = def.adjacencyModifiers[neighbor.biome] || 0;
                weight += modifier;
            }

            // Apply cluster penalty (anti-clump)
            const currentSize = clusterSizes[def.id] || 0;
            if (currentSize >= def.maxClusterSize) {
                weight *= def.clusterPenaltyMultiplier;
            }

            finalWeights[def.id] = Math.max(0, weight);
        }

        // 2. Weighted Random Roll
        const totalWeight = Object.values(finalWeights).reduce((a, b) => a + b, 0);
        if (totalWeight === 0) return 'Plains'; // Fallback

        let roll = Math.random() * totalWeight;
        for (const [id, weight] of Object.entries(finalWeights)) {
            if (roll < weight) return id as BiomeType;
            roll -= weight;
        }

        return 'Plains';
    }
}
