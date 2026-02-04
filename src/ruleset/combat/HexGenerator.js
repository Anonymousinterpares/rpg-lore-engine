import { BiomeGenerationEngine } from './BiomeGenerationEngine';
import { BIOME_RESOURCES } from '../data/StaticData';
import { BiomePoolManager } from './BiomeRegistry';
export class HexGenerator {
    static resourceTables = BIOME_RESOURCES;
    /**
     * Generates a new hex at the given coordinates.
     */
    static generateHex(coords, neighbors, clusterSizes, pool) {
        const biome = BiomeGenerationEngine.selectBiome(neighbors, clusterSizes);
        const hash = Math.abs(coords[0] * 31 + coords[1] * 17);
        const activePool = pool || new BiomePoolManager();
        const variant = activePool.getVariant(biome, hash);
        // Roll for resource nodes
        const nodes = [];
        const table = this.resourceTables.find(t => t.biome === biome);
        if (table && Math.random() > 0.5) { // 50% chance for a node
            const roll = Math.random() * table.resources.reduce((a, b) => a + b.weight, 0);
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
            namingSource: 'engine',
            visualVariant: variant
        };
    }
    static determineResourceType(itemId) {
        const id = itemId.toLowerCase();
        if (id.includes('ore'))
            return 'Ore';
        if (id.includes('wood') || id.includes('log') || id.includes('ironwood'))
            return 'Wood';
        if (id.includes('herb') || id.includes('leaf') || id.includes('bean') || id.includes('bloom') || id.includes('shade') || id.includes('rose'))
            return 'Herb';
        if (id.includes('hide') || id.includes('scale'))
            return 'Hide';
        if (id.includes('gem'))
            return 'Gem';
        return 'Arcane';
    }
}
