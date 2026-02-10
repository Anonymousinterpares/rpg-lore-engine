import biomeManifest from '../data/biome-manifest.json';

/**
 * The system is designed to support any number of variants by discovering them 
 * on the fly via a build-time sync script.
 */
const BIOME_VARIANTS: Record<string, number[]> = biomeManifest.variants;

export interface BiomeTacticalProps {
    passivePerception: number;
    dangerMultiplier: number;
    dangerTier: 'Safe' | 'Standard' | 'Dangerous' | 'Deadly';
    features: Record<string, string>;
}

export const BIOME_TACTICAL_DATA: Record<string, BiomeTacticalProps> = {
    'Volcanic': {
        passivePerception: 16,
        dangerMultiplier: 3.0,
        dangerTier: 'Deadly',
        features: { TREE: 'Dead Charred Tree', WALL: 'Obsidian Ridge', RUBBLE: 'Cooling Magma Rock', WATER: 'Lava Flow' }
    },
    'Ruins': {
        passivePerception: 16,
        dangerMultiplier: 3.0,
        dangerTier: 'Deadly',
        features: { TREE: 'Dead Tree', WALL: 'Crumbling Wall', RUBBLE: 'Toppled Statue', WATER: 'Flooded Cellar' }
    },
    'Swamp': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Mangrove', WALL: 'Sunken Barrier', RUBBLE: 'Overgrown Stone', WATER: 'Murky Pool' }
    },
    'Mountain': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Twisted Pine', WALL: 'Cliff Face', RUBBLE: 'Boulder', WATER: 'Mountain Spring' }
    },
    'Desert': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Cactus', WALL: 'Sandstone Slab', RUBBLE: 'Sand Pile', WATER: 'Oasis' }
    },
    'Jungle': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Giant Fern', WALL: 'Vine Wall', RUBBLE: 'Mossy Rock', WATER: 'Tropical Stream' }
    },
    'Tundra': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Frozen Fir', WALL: 'Ice Wall', RUBBLE: 'Snow Mound', WATER: 'Frozen Pond' }
    },
    'Ocean': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Coral Spire', WALL: 'Reef Wall', RUBBLE: 'Shipwreck', WATER: 'Whirlpool' }
    },
    'Coast': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: { TREE: 'Palm', WALL: 'Dune Ridge', RUBBLE: 'Driftwood', WATER: 'Tide Pool' }
    },
    'Forest': {
        passivePerception: 12,
        dangerMultiplier: 1.0,
        dangerTier: 'Standard',
        features: { TREE: 'Ancient Oak', WALL: 'Thicket Wall', RUBBLE: 'Mossy Rock', WATER: 'Stream' }
    },
    'Plains': {
        passivePerception: 12,
        dangerMultiplier: 1.0,
        dangerTier: 'Standard',
        features: { TREE: 'Lone Oak', WALL: 'Stone Fence', RUBBLE: 'Field Stone', WATER: 'Puddle' }
    },
    'Urban': {
        passivePerception: 10,
        dangerMultiplier: 0.5,
        dangerTier: 'Safe',
        features: { TREE: 'Decorative Elm', WALL: 'Brick Wall', RUBBLE: 'Crate', WATER: 'Open Sewer' }
    }
};

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

    public getVariant(biome: string, targetHash: number, excludedVariants: number[] = []): number {
        // Fallback if biome is unknown or has no variants
        const variants = BIOME_VARIANTS[biome] || [1];
        if (variants.length === 0) return 1;

        // If pool is missing or empty, refill it from the master list
        if (!this.pools[biome] || this.pools[biome].length === 0) {
            this.pools[biome] = [...variants];
        }

        // Filter pool to prefer non-excluded variants if possible
        let candidates = this.pools[biome].filter(v => !excludedVariants.includes(v));

        // If all available variants are excluded (rare, but possible in tight clusters), fallback to full pool
        if (candidates.length === 0) {
            candidates = this.pools[biome];
        }

        // Find the "closest" variant to the targetHash in the candidate list
        let bestIndex = -1;
        let minDiff = Infinity;
        let bestVariant = candidates[0];

        for (let i = 0; i < candidates.length; i++) {
            const variantFn = candidates[i];
            const diff = Math.abs(variantFn - targetHash);

            // If strictly closer, or equal diff but smaller variant number (determinism tie-break)
            if (diff < minDiff) {
                minDiff = diff;
                bestVariant = variantFn;
                bestIndex = i; // This index is relative to candidates!
            }
        }

        // We need to remove it from the MAIN pool
        const mainPoolIndex = this.pools[biome].indexOf(bestVariant);
        if (mainPoolIndex > -1) {
            this.pools[biome].splice(mainPoolIndex, 1);
        }

        return bestVariant;
    }
}
