import { CombatGrid, GridPosition, TerrainFeature, TerrainTypeSchema } from '../schemas/CombatSchema';

export class TerrainGenerator {
    /**
     * Generates a procedural combat grid based on biome and seed.
     */
    public static generate(biome: string, seed: string): CombatGrid {
        const features: TerrainFeature[] = [];
        const width = 20;
        const height = 20;

        // Use seed to create a deterministic "random" function
        const rng = this.createRNG(seed);

        // Standard Deployment Zones
        const playerStartZone: GridPosition[] = [];
        for (let x = 0; x < 5; x++) {
            for (let y = 8; y < 12; y++) {
                playerStartZone.push({ x, y });
            }
        }

        const enemyStartZone: GridPosition[] = [];
        for (let x = 15; x < 20; x++) {
            for (let y = 8; y < 12; y++) {
                enemyStartZone.push({ x, y });
            }
        }

        // Procedural Terrain based on Biome
        switch (biome.toLowerCase()) {
            case 'forest':
                this.addCluster(features, 'TREE', 12, rng, width, height, { blocksVision: true, coverBonus: 'HALF' });
                this.addCluster(features, 'DIFFICULT', 8, rng, width, height, { blocksMovement: false });
                break;
            case 'mountain':
                this.addCluster(features, 'WALL', 6, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'FULL' });
                this.addCluster(features, 'RUBBLE', 10, rng, width, height, { coverBonus: 'THREE_QUARTERS' });
                break;
            case 'swamp':
                this.addCluster(features, 'WATER', 15, rng, width, height, { blocksMovement: true });
                this.addCluster(features, 'DIFFICULT', 12, rng, width, height, {});
                break;
            case 'ruins':
                this.addCluster(features, 'WALL', 10, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'FULL' });
                this.addCluster(features, 'RUBBLE', 15, rng, width, height, { coverBonus: 'HALF' });
                break;
            default:
                // Plains or unknown biomes get sparse occasional cover
                this.addCluster(features, 'RUBBLE', 4, rng, width, height, { coverBonus: 'HALF' });
                break;
        }

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
        type: string,
        count: number,
        rng: () => number,
        width: number,
        height: number,
        props: Partial<TerrainFeature>
    ) {
        for (let i = 0; i < count; i++) {
            const pos = {
                x: Math.floor(rng() * width),
                y: Math.floor(rng() * height)
            };

            // Avoid putting obstacles directly in start zones for now (or make it rare)
            if (this.isInStartZone(pos)) continue;

            features.push({
                id: `feat_${type}_${i}_${pos.x}_${pos.y}`,
                type: type as any,
                position: pos,
                blocksMovement: props.blocksMovement ?? false,
                blocksVision: props.blocksVision ?? false,
                coverBonus: props.coverBonus ?? 'NONE',
                isDestructible: props.isDestructible ?? false,
                hp: props.hp
            });

            // Occasional cluster neighbor
            if (rng() > 0.6) {
                const neighborPos = { x: pos.x + 1, y: pos.y };
                if (neighborPos.x < width && !this.isInStartZone(neighborPos)) {
                    features.push({
                        id: `feat_${type}_${i}_n_${neighborPos.x}_${neighborPos.y}`,
                        type: type as any,
                        position: neighborPos,
                        blocksMovement: props.blocksMovement ?? false,
                        blocksVision: props.blocksVision ?? false,
                        coverBonus: props.coverBonus ?? 'NONE',
                        isDestructible: props.isDestructible ?? false,
                        hp: props.hp
                    });
                }
            }
        }
    }

    private static isInStartZone(pos: GridPosition): boolean {
        // Player zone: x [0,4], y [8,11]
        // Enemy zone: x [15,19], y [8,11]
        if (pos.y >= 8 && pos.y <= 11) {
            if (pos.x >= 0 && pos.x <= 4) return true;
            if (pos.x >= 15 && pos.x <= 19) return true;
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
