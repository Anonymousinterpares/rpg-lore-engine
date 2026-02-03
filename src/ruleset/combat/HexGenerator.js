import { BiomeGenerationEngine } from './BiomeGenerationEngine';
import { BIOME_RESOURCES } from '../data/StaticData';
export class HexGenerator {
    static resourceTables = BIOME_RESOURCES;
    /**
     * Generates a new hex at the given coordinates.
     */
    static generateHex(coords, neighbors, clusterSizes) {
        const biome = BiomeGenerationEngine.selectBiome(neighbors, clusterSizes);
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
            generated: true,
            biome: biome,
            name: `${biome} Region`,
            description: `A vast expanse of ${biome.toLowerCase()}.`,
            traversable_sides: { 'N': true, 'S': true, 'E': true, 'W': true, 'NE': true, 'NW': true, 'SE': true, 'SW': true },
            interest_points: [],
            resourceNodes: nodes,
            openedContainers: {},
            visited: false
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
