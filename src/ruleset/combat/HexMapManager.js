import { FileStorageProvider } from './FileStorageProvider';
import * as path from 'path';
export class HexMapManager {
    mapPath;
    registry;
    storage;
    constructor(basePath, gridId = 'world_01', storage) {
        this.storage = storage || new FileStorageProvider();
        this.mapPath = path.join(basePath, 'data', 'world', `${gridId}.json`);
        if (this.storage.exists(this.mapPath)) {
            const data = this.storage.read(this.mapPath);
            this.registry = JSON.parse(data);
        }
        else {
            this.registry = { grid_id: gridId, hexes: {} };
            this.save();
        }
    }
    /**
     * Gets a hex by its coordinate string (e.g., "0,0")
     */
    getHex(coordStr) {
        return this.registry.hexes[coordStr] || null;
    }
    /**
     * Adds or updates a hex in the registry
     */
    setHex(hex) {
        const key = `${hex.coordinates[0]},${hex.coordinates[1]}`;
        this.registry.hexes[key] = hex;
        this.save();
    }
    /**
     * Calculates the new coordinates based on direction
     */
    static getNewCoords(current, direction) {
        const [x, y] = current;
        switch (direction) {
            case 'N': return [x, y + 1];
            case 'S': return [x, y - 1];
            case 'E': return [x + 1, y];
            case 'W': return [x - 1, y];
            case 'NE': return [x + 1, y + 1];
            case 'NW': return [x - 1, y + 1];
            case 'SE': return [x + 1, y - 1];
            case 'SW': return [x - 1, y - 1];
        }
    }
    /**
     * Checks if movement is allowed in a given direction from the current hex
     */
    canTraverse(currentHex, direction) {
        if (!currentHex.traversable_sides)
            return true; // Default to open
        return currentHex.traversable_sides[direction] !== false;
    }
    /**
     * Persists the current registry to disk
     */
    save() {
        this.storage.write(this.mapPath, JSON.stringify(this.registry, null, 2));
    }
    getRegistry() {
        return this.registry;
    }
    /**
     * Returns the size of a contiguous cluster of the same biome.
     */
    getClusterSize(startHex) {
        const biome = startHex.biome;
        const visited = new Set();
        const queue = [`${startHex.coordinates[0]},${startHex.coordinates[1]}`];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current))
                continue;
            const [x, y] = current.split(',').map(Number);
            const hex = this.getHex(current);
            if (hex && hex.biome === biome) {
                visited.add(current);
                // Check neighbors
                const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
                for (const dir of directions) {
                    const nc = HexMapManager.getNewCoords([x, y], dir);
                    queue.push(`${nc[0]},${nc[1]}`);
                }
            }
        }
        return visited.size;
    }
    /**
     * Gets all existing non-null neighbors for a coordinate.
     */
    getNeighbors(coords) {
        const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
        return directions
            .map(dir => this.getHex(`${HexMapManager.getNewCoords(coords, dir)[0]},${HexMapManager.getNewCoords(coords, dir)[1]}`))
            .filter(h => h !== null);
    }
}
