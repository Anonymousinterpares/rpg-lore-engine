import { FileStorageProvider } from './FileStorageProvider';
import * as path from 'path';
import { SubLocationSchema, WorldNPCSchema } from '../schemas/WorldEnrichmentSchema';
export class WorldEnrichmentManager {
    dataDir;
    storage;
    constructor(basePath, storage) {
        this.storage = storage || new FileStorageProvider();
        this.dataDir = path.join(basePath, 'data');
    }
    /**
     * Loads a SubLocation by its ID
     */
    loadSubLocation(id) {
        const filePath = path.join(this.dataDir, 'sub_locations', `${id}.json`);
        if (!this.storage.exists(filePath))
            return null;
        const raw = JSON.parse(this.storage.read(filePath));
        return SubLocationSchema.parse(raw);
    }
    /**
     * Saves a SubLocation
     */
    saveSubLocation(subLocation) {
        const dir = path.join(this.dataDir, 'sub_locations');
        this.storage.mkdir(dir);
        const filePath = path.join(dir, `${subLocation.id}.json`);
        this.storage.write(filePath, JSON.stringify(subLocation, null, 2));
    }
    /**
     * Loads a WorldNPC by its ID
     */
    loadNPC(id) {
        const filePath = path.join(this.dataDir, 'npcs', `${id}.json`);
        if (!this.storage.exists(filePath))
            return null;
        const raw = JSON.parse(this.storage.read(filePath));
        return WorldNPCSchema.parse(raw);
    }
    /**
     * Saves a WorldNPC
     */
    saveNPC(npc) {
        const dir = path.join(this.dataDir, 'npcs');
        this.storage.mkdir(dir);
        const filePath = path.join(dir, `${npc.id}.json`);
        this.storage.write(filePath, JSON.stringify(npc, null, 2));
    }
}
