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
    private static currentSeed: number = -1;
    private static isInitialized = false;

    // World Dimensions
    private static readonly WORLD_HEIGHT = 500; // North-South
    private static readonly WORLD_WIDTH = 550;  // East-West

    private static initialize(seed: number = 12345) {
        if (this.isInitialized && this.currentSeed === seed) return;

        this.noise = new NoiseGenerator(seed);
        this.moistureNoise = new NoiseGenerator(seed + 1000);
        this.elevationNoise = new NoiseGenerator(seed + 2000);
        this.volcanismNoise = new NoiseGenerator(seed + 3000);
        this.isInitialized = true;
        this.currentSeed = seed;
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
        // The centerX and centerY variables were not used in the original logic,
        // and the x, y variables were directly assigned q, r.
        // Keeping the provided snippet's structure for x and y.
        const halfWidth = this.WORLD_WIDTH / 2;
        const halfHeight = this.WORLD_HEIGHT / 2;

        // Use axial coordinate q directly for X, and simple approximation for Y
        const x = q;
        const y = r;

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
                if (climate.elevation < 0.35) {
                    return { biome: 'Ocean' };
                }
            }
        }

        // 4. Biome Mapping from Climate
        return { biome: this.selectBiomeFromClimate(climate) };
    }

    private static generateClimate(q: number, r: number): ClimateData {
        // Increased scale from 0.05 to 0.1 to create smaller, more varied biome patches
        const scale = 0.1;

        // Latitude (North-South) Normalization
        const normalizedY = (r + (this.WORLD_HEIGHT / 2)) / this.WORLD_HEIGHT; // 0 to 1

        // Temperature: Warmer at Equator (0.5), Colder at Poles (0, 1)
        // Base temp = 1 - 2 * |0.5 - y|  -> 0 at poles, 1 at equator
        const baseTemp = 1 - 2 * Math.abs(0.5 - normalizedY);
        const tempMod = this.noise.fbm(q * scale, r * scale, 3, 0.5, 2) * 0.4 - 0.2; // +/- 0.2
        const temperature = Math.max(0, Math.min(1, baseTemp + tempMod));

        // Moisture: Purely noise based
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
