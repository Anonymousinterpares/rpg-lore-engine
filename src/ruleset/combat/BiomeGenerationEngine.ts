import { BiomeType } from '../schemas/BiomeSchema';
import { Coastline } from '../schemas/HexMapSchema';
import { NoiseGenerator } from './NoiseGenerator';

export interface BiomeSelectionResult {
    biome: BiomeType;
    oceanDirection?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'SE' | 'NW' | 'SW';
}

export interface ClimateData {
    temperature: number; // 0 (Cold) to 1 (Hot)
    moisture: number;    // 0 (Dry) to 1 (Wet)
    elevation: number;   // 0 (Low) to 1 (High)
    volcanism: number;   // 0 (None) to 1 (Active)
}

export class BiomeGenerationEngine {
    private static noise: NoiseGenerator;
    private static moistureNoise: NoiseGenerator;
    private static elevationNoise: NoiseGenerator;
    private static volcanismNoise: NoiseGenerator;
    private static isInitialized = false;

    // World Dimensions
    private static readonly WORLD_HEIGHT = 500; // North-South
    private static readonly WORLD_WIDTH = 550;  // East-West

    private static initialize(seed: number = 12345) {
        if (this.isInitialized) return;
        this.noise = new NoiseGenerator(seed);
        this.moistureNoise = new NoiseGenerator(seed + 1000);
        this.elevationNoise = new NoiseGenerator(seed + 2000);
        this.volcanismNoise = new NoiseGenerator(seed + 3000);
        this.isInitialized = true;
    }

    /**
     * Selects a biome for a new hex based on climate and world context.
     */
    public static selectBiome(
        coords: [number, number],
        coastlines: Coastline[] = [],
        seed: number = 12345
    ): BiomeSelectionResult {
        this.initialize(seed);
        const [q, r] = coords;

        // 1. World Bounds Logic (Ocean at edges)
        // Convert hex coords to approximate world coords
        // We assume 0,0 is center or top-left? Let's assume center for noise, but bounds need reference.
        // Let's assume the world is centered at 0,0 for generation purposes, or we map q,r to 0..Width/Height
        const centerX = 0;
        const centerY = 0; // Relative to world center
        const halfWidth = this.WORLD_WIDTH / 2;
        const halfHeight = this.WORLD_HEIGHT / 2;

        // Approximate Cartesian from Hex (Axial)
        // x = size * 3/2 * q
        // y = size * sqrt(3) * (r + q/2)
        // Simplified for bounds check:
        const x = q;
        const y = r; // Axial R aligns roughly with Y (North-South) inverted or not depending on system.

        // Edge Enforcement
        // If we are significantly outside the defined bounds, it's Ocean.
        // We use a safe buffer of 3 hexes as requested.
        const distFromEdgeX = halfWidth - Math.abs(x);
        const distFromEdgeY = halfHeight - Math.abs(y);

        if (distFromEdgeX < 3 || distFromEdgeY < 3) {
            return { biome: 'Ocean' };
        }

        // 2. Generate Climate
        const climate = this.generateClimate(q, r);

        // 3. Process Coastline Influence
        for (const line of coastlines) {
            const distance = this.getDistanceFromCoastline(q, r, line);

            // Shoreline (0 to 1)
            if (distance >= 0 && distance <= 1.1) {
                const oceanDir = this.getOceanDirection(line);
                let coastalBiome: BiomeType = 'Coast';

                // Contextual Coast
                if (climate.temperature < 0.25) {
                    coastalBiome = 'Coast_Cold';
                } else if (climate.temperature > 0.8 && climate.moisture < 0.3) {
                    coastalBiome = 'Coast_Desert';
                }

                return { biome: coastalBiome, oceanDirection: oceanDir };
            }

            // Ocean Zone (> 1)
            if (distance > 1.1) {
                // Tier 1: Guaranteed Deep Ocean (depth 1 to 5)
                if (distance <= 5.1) return { biome: 'Ocean' };

                // Tier 2 & 3: Islands/Continents handled by standard logic below if not returned here
                // But existing logic had specific return paths.
                // To maintain "Islands", we can use Elevation noise.
                // If Elevation is high enough in "Ocean" zone, it's an Island.
                // For now, let's respect the explicit "Ocean" from the original request unless it's a "New Continent" seed.
                // Original logic had random chances. Let's use Elevation > 0.4 as Island in deep water?
                // Or stick to the original plan: Coastlines define the edge.
                if (climate.elevation < 0.35) {
                    return { biome: 'Ocean' };
                }
            }
        }

        // 4. Biome Mapping from Climate
        return { biome: this.selectBiomeFromClimate(climate) };
    }

    private static generateClimate(q: number, r: number): ClimateData {
        const scale = 0.05; // Zoom level for noise

        // Latitude (North-South) Normalization
        // Mapped to 0 (North Pole) to 1 (South Pole) or similar.
        // Let's say map goes from -250 (North) to +250 (South).
        const normalizedY = (r + (this.WORLD_HEIGHT / 2)) / this.WORLD_HEIGHT; // 0 to 1

        // Temperature: Warmer at Equator (0.5), Colder at Poles (0, 1)
        // Base temp = 1 - 2 * |0.5 - y|  -> 0 at poles, 1 at equator
        const baseTemp = 1 - 2 * Math.abs(0.5 - normalizedY);
        const tempMod = this.noise.fbm(q * scale, r * scale, 3, 0.5, 2) * 0.4 - 0.2; // +/- 0.2
        const temperature = Math.max(0, Math.min(1, baseTemp + tempMod));

        // Moisture: Purely noise based, maybe slightly wetter at equator?
        const moisture = this.moistureNoise.fbm(q * scale, r * scale, 4, 0.5, 2);

        // Elevation: Noise
        const elevation = this.elevationNoise.fbm(q * scale, r * scale, 5, 0.5, 2);

        // Volcanism: Sparse noise
        const volcanism = this.volcanismNoise.fbm(q * scale * 2, r * scale * 2, 2);

        return { temperature, moisture, elevation, volcanism };
    }

    private static selectBiomeFromClimate(climate: ClimateData): BiomeType {
        const { temperature, moisture, elevation, volcanism } = climate;

        // 1. Volcanic (Priority, Independent of Elevation per user)
        if (volcanism > 0.95) return 'Volcanic';

        // 2. High Altitude (Mountains)
        if (elevation > 0.85) return 'Mountain_High'; // Snowy peaks
        if (elevation > 0.70) return 'Mountains';
        if (elevation > 0.60) return 'Hills';

        // 3. Climate Matrix
        // Cold
        if (temperature < 0.25) {
            // Tundra (Dry/Wet doesn't vary much for Tundra in this simplified model, but could distinguish Ice)
            return 'Tundra';
        }

        // Hot
        if (temperature > 0.75) {
            if (moisture < 0.3) return 'Desert';
            if (moisture > 0.6) return 'Jungle';
            // Moderate moisture hot = Savanna/Plains? Let's fallback to Plains or Desert
            return 'Plains';
        }

        // Temperate (Middle)
        if (moisture < 0.3) return 'Plains'; // Dry temperate
        if (moisture > 0.7) return 'Swamp';  // Wet temperate

        // Moderate Temperate
        // Mix of Forest and Plains/Farmland
        if (moisture > 0.5) return 'Forest';

        return 'Plains'; // Default
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
}
