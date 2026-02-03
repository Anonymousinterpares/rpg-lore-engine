import * as fs from 'fs';
import * as path from 'path';
import { SubLocationSchema, WorldNPCSchema } from '../schemas/WorldEnrichmentSchema';
export class WorldEnrichmentManager {
    dataDir;
    constructor(basePath) {
        this.dataDir = path.join(basePath, 'data');
    }
    /**
     * Loads a SubLocation by its ID
     */
    loadSubLocation(id) {
        const filePath = path.join(this.dataDir, 'sub_locations', `${id}.json`);
        if (!fs.existsSync(filePath))
            return null;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return SubLocationSchema.parse(raw);
    }
    /**
     * Saves a SubLocation
     */
    saveSubLocation(subLocation) {
        const dir = path.join(this.dataDir, 'sub_locations');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${subLocation.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(subLocation, null, 2));
    }
    /**
     * Loads a WorldNPC by its ID
     */
    loadNPC(id) {
        const filePath = path.join(this.dataDir, 'npcs', `${id}.json`);
        if (!fs.existsSync(filePath))
            return null;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return WorldNPCSchema.parse(raw);
    }
    /**
     * Saves a WorldNPC
     */
    saveNPC(npc) {
        const dir = path.join(this.dataDir, 'npcs');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${npc.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(npc, null, 2));
    }
}
