import { HexMapManager } from './HexMapManager';
import { Hex, HexDirection } from '../schemas/HexMapSchema';
import { TravelPace } from '../schemas/BaseSchemas';
import { BIOME_DEFINITIONS } from '../data/StaticData';

export interface MovementResult {
    success: boolean;
    newHex: Hex | null;
    requiresGeneration: boolean;
    message: string;
    timeCost: number; // In minutes
}

export class MovementEngine {
    private mapManager: HexMapManager;

    constructor(mapManager: HexMapManager) {
        this.mapManager = mapManager;
    }

    /**
     * Helper to get direction from coordinate delta.
     */
    public static getDirection(current: [number, number], target: [number, number]): HexDirection | null {
        const dq = target[0] - current[0];
        const dr = target[1] - current[1];

        if (dq === 0 && dr === 1) return 'N';
        if (dq === 0 && dr === -1) return 'S';
        if (dq === 1 && dr === 0) return 'NE';
        if (dq === -1 && dr === 1) return 'NW';
        if (dq === 1 && dr === -1) return 'SE';
        if (dq === -1 && dr === 0) return 'SW';

        return null;
    }

    /**
     * Calculates distance between two hexes in axial coordinates.
     */
    public static getDistance(a: [number, number], b: [number, number]): number {
        return (Math.abs(a[0] - b[0])
            + Math.abs(a[0] + a[1] - b[0] - b[1])
            + Math.abs(a[1] - b[1])) / 2;
    }

    /**
     * Attempts to move the player toward a target destination.
     * Can be called with a direction or specific target coordinates.
     */
    public move(
        currentCoords: [number, number],
        input: HexDirection | [number, number],
        pace: TravelPace = 'Normal',
        hasRoadConnection: boolean = false
    ): MovementResult {
        let direction: HexDirection | null = null;
        let targetCoords: [number, number] | null = null;

        if (typeof input === 'string') {
            direction = input;
            targetCoords = HexMapManager.getNewCoords(currentCoords, direction);
        } else {
            targetCoords = input;
            direction = MovementEngine.getDirection(currentCoords, targetCoords);
            const distance = MovementEngine.getDistance(currentCoords, targetCoords);

            if (distance > 1) {
                return { success: false, newHex: null, requiresGeneration: false, message: 'Destination is too far. You can only move to adjacent hexes.', timeCost: 0 };
            }
            if (!direction) {
                return { success: false, newHex: null, requiresGeneration: false, message: 'Invalid destination coordinates.', timeCost: 0 };
            }
        }
        const currentHexKey = `${currentCoords[0]},${currentCoords[1]}`;
        const currentHex = this.mapManager.getHex(currentHexKey);

        if (!currentHex) {
            return { success: false, newHex: null, requiresGeneration: false, message: 'Current location not found in map registry.', timeCost: 0 };
        }

        // Road connection overrides traversability blocks (§4.3)
        if (!hasRoadConnection && !this.mapManager.canTraverse(currentHex, direction)) {
            return { success: false, newHex: null, requiresGeneration: false, message: `Movement blocked to the ${direction}. Path is impassable.`, timeCost: 0 };
        }

        const newCoords = HexMapManager.getNewCoords(currentCoords, direction);
        const newHexKey = `${newCoords[0]},${newCoords[1]}`;
        let newHex = this.mapManager.getHex(newHexKey);

        let requiresGeneration = false;

        if (!newHex) {
            // Hex doesn't exist, create a placeholder and flag for generation
            newHex = {
                coordinates: newCoords,
                generated: false,
                visited: false,
                biome: 'Plains', // Default for placeholder
                name: 'Uncharted Territory',
                description: 'The mists of the unknown cling to this place.',
                inLineOfSight: false,
                interest_points: [],
                resourceNodes: [],
                openedContainers: {},
                namingSource: 'engine',
                visualVariant: 1,
                npcs: []
            };
            this.mapManager.setHex(newHex!);
            requiresGeneration = true;
        } else if (!newHex.generated) {
            requiresGeneration = true;
        }

        if (!newHex) return { success: false, newHex: null, requiresGeneration: false, message: 'Failed to create movement destination.', timeCost: 0 };

        // Ocean Blocking Logic
        if (newHex.biome === 'Ocean') {
            // TODO: Future boat/ship implementation could allow movement here.
            return {
                success: false,
                newHex: null,
                requiresGeneration: false,
                message: 'You cannot walk into the deep ocean without a vessel.',
                timeCost: 0
            };
        }

        // Mark as visited
        newHex.visited = true;
        this.mapManager.setHex(newHex);

        // Track movement for tutorial
        const engine = (this as any).engine; // Hack if needed, but let's check where MovementEngine is used.
        // Actually, MovementEngine is a subsystem. I'll check GameLoop.ts.

        const message = requiresGeneration
            ? `You venture ${direction} into unexplored territory... [TRIGGER: HEX_GENERATION]`
            : `You travel ${direction} into ${newHex.name || 'the unknown'}.`;

        // Biome speed modifier
        const biomeDef = BIOME_DEFINITIONS.find(b => b.id === newHex!.biome);
        const speedMod = biomeDef?.travelSpeedModifier || 1.0;

        // Pace-based time cost calculation
        const baseTime = 4 * 60; // 4 hours base
        let timeCost = Math.floor(baseTime / speedMod);

        if (pace === 'Fast') timeCost = Math.floor(timeCost * 0.75); // 3 hours equivalent
        if (pace === 'Slow') timeCost = Math.floor(timeCost * 1.5);  // 6 hours equivalent

        return { success: true, newHex, requiresGeneration, message, timeCost };
    }

    /**
     * Called by the LLM agent to populate a newly generated hex.
     */
    public applyGeneratedHexData(coords: [number, number], data: Partial<Hex>) {
        const key = `${coords[0]},${coords[1]}`;
        const existing = this.mapManager.getHex(key);

        if (!existing) return;

        const updatedHex: Hex = {
            ...existing,
            ...data,
            coordinates: coords, // Critical to keep original coords
            generated: true
        };
        this.mapManager.setHex(updatedHex);
    }
}
