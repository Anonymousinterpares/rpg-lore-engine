import biomeManifest from '../data/biome-manifest.json';

/**
 * The system is designed to support any number of variants by discovering them 
 * on the fly via a build-time sync script.
 */
const BIOME_VARIANTS: Record<string, number[]> = biomeManifest.variants;

/**
 * Utility to manage the pooling logic requested by the user.
 * It tracks used variants per biome type for a specific generation session.
 * 
 * Supports an arbitrary number of variants per biome.
 */
export class BiomePoolManager {
    private pools: Record<string, number[]> = {};

    constructor() {
        this.initializePools();
    }

    private initializePools(): void {
        Object.entries(BIOME_VARIANTS).forEach(([biome, variants]) => {
            // Clone the array to avoid modifying the source
            this.pools[biome] = [...variants];
        });
    }

    public getVariant(biome: string, targetHash: number): number {
        // Fallback if biome is unknown or has no variants
        const variants = BIOME_VARIANTS[biome] || [1];
        if (variants.length === 0) return 1;

        // If pool is missing or empty, refill it from the master list
        if (!this.pools[biome] || this.pools[biome].length === 0) {
            this.pools[biome] = [...variants];
        }

        // Find the "closest" variant to the targetHash in the current pool
        let bestIndex = 0;
        let minDiff = Infinity;

        for (let i = 0; i < this.pools[biome].length; i++) {
            const variantFn = this.pools[biome][i];
            const diff = Math.abs(variantFn - targetHash);

            // If strictly closer, or equal diff but smaller variant number (determinism tie-break)
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
