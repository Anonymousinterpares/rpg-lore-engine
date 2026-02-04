export const BIOME_VARIANTS: Record<string, number[]> = {
    'Plains': [1, 2, 3, 4, 5],
    'Forest': [1, 2, 3, 4, 5],
    'Mountains': [1, 2, 3, 4, 5],
    'Swamp': [1, 2, 3, 4, 5],
    'Hills': [1, 2, 3, 4, 5],
    'Desert': [1, 2, 3, 4, 5],
    'Tundra': [1, 2, 3, 4, 5],
    'Jungle': [1, 2, 3, 4, 5],
    'Coast': [1, 2, 3, 4, 5],
    'Ocean': [1, 2, 3, 4, 5],
    'Volcanic': [1, 2, 3, 4, 5],
    'Ruins': [1, 2, 3, 4, 5],
    'Farmland': [1, 2, 3, 4, 5],
    'Urban': [1, 2, 3, 4, 5]
};

/**
 * Utility to manage the pooling logic requested by the user.
 * It tracks used variants per biome type for a specific generation session.
 */
export class BiomePoolManager {
    private pools: Record<string, number[]> = {};

    constructor() {
        // Initialize pools with copies of the full registries
        Object.entries(BIOME_VARIANTS).forEach(([biome, variants]) => {
            this.pools[biome] = [...variants];
        });
    }

    public getVariant(biome: string, targetHash: number): number {
        // If biome unknown or no variants, return 1 as a safety
        if (!this.pools[biome] || BIOME_VARIANTS[biome].length === 0) return 1;

        // If pool is empty, refill it
        if (this.pools[biome].length === 0) {
            this.pools[biome] = [...BIOME_VARIANTS[biome]];
        }

        // Find the "closest" variant to the targetHash in the current pool
        let bestIndex = 0;
        let minDiff = Infinity;

        for (let i = 0; i < this.pools[biome].length; i++) {
            const diff = Math.abs(this.pools[biome][i] - targetHash);
            if (diff < minDiff) {
                minDiff = diff;
                bestIndex = i;
            }
        }

        // Extract and return the chosen variant
        const chosen = this.pools[biome][bestIndex];
        this.pools[biome].splice(bestIndex, 1);
        return chosen;
    }
}
