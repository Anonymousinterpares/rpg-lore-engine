import { MapRegistry, Hex, HexSchema, MapRegistrySchema, HexDirection } from '../schemas/HexMapSchema';
import { IStorageProvider } from './IStorageProvider';
import { FileStorageProvider } from './FileStorageProvider';
import * as path from 'path';

export class HexMapManager {
    private mapPath: string;
    private registry: MapRegistry;
    private storage: IStorageProvider;

    constructor(basePath: string, registry: MapRegistry, gridId: string = 'world_01', storage?: IStorageProvider) {
        this.storage = storage || new FileStorageProvider();
        this.mapPath = path.join(basePath, 'data', 'world', `${gridId}.json`);
        this.registry = registry;
    }

    /**
     * Bootstraps the registry from storage if empty.
     */
    public async initialize(): Promise<void> {
        // If the registry is empty, try to bootstrap it from the local file if it exists
        // This ensures Option A still respects pre-existing world data during development
        if (Object.keys(this.registry.hexes).length === 0 && await this.storage.exists(this.mapPath)) {
            const data = await this.storage.read(this.mapPath) as string;
            const fileRegistry = JSON.parse(data);
            this.registry.hexes = fileRegistry.hexes;
            this.registry.grid_id = fileRegistry.grid_id || this.registry.grid_id;
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
    public async setHex(hex: Hex): Promise<void> {
        const key = `${hex.coordinates[0]},${hex.coordinates[1]}`;
        this.registry.hexes[key] = hex;
        await this.save();
    }

    /**
     * Calculates the new coordinates based on direction
     */
    public static getNewCoords(current: [number, number], direction: HexDirection): [number, number] {
        const [q, r] = current;
        switch (direction) {
            case 'N': return [q, r + 1];
            case 'S': return [q, r - 1];
            case 'NE': return [q + 1, r];
            case 'NW': return [q - 1, r + 1];
            case 'SE': return [q + 1, r - 1];
            case 'SW': return [q - 1, r];
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
    private async save(): Promise<void> {
        await this.storage.write(this.mapPath, JSON.stringify(this.registry, null, 2));
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
                const directions: HexDirection[] = ['N', 'S', 'NE', 'NW', 'SE', 'SW'];
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
        const directions: HexDirection[] = ['N', 'S', 'NE', 'NW', 'SE', 'SW'];
        return directions
            .map(dir => this.getHex(`${HexMapManager.getNewCoords(coords, dir)[0]},${HexMapManager.getNewCoords(coords, dir)[1]}`))
            .filter(h => h !== null) as Hex[];
    }

    /**
     * Ensures all 6 neighbors of a coordinate exist in the registry.
     * If they don't, creates minimal placeholders.
     */
    public async ensureNeighborsRegistered(coords: [number, number]): Promise<void> {
        const directions: HexDirection[] = ['N', 'S', 'NE', 'NW', 'SE', 'SW'];
        for (const dir of directions) {
            const neighborCoords = HexMapManager.getNewCoords(coords, dir);
            const key = `${neighborCoords[0]},${neighborCoords[1]}`;
            if (!this.registry.hexes[key]) {
                const placeholder: Hex = {
                    coordinates: neighborCoords,
                    generated: false,
                    visited: false,
                    biome: 'Plains', // Initial guess, will be refined by expandHorizon
                    name: 'Uncharted Territory',
                    description: 'The mists of the unknown cling to this place.',
                    inLineOfSight: false,
                    interest_points: [],
                    resourceNodes: [],
                    openedContainers: {},
                    namingSource: 'engine',
                    visualVariant: 1
                };
                this.registry.hexes[key] = placeholder;
            }
        }
        await this.save();
    }
}
