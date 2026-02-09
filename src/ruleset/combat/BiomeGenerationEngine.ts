import { BIOME_DEFINITIONS } from '../data/StaticData';
import { BiomeType } from '../schemas/BiomeSchema';
import { Coastline } from '../schemas/HexMapSchema';

export interface BiomeSelectionResult {
    biome: BiomeType;
    oceanDirection?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'SE' | 'NW' | 'SW';
}

export class BiomeGenerationEngine {
    private static definitions = BIOME_DEFINITIONS;

    /**
     * Selects a biome for a new hex based on its neighbors and world context.
     */
    public static selectBiome(
        coords: [number, number],
        neighbors: { biome: BiomeType }[],
        clusterSizes: Record<BiomeType, number>,
        coastlines: Coastline[] = []
    ): BiomeSelectionResult {
        const [q, r] = coords;

        // 1. Process Coastline Influence
        for (const line of coastlines) {
            const distance = this.getDistanceFromCoastline(q, r, line);

            // Distance 0 to 1 is the Shoreline
            if (distance >= 0 && distance <= 1.1) {
                return {
                    biome: 'Coast',
                    oceanDirection: this.getOceanDirection(line)
                };
            }

            // Distance > 1 is the Ocean Zone
            if (distance > 1.1) {
                // Feature check: Distant Islands or Continents
                const seed = this.deterministicHash(q, r, line.id);

                // Tier 1: Guaranteed Deep Ocean (depth 1 to 5)
                if (distance <= 5.1) {
                    return { biome: 'Ocean' };
                }

                // Tier 2: Potential Islands (depth 6 to 15)
                if (distance <= 15.1) {
                    // 3% chance for a hex to be part of an island cluster
                    // We use the seed for a basic "clump" logic
                    if (seed < 0.03) {
                        // Fall back to land biome selection for island
                        const landBiome = this.selectLandBiome(neighbors, clusterSizes);
                        return { biome: landBiome };
                    }
                    return { biome: 'Ocean' };
                }

                // Tier 3: Potential New Continent (depth > 15)
                if (distance > 15.1) {
                    // Very low chance (0.1%) for a hex to start a new continent
                    // Note: Actual coastline seeding happens in GameLoop, but we allow 
                    // land to spawn here if the seed matches.
                    if (seed < 0.005) {
                        const landBiome = this.selectLandBiome(neighbors, clusterSizes);
                        return { biome: landBiome };
                    }
                    return { biome: 'Ocean' };
                }
            }
        }

        // 2. Normal Land Biome Selection (Existing weights)
        return { biome: this.selectLandBiome(neighbors, clusterSizes) };
    }

    private static selectLandBiome(neighbors: { biome: BiomeType }[], clusterSizes: Record<BiomeType, number>): BiomeType {
        const finalWeights: Record<string, number> = {};

        for (const def of this.definitions) {
            // Coast cannot be spawned randomly anymore
            if (def.id === 'Coast') {
                finalWeights[def.id] = 0;
                continue;
            }

            let weight = def.baseAppearanceWeight;

            // Adjacency modifications
            for (const neighbor of neighbors) {
                if (def.adjacencyModifiers && (def.adjacencyModifiers as any)[neighbor.biome]) {
                    weight += (def.adjacencyModifiers as any)[neighbor.biome];
                }
            }

            // Cluster penalty
            const currentSize = clusterSizes[def.id as BiomeType] || 0;
            if (currentSize >= def.maxClusterSize) {
                weight *= (1 - def.clusterPenaltyMultiplier);
            }

            finalWeights[def.id] = Math.max(0, weight);
        }

        const total = Object.values(finalWeights).reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;

        for (const [id, weight] of Object.entries(finalWeights)) {
            roll -= weight;
            if (roll <= 0) return id as BiomeType;
        }

        return 'Plains';
    }

    private static getDistanceFromCoastline(q: number, r: number, line: Coastline): number {
        let value: number;
        switch (line.equation) {
            case 'q': value = q; break;
            case 'q+r': value = q + r; break;
            case 'q-r': value = q - r; break;
            default: value = q;
        }

        return line.oceanSide === 'positive'
            ? value - line.threshold
            : line.threshold - value;
    }

    private static getOceanDirection(line: Coastline): 'N' | 'S' | 'E' | 'W' | 'NE' | 'SE' | 'NW' | 'SW' {
        const side = line.oceanSide;
        switch (line.equation) {
            case 'q': return side === 'positive' ? 'E' : 'W';
            case 'q+r': return side === 'positive' ? 'SE' : 'NW';
            case 'q-r': return side === 'positive' ? 'NE' : 'SW';
            default: return 'E';
        }
    }

    private static deterministicHash(q: number, r: number, salt: string): number {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        const str = `${q},${r},${salt}`;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)) / 10000000000000000;
    }
}
