import { IStorageProvider } from './IStorageProvider';
import { FileStorageProvider } from './FileStorageProvider';
import * as path from 'path';
import { SubLocation, SubLocationSchema, WorldNPC, WorldNPCSchema } from '../schemas/WorldEnrichmentSchema';

export class WorldEnrichmentManager {
    private dataDir: string;
    private storage: IStorageProvider;

    constructor(basePath: string, storage?: IStorageProvider) {
        this.storage = storage || new FileStorageProvider();
        this.dataDir = path.join(basePath, 'data');
    }

    /**
     * Loads a SubLocation by its ID
     */
    public loadSubLocation(id: string): SubLocation | null {
        const filePath = path.join(this.dataDir, 'sub_locations', `${id}.json`);
        if (!this.storage.exists(filePath)) return null;

        const raw = JSON.parse(this.storage.read(filePath) as string);
        return SubLocationSchema.parse(raw);
    }

    /**
     * Saves a SubLocation
     */
    public saveSubLocation(subLocation: SubLocation) {
        const dir = path.join(this.dataDir, 'sub_locations');
        this.storage.mkdir(dir);

        const filePath = path.join(dir, `${subLocation.id}.json`);
        this.storage.write(filePath, JSON.stringify(subLocation, null, 2));
    }

    /**
     * Loads a WorldNPC by its ID
     */
    public loadNPC(id: string): WorldNPC | null {
        const filePath = path.join(this.dataDir, 'npcs', `${id}.json`);
        if (!this.storage.exists(filePath)) return null;

        const raw = JSON.parse(this.storage.read(filePath) as string);
        return WorldNPCSchema.parse(raw);
    }

    /**
     * Saves a WorldNPC
     */
    public saveNPC(npc: WorldNPC) {
        const dir = path.join(this.dataDir, 'npcs');
        this.storage.mkdir(dir);

        const filePath = path.join(dir, `${npc.id}.json`);
        this.storage.write(filePath, JSON.stringify(npc, null, 2));
    }
}
