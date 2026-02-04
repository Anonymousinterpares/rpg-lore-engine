import biomeManifest from '../data/biome-manifest.json';

/**
 * The system is designed to support any number of variants by discovering them 
 * on the fly via a build-time sync script.
 */
const BIOME_VARIANTS: Record<string, number> = biomeManifest.variants;

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
        Object.entries(BIOME_VARIANTS).forEach(([biome, count]) => {
            // Generate array [1, 2, ..., count]
            this.pools[biome] = Array.from({ length: count }, (_, i) => i + 1);
        });
    }

    public getVariant(biome: string, targetHash: number): number {
        // Fallback if biome is unknown
        const maxVariants = BIOME_VARIANTS[biome] || 1;

        // If pool is missing or empty, refill it from the current registry state
        if (!this.pools[biome] || this.pools[biome].length === 0) {
            this.pools[biome] = Array.from({ length: maxVariants }, (_, i) => i + 1);
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
