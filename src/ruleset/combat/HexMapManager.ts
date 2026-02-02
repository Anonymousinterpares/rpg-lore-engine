import * as fs from 'fs';
import * as path from 'path';
import { MapRegistry, Hex, HexSchema, MapRegistrySchema, HexDirection } from '../schemas/HexMapSchema';

export class HexMapManager {
    private mapPath: string;
    private registry: MapRegistry;

    constructor(basePath: string, gridId: string = 'world_01') {
        this.mapPath = path.join(basePath, 'data', 'world', `${gridId}.json`);

        const dir = path.dirname(this.mapPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(this.mapPath)) {
            this.registry = JSON.parse(fs.readFileSync(this.mapPath, 'utf-8'));
        } else {
            this.registry = { grid_id: gridId, hexes: {} };
            this.save();
        }
    }

    /**
     * Gets a hex by its coordinate string (e.g., "0,0")
     */
    public getHex(coordStr: string): Hex | null {
        return this.registry.hexes[coordStr] || null;
    }

    /**
     * Adds or updates a hex in the registry
     */
    public setHex(hex: Hex) {
        const key = `${hex.coordinates[0]},${hex.coordinates[1]}`;
        this.registry.hexes[key] = hex;
        this.save();
    }

    /**
     * Calculates the new coordinates based on direction
     */
    public static getNewCoords(current: [number, number], direction: HexDirection): [number, number] {
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
    public canTraverse(currentHex: Hex, direction: HexDirection): boolean {
        if (!currentHex.traversable_sides) return true; // Default to open
        return currentHex.traversable_sides[direction] !== false;
    }

    /**
     * Persists the current registry to disk
     */
    private save() {
        fs.writeFileSync(this.mapPath, JSON.stringify(this.registry, null, 2));
    }

    public getRegistry(): MapRegistry {
        return this.registry;
    }

    /**
     * Returns the size of a contiguous cluster of the same biome.
     */
    public getClusterSize(startHex: Hex): number {
        const biome = startHex.biome;
        const visited = new Set<string>();
        const queue = [`${startHex.coordinates[0]},${startHex.coordinates[1]}`];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;

            const [x, y] = current.split(',').map(Number);
            const hex = this.getHex(current);

            if (hex && hex.biome === biome) {
                visited.add(current);
                // Check neighbors
                const directions: HexDirection[] = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
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
    public getNeighbors(coords: [number, number]): Hex[] {
        const directions: HexDirection[] = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
        return directions
            .map(dir => this.getHex(`${HexMapManager.getNewCoords(coords, dir)[0]},${HexMapManager.getNewCoords(coords, dir)[1]}`))
            .filter(h => h !== null) as Hex[];
    }
}
