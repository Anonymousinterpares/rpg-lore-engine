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
}
