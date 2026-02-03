import { HexMapManager } from './HexMapManager';
export class MovementEngine {
    mapManager;
    constructor(mapManager) {
        this.mapManager = mapManager;
    }
    /**
     * Attempts to move the player in a direction from the current hex.
     */
    move(currentCoords, direction) {
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
            newHex = {
                coordinates: newCoords,
                generated: false,
                visited: false,
                biome: 'Plains', // Default for placeholder
                name: 'Uncharted Territory',
                description: 'The mists of the unknown cling to this place.',
                interest_points: [],
                resourceNodes: [],
                openedContainers: {}
            };
            this.mapManager.setHex(newHex);
            requiresGeneration = true;
        }
        else if (!newHex.generated) {
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
    applyGeneratedHexData(coords, data) {
        const key = `${coords[0]},${coords[1]}`;
        const existing = this.mapManager.getHex(key);
        if (!existing)
            return;
        const updatedHex = {
            ...existing,
            ...data,
            coordinates: coords, // Critical to keep original coords
            generated: true
        };
        this.mapManager.setHex(updatedHex);
    }
}
