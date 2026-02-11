import { BIOME_TACTICAL_DATA } from '../BiomeRegistry';
import { CombatGrid, GridPosition, TerrainFeature, TerrainType } from '../../schemas/CombatSchema';

export class TerrainGenerator {
    /**
     * Generates a procedural combat grid based on biome and seed.
     */
    public static generate(biome: string, seed: string): CombatGrid {
        const features: TerrainFeature[] = [];
        const width = 80;
        const height = 80;

        // Use seed to create a deterministic "random" function
        const rng = this.createRNG(seed);

        // Standard Deployment Zones (Proportionally scaled for 80x80)
        const playerStartZone: GridPosition[] = [];
        for (let x = 2; x < 6; x++) {
            for (let y = 38; y < 42; y++) {
                playerStartZone.push({ x, y });
            }
        }

        const enemyStartZone: GridPosition[] = [];
        for (let x = 74; x < 78; x++) {
            for (let y = 38; y < 42; y++) {
                enemyStartZone.push({ x, y });
            }
        }

        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];

        // Procedural Terrain based on Biome 
        // We now iterate through the types available in the biome data
        Object.keys(biomeData.features).forEach(typeKey => {
            const type = typeKey as TerrainType;
            let count = 0;
            switch (type) {
                case 'TREE': count = 40; break;
                case 'WALL': count = 25; break;
                case 'RUBBLE': count = 30; break;
                case 'WATER': count = 35; break;
                case 'LAVA': count = 30; break;
                case 'PIT': count = 15; break;
                case 'DIFFICULT': count = 40; break;
                default: count = 10;
            }

            // Adjust count by biome frequency if needed, but for now fixed per type
            this.addCluster(features, type, count, rng, width, height, biome);
        });

        return {
            width,
            height,
            features,
            playerStartZone,
            enemyStartZone
        };
    }

    private static addCluster(
        features: TerrainFeature[],
        type: TerrainType,
        count: number,
        rng: () => number,
        width: number,
        height: number,
        biome: string
    ) {
        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];
        const variants = biomeData.features[type] || [];
        if (variants.length === 0) return;

        for (let i = 0; i < count; i++) {
            const pos = {
                x: Math.floor(rng() * width),
                y: Math.floor(rng() * height)
            };

            // Avoid putting obstacles directly in start zones
            if (this.isInStartZone(pos)) continue;

            // Pick a variant based on RNG
            const variant = variants[Math.floor(rng() * variants.length)];

            features.push({
                id: `feat_${type}_${i}_${pos.x}_${pos.y}`,
                type,
                position: pos,
                blocksMovement: variant.blocksMovement ?? false,
                blocksVision: variant.blocksVision ?? false,
                coverBonus: variant.coverBonus ?? 'NONE',
                isDestructible: variant.isDestructible ?? false,
                hazard: variant.hazard
            });

            // Occasional cluster neighbor
            if (rng() > 0.6) {
                const neighborPos = { x: pos.x + 1, y: pos.y };
                if (neighborPos.x < width && !this.isInStartZone(neighborPos)) {
                    // Re-pick variant for neighbor or use same? User wants variety, but clusters usually same type.
                    // Using same variant for cluster cohesion.
                    features.push({
                        id: `feat_${type}_${i}_n_${neighborPos.x}_${neighborPos.y}`,
                        type,
                        position: neighborPos,
                        blocksMovement: variant.blocksMovement ?? false,
                        blocksVision: variant.blocksVision ?? false,
                        coverBonus: variant.coverBonus ?? 'NONE',
                        isDestructible: variant.isDestructible ?? false,
                        hazard: variant.hazard
                    });
                }
            }
        }
    }

    private static isInStartZone(pos: GridPosition): boolean {
        // Player zone: x [2,5], y [38,41]
        // Enemy zone: x [74,77], y [38,41]
        if (pos.y >= 38 && pos.y <= 41) {
            if (pos.x >= 2 && pos.x <= 5) return true;
            if (pos.x >= 74 && pos.x <= 77) return true;
        }
        return false;
    }

    private static createRNG(seed: string) {
        let h = 0;
        for (let i = 0; i < seed.length; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
        }
        return () => {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return ((h ^= h >>> 16) >>> 0) / 4294967296;
        };
    }
}
