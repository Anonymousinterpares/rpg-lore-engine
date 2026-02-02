import { HexMapManager } from './HexMapManager';
import { Hex, HexDirection } from '../schemas/HexMapSchema';

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
     * Attempts to move the player in a direction from the current hex.
     */
    public move(currentCoords: [number, number], direction: HexDirection): MovementResult {
        const currentHexKey = `${currentCoords[0]},${currentCoords[1]}`;
        const currentHex = this.mapManager.getHex(currentHexKey);

        if (!currentHex) {
            return { success: false, newHex: null, requiresGeneration: false, message: 'Current location not found in map registry.', timeCost: 0 };
        }

        if (!this.mapManager.canTraverse(currentHex, direction)) {
            return { success: false, newHex: null, requiresGeneration: false, message: `Movement blocked to the ${direction}. Path is impassable.`, timeCost: 0 };
        }

        const newCoords = HexMapManager.getNewCoords(currentCoords, direction);
        const newHexKey = `${newCoords[0]},${newCoords[1]}`;
        let newHex = this.mapManager.getHex(newHexKey);

        let requiresGeneration = false;

        if (!newHex) {
            // Hex doesn't exist, create a placeholder and flag for generation
            newHex = { coordinates: newCoords, generated: false, visited: false, interest_points: [] };
            this.mapManager.setHex(newHex);
            requiresGeneration = true;
        } else if (!newHex.generated) {
            requiresGeneration = true;
        }

        // Mark as visited
        newHex.visited = true;
        this.mapManager.setHex(newHex);

        const message = requiresGeneration
            ? `You venture ${direction} into unexplored territory... [TRIGGER: HEX_GENERATION]`
            : `You travel ${direction} into ${newHex.name || 'the unknown'}.`;

        const timeCost = 4 * 60; // Standard 4 hours per hex travel

        return { success: true, newHex, requiresGeneration, message, timeCost };
    }

    /**
     * Called by the LLM agent to populate a newly generated hex.
     */
    public applyGeneratedHexData(coords: [number, number], data: Partial<Hex>) {
        const key = `${coords[0]},${coords[1]}`;
        const existing = this.mapManager.getHex(key);

        const updatedHex: Hex = {
            coordinates: coords,
            visited: existing?.visited ?? false,
            interest_points: existing?.interest_points ?? [],
            ...existing,
            ...data,
            generated: true // Ensure it's marked as generated
        };
        this.mapManager.setHex(updatedHex);
    }
}
