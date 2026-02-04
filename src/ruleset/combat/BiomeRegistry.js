export const BIOME_VARIANTS = {
    'Plains': [1],
    'Forest': [1],
    'Mountains': [1],
    'Swamp': [1],
    'Hills': [1],
    'Desert': [1, 2, 3, 4, 5]
};
/**
 * Utility to manage the pooling logic requested by the user.
 * It tracks used variants per biome type for a specific generation session.
 */
export class BiomePoolManager {
    pools = {};
    constructor() {
        // Initialize pools with copies of the full registries
        Object.entries(BIOME_VARIANTS).forEach(([biome, variants]) => {
            this.pools[biome] = [...variants];
        });
    }
    getVariant(biome, targetHash) {
        // If biome unknown or no variants, return 1 as a safety
        if (!this.pools[biome] || BIOME_VARIANTS[biome].length === 0)
            return 1;
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
