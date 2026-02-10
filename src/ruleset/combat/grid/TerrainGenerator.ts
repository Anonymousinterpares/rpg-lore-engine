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
        // Compact 4x4 deployment zones (~20ft square) centered on y-midline
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

        // Procedural Terrain based on Biome - Density increased for 80x80
        switch (biome.toLowerCase()) {
            case 'forest':
                this.addCluster(features, 'TREE', 48, rng, width, height, { blocksVision: true, coverBonus: 'HALF' });
                this.addCluster(features, 'DIFFICULT', 32, rng, width, height, { blocksMovement: false });
                break;
            case 'mountain':
            case 'mountains':
                this.addCluster(features, 'WALL', 24, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'FULL' });
                this.addCluster(features, 'RUBBLE', 40, rng, width, height, { coverBonus: 'THREE_QUARTERS' });
                break;
            case 'swamp':
                this.addCluster(features, 'WATER', 60, rng, width, height, { blocksMovement: true });
                this.addCluster(features, 'DIFFICULT', 48, rng, width, height, {});
                break;
            case 'ruins':
                this.addCluster(features, 'WALL', 40, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'FULL' });
                this.addCluster(features, 'RUBBLE', 60, rng, width, height, { coverBonus: 'HALF' });
                this.addCluster(features, 'PIT', 20, rng, width, height, { blocksMovement: true });
                break;
            case 'volcanic':
                this.addCluster(features, 'LAVA', 48, rng, width, height, { blocksMovement: true, blocksVision: false });
                this.addCluster(features, 'WALL', 32, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'HALF' });
                break;
            case 'jungle':
                this.addCluster(features, 'TREE', 80, rng, width, height, { blocksVision: true, coverBonus: 'THREE_QUARTERS' });
                this.addCluster(features, 'DIFFICULT', 60, rng, width, height, {});
                break;
            case 'desert':
                this.addCluster(features, 'RUBBLE', 40, rng, width, height, { coverBonus: 'HALF' });
                this.addCluster(features, 'PIT', 16, rng, width, height, { blocksMovement: true });
                break;
            case 'tundra':
                this.addCluster(features, 'RUBBLE', 40, rng, width, height, { coverBonus: 'HALF' });
                this.addCluster(features, 'WALL', 16, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'FULL' });
                break;
            case 'coast':
            case 'ocean':
                this.addCluster(features, 'WATER', 60, rng, width, height, { blocksMovement: true });
                this.addCluster(features, 'RUBBLE', 24, rng, width, height, { coverBonus: 'HALF' });
                break;
            case 'urban':
                this.addCluster(features, 'WALL', 48, rng, width, height, { blocksMovement: true, blocksVision: true, coverBonus: 'FULL' });
                this.addCluster(features, 'RUBBLE', 32, rng, width, height, { coverBonus: 'HALF' });
                break;
            case 'plains':
            default:
                // Sparse cover
                this.addCluster(features, 'RUBBLE', 16, rng, width, height, { coverBonus: 'HALF' });
                this.addCluster(features, 'TREE', 4, rng, width, height, { blocksVision: true, coverBonus: 'HALF' });
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
        type: TerrainType,
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
                type,
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
                        type,
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
