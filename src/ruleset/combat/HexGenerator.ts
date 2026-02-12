import { Hex, ResourceNode, Coastline } from '../schemas/HexMapSchema';
import { BiomeType } from '../schemas/BiomeSchema';
import { BiomeGenerationEngine } from './BiomeGenerationEngine';
import { BIOME_RESOURCES } from '../data/StaticData';
import { BiomePoolManager } from './BiomeRegistry';
import { NPCFactory } from '../factories/NPCFactory';

export class HexGenerator {
    private static resourceTables = BIOME_RESOURCES;

    /**
     * Generates a new hex at the given coordinates.
     */
    public static generateHex(
        coords: [number, number],
        neighbors: { biome: BiomeType, visualVariant?: number }[],
        clusterSizes: Record<BiomeType, number>,
        pool?: BiomePoolManager,
        coastlines: Coastline[] = []
    ): Hex {
        const result = BiomeGenerationEngine.selectBiome(coords, neighbors, clusterSizes, coastlines);
        const biome = result.biome;
        const oceanDir = result.oceanDirection;

        const hash = Math.abs(coords[0] * 31 + coords[1] * 17);
        const activePool = pool || new BiomePoolManager();

        // Smart Variant Selection: Exclude variants used by immediate neighbors of the same biome
        const excludedVariants = neighbors
            .filter(n => n.biome === biome && n.visualVariant !== undefined)
            .map(n => n.visualVariant!);

        const variant = activePool.getVariant(biome, hash, excludedVariants);

        // Roll for resource nodes
        const nodes: ResourceNode[] = [];
        const table = this.resourceTables.find(t => t.biome === biome);

        if (table && Math.random() > 0.5) { // 50% chance for a node
            const roll = Math.random() * table.resources.reduce((a: any, b: any) => a + b.weight, 0);
            let current = 0;
            for (const res of table.resources) {
                current += res.weight;
                if (roll < current) {
                    nodes.push({
                        id: `node_${Math.random().toString(36).substr(2, 9)}`,
                        resourceType: this.determineResourceType(res.itemId),
                        itemId: res.itemId,
                        quantityRemaining: Math.floor(Math.random() * 3) + 1,
                        respawnDays: 7,
                        skillCheck: { skill: 'Nature', dc: 10 }
                    });
                    break;
                }
            }
        }

        // Roll for NPCs (10% chance)
        // REVERTED: User request - Logic pending approval.

        return {
            coordinates: coords,
            name: `${biome} (Unknown)`,
            generated: true,
            biome: biome,
            description: `A vast expanse of ${biome.toLowerCase()}.`,
            traversable_sides: { 'N': true, 'S': true, 'NE': true, 'NW': true, 'SE': true, 'SW': true },
            interest_points: [],
            resourceNodes: nodes,
            openedContainers: {},
            visited: false,
            inLineOfSight: false,
            namingSource: 'engine',
            visualVariant: variant,
            oceanDirection: oceanDir,
            npcs: npcIds
        };
    }

    private static determineResourceType(itemId: string): 'Ore' | 'Herb' | 'Wood' | 'Hide' | 'Gem' | 'Arcane' {
        const id = itemId.toLowerCase();
        if (id.includes('ore')) return 'Ore';
        if (id.includes('wood') || id.includes('log') || id.includes('ironwood')) return 'Wood';
        if (id.includes('herb') || id.includes('leaf') || id.includes('bean') || id.includes('bloom') || id.includes('shade') || id.includes('rose')) return 'Herb';
        if (id.includes('hide') || id.includes('scale')) return 'Hide';
        if (id.includes('gem')) return 'Gem';
        return 'Arcane';
    }
}
