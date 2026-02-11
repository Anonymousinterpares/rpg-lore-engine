import biomeManifest from '../data/biome-manifest.json';

/**
 * The system is designed to support any number of variants by discovering them 
 * on the fly via a build-time sync script.
 */
const BIOME_VARIANTS: Record<string, number[]> = biomeManifest.variants;

import { Hazard, TerrainType } from '../schemas/CombatSchema';

export interface BiomeFeatureVariant {
    name: string;
    coverBonus: 'NONE' | 'QUARTER' | 'HALF' | 'THREE_QUARTERS' | 'FULL';
    blocksMovement?: boolean;
    blocksVision?: boolean;
    isDestructible?: boolean;
    hazard?: Hazard;
}

export interface BiomeTacticalProps {
    passivePerception: number;
    dangerMultiplier: number;
    dangerTier: 'Safe' | 'Standard' | 'Dangerous' | 'Deadly';
    features: Partial<Record<TerrainType, BiomeFeatureVariant[]>>;
}

export const BIOME_TACTICAL_DATA: Record<string, BiomeTacticalProps> = {
    'Volcanic': {
        passivePerception: 16,
        dangerMultiplier: 3.0,
        dangerTier: 'Deadly',
        features: {
            LAVA: [
                { name: 'Bubbling Fissure', coverBonus: 'NONE', hazard: { damageType: 'Fire', damageDice: '2d8', saveDC: 15, saveAbility: 'DEX', description: 'Fire erupts from the fissure!' } },
                { name: 'Lava Flow', coverBonus: 'NONE', blocksMovement: true, hazard: { damageType: 'Fire', damageDice: '2d6', saveDC: 14, saveAbility: 'DEX', description: 'The lava scorches you!' } }
            ],
            RUBBLE: [
                { name: 'Cooling Magma', coverBonus: 'HALF', blocksMovement: true, hazard: { damageType: 'Fire', damageDice: '1d6', saveDC: 12, saveAbility: 'DEX', description: 'The magma is still hot!' } },
                { name: 'Glass Shard', coverBonus: 'QUARTER' },
                { name: 'Pumice Pile', coverBonus: 'HALF' }
            ],
            TREE: [
                { name: 'Smoldering Trunk', coverBonus: 'HALF', blocksVision: true, hazard: { damageType: 'Fire', damageDice: '1d4', saveDC: 10, saveAbility: 'DEX', description: 'The trunk radiates intense heat!' } },
                { name: 'Charred Skeleton', coverBonus: 'QUARTER' }
            ],
            WALL: [
                { name: 'Obsidian Ridge', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Basalt Column', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ]
        }
    },
    'Ruins': {
        passivePerception: 16,
        dangerMultiplier: 3.0,
        dangerTier: 'Deadly',
        features: {
            WALL: [
                { name: 'Crumbling Wall', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true },
                { name: 'Ancient Arch', coverBonus: 'HALF', blocksMovement: true }
            ],
            RUBBLE: [
                { name: 'Toppled Statue', coverBonus: 'HALF', blocksMovement: true },
                { name: 'Loose Bricks', coverBonus: 'QUARTER', blocksMovement: true }
            ],
            TREE: [
                { name: 'Dead Tree', coverBonus: 'HALF', blocksVision: true },
                { name: 'Overgrown Pillar', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ],
            PIT: [
                { name: 'Flooded Cellar', coverBonus: 'NONE', blocksMovement: true },
                { name: 'Spike Pit', coverBonus: 'NONE', hazard: { damageType: 'Piercing', damageDice: '2d6', saveDC: 14, saveAbility: 'DEX', description: 'You fall onto rusted spikes!' } }
            ]
        }
    },
    'Swamp': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            WATER: [
                { name: 'Toxic Pool', coverBonus: 'QUARTER', blocksMovement: true, hazard: { damageType: 'Poison', damageDice: '2d4', saveDC: 13, saveAbility: 'CON', description: 'The water is toxic!' } },
                { name: 'Murky Water', coverBonus: 'QUARTER', blocksMovement: true }
            ],
            DIFFICULT: [
                { name: 'Sucking Mud', coverBonus: 'NONE', hazard: { damageType: 'Restrained', damageDice: '0', saveDC: 12, saveAbility: 'STR', description: 'The mud clings to your boots!' } },
                { name: 'Thick Reeds', coverBonus: 'QUARTER', blocksVision: true }
            ],
            TREE: [
                { name: 'Rotting Cypress', coverBonus: 'THREE_QUARTERS', blocksVision: true },
                { name: 'Mangrove Roots', coverBonus: 'HALF', blocksVision: true }
            ],
            WALL: [
                { name: 'Sunken Ruin', coverBonus: 'FULL', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Mossy Stone', coverBonus: 'HALF', blocksMovement: true }
            ]
        }
    },
    'Mountain': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            WALL: [
                { name: 'Cliff Face', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Rock Formation', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Boulder', coverBonus: 'HALF', blocksMovement: true, blocksVision: true },
                { name: 'Scree Slope', coverBonus: 'QUARTER', blocksMovement: true }
            ],
            TREE: [
                { name: 'Twisted Pine', coverBonus: 'HALF', blocksVision: true },
                { name: 'Mountain Ash', coverBonus: 'THREE_QUARTERS', blocksVision: true }
            ],
            WATER: [
                { name: 'Mountain Spring', coverBonus: 'NONE' },
                { name: 'Icy Stream', coverBonus: 'NONE', blocksMovement: true, hazard: { damageType: 'Cold', damageDice: '1d4', saveDC: 12, saveAbility: 'CON', description: 'The water is freezing!' } }
            ]
        }
    },
    'Desert': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            TREE: [
                { name: 'Cactus', coverBonus: 'QUARTER', hazard: { damageType: 'Piercing', damageDice: '1d4', saveDC: 10, saveAbility: 'DEX', description: 'You prick yourself on a cactus!' } },
                { name: 'Dead Palm', coverBonus: 'HALF', blocksVision: true }
            ],
            WALL: [
                { name: 'Sandstone Slab', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Dune Ridge', coverBonus: 'HALF', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Sand Pile', coverBonus: 'QUARTER', blocksMovement: true },
                { name: 'Bleached Bones', coverBonus: 'QUARTER' },
                { name: 'Sandstone Outcrop', coverBonus: 'HALF', blocksMovement: true }
            ],
            WATER: [
                { name: 'Oasis', coverBonus: 'NONE', blocksMovement: true }
            ]
        }
    },
    'Jungle': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            DIFFICULT: [
                { name: 'Spiked Vines', coverBonus: 'QUARTER', hazard: { damageType: 'Piercing', damageDice: '1d6', saveDC: 13, saveAbility: 'DEX', description: 'The vines have sharp thorns!' } },
                { name: 'Dense Ferns', coverBonus: 'HALF', blocksVision: true }
            ],
            TREE: [
                { name: 'Giant Fern', coverBonus: 'HALF', blocksVision: true },
                { name: 'Ironwood', coverBonus: 'THREE_QUARTERS', blocksVision: true },
                { name: 'Strangling Fig', coverBonus: 'FULL', blocksMovement: true, blocksVision: true }
            ],
            WALL: [
                { name: 'Ancient Sentinel', coverBonus: 'FULL', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Overgrown Idol', coverBonus: 'THREE_QUARTERS', blocksMovement: true }
            ],
            WATER: [
                { name: 'Tropical Stream', coverBonus: 'QUARTER', blocksMovement: true }
            ]
        }
    },
    'Tundra': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            WATER: [
                { name: 'Thin Ice', coverBonus: 'QUARTER', hazard: { damageType: 'Cold', damageDice: '1d6', saveDC: 12, saveAbility: 'DEX', description: 'The ice cracks!' } },
                { name: 'Frozen Pond', coverBonus: 'NONE', blocksMovement: true }
            ],
            DIFFICULT: [
                { name: 'Deep Snow', coverBonus: 'QUARTER', blocksMovement: true }
            ],
            TREE: [
                { name: 'Frozen Fir', coverBonus: 'THREE_QUARTERS', blocksVision: true },
                { name: 'Bare Pine', coverBonus: 'HALF' }
            ],
            WALL: [
                { name: 'Ice Wall', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Glacial Ridge', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Snow Mound', coverBonus: 'HALF', blocksMovement: true }
            ]
        }
    },
    'Ocean': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            TREE: [
                { name: 'Coral Spire', coverBonus: 'HALF', blocksVision: true },
                { name: 'Kelp Forest', coverBonus: 'QUARTER', blocksVision: true }
            ],
            WALL: [
                { name: 'Reef Wall', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Shipwreck Hull', coverBonus: 'FULL', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Shipwreck Debris', coverBonus: 'HALF', blocksMovement: true },
                { name: 'Anchor', coverBonus: 'HALF', blocksMovement: true }
            ],
            WATER: [
                { name: 'Whirlpool', coverBonus: 'NONE', blocksMovement: true, hazard: { damageType: 'Bludgeoning', damageDice: '2d6', saveDC: 14, saveAbility: 'STR', description: 'The whirlpool pulls you down!' } },
                { name: 'Deep Current', coverBonus: 'NONE', blocksMovement: true }
            ]
        }
    },
    'Coast': {
        passivePerception: 14,
        dangerMultiplier: 2.0,
        dangerTier: 'Dangerous',
        features: {
            TREE: [
                { name: 'Palm', coverBonus: 'HALF', blocksVision: true },
                { name: 'Driftwood Log', coverBonus: 'HALF', blocksMovement: true }
            ],
            WALL: [
                { name: 'Dune Ridge', coverBonus: 'HALF', blocksMovement: true, blocksVision: true },
                { name: 'Rock Face', coverBonus: 'FULL', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Driftwood', coverBonus: 'QUARTER', blocksMovement: true },
                { name: 'Shell Mound', coverBonus: 'QUARTER' }
            ],
            WATER: [
                { name: 'Tide Pool', coverBonus: 'NONE' },
                { name: 'Surf', coverBonus: 'NONE', blocksMovement: true }
            ]
        }
    },
    'Forest': {
        passivePerception: 12,
        dangerMultiplier: 1.0,
        dangerTier: 'Standard',
        features: {
            TREE: [
                { name: 'Ancient Oak', coverBonus: 'THREE_QUARTERS', blocksVision: true },
                { name: 'Gnarled Elm', coverBonus: 'HALF', blocksVision: true },
                { name: 'Fallen Log', coverBonus: 'HALF', blocksMovement: true },
                { name: 'Hollow Stump', coverBonus: 'HALF' }
            ],
            WALL: [
                { name: 'Thicket Wall', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Thorny Hedge', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Mossy Rock', coverBonus: 'HALF', blocksMovement: true }
            ],
            WATER: [
                { name: 'Woodland Pool', coverBonus: 'QUARTER', blocksMovement: true },
                { name: 'Stream', coverBonus: 'QUARTER', blocksMovement: true }
            ]
        }
    },
    'Plains': {
        passivePerception: 12,
        dangerMultiplier: 1.0,
        dangerTier: 'Standard',
        features: {
            TREE: [
                { name: 'Lone Oak', coverBonus: 'HALF', blocksVision: true },
                { name: 'Scrub Bush', coverBonus: 'QUARTER' }
            ],
            WALL: [
                { name: 'Stone Fence', coverBonus: 'HALF', blocksMovement: true },
                { name: 'Wooden Fence', coverBonus: 'QUARTER', blocksMovement: true }
            ],
            RUBBLE: [
                { name: 'Field Stone', coverBonus: 'HALF', blocksMovement: true },
                { name: 'Hay Bale', coverBonus: 'HALF', blocksVision: true }
            ],
            WATER: [
                { name: 'Puddle', coverBonus: 'NONE' },
                { name: 'Horse Trough', coverBonus: 'HALF', blocksMovement: true }
            ]
        }
    },
    'Urban': {
        passivePerception: 10,
        dangerMultiplier: 0.5,
        dangerTier: 'Safe',
        features: {
            TREE: [
                { name: 'Decorative Elm', coverBonus: 'HALF', blocksVision: true },
                { name: 'Planter Box', coverBonus: 'HALF', blocksMovement: true }
            ],
            WALL: [
                { name: 'Brick Wall', coverBonus: 'FULL', blocksMovement: true, blocksVision: true },
                { name: 'Iron Fence', coverBonus: 'QUARTER', blocksMovement: true },
                { name: 'Stone Pillar', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ],
            RUBBLE: [
                { name: 'Crate', coverBonus: 'HALF', blocksMovement: true, blocksVision: true },
                { name: 'Barrel Stack', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true },
                { name: 'Overturned Cart', coverBonus: 'THREE_QUARTERS', blocksMovement: true, blocksVision: true }
            ],
            WATER: [
                { name: 'Open Sewer', coverBonus: 'NONE', blocksMovement: true, hazard: { damageType: 'Poison', damageDice: '1d6', saveDC: 12, saveAbility: 'CON', description: 'The stench is overwhelming!' } }
            ]
        }
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
