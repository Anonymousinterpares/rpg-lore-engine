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
    public async loadSubLocation(id: string): Promise<SubLocation | null> {
        const filePath = path.join(this.dataDir, 'sub_locations', `${id}.json`);
        if (!(await this.storage.exists(filePath))) return null;

        const raw = JSON.parse(await this.storage.read(filePath) as string);
        return SubLocationSchema.parse(raw);
    }

    /**
     * Saves a SubLocation
     */
    public async saveSubLocation(subLocation: SubLocation): Promise<void> {
        const dir = path.join(this.dataDir, 'sub_locations');
        await this.storage.mkdir(dir);

        const filePath = path.join(dir, `${subLocation.id}.json`);
        await this.storage.write(filePath, JSON.stringify(subLocation, null, 2));
    }

    /**
     * Loads a WorldNPC by its ID
     */
    public async loadNPC(id: string): Promise<WorldNPC | null> {
        const filePath = path.join(this.dataDir, 'npcs', `${id}.json`);
        if (!(await this.storage.exists(filePath))) return null;

        const raw = JSON.parse(await this.storage.read(filePath) as string);
        return WorldNPCSchema.parse(raw);
    }

    /**
     * Saves a WorldNPC
     */
    public async saveNPC(npc: WorldNPC): Promise<void> {
        const dir = path.join(this.dataDir, 'npcs');
        await this.storage.mkdir(dir);

        const filePath = path.join(dir, `${npc.id}.json`);
        await this.storage.write(filePath, JSON.stringify(npc, null, 2));
    }
}
