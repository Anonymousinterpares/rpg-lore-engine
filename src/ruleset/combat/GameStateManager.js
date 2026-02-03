import * as fs from 'fs';
import * as path from 'path';
import { FullSaveStateSchema } from '../schemas/FullSaveStateSchema';
import { SaveRegistrySchema } from '../schemas/SaveRegistrySchema';
export class GameStateManager {
    saveDir;
    registryPath;
    constructor(basePath) {
        this.saveDir = path.join(basePath, 'data', 'saves');
        this.registryPath = path.join(this.saveDir, 'registry.json');
        if (!fs.existsSync(this.saveDir)) {
            fs.mkdirSync(this.saveDir, { recursive: true });
        }
        if (!fs.existsSync(this.registryPath)) {
            this.writeRegistry({ slots: [] });
        }
    }
    readRegistry() {
        const raw = fs.readFileSync(this.registryPath, 'utf-8');
        return SaveRegistrySchema.parse(JSON.parse(raw));
    }
    writeRegistry(registry) {
        fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
    }
    /**
     * Lists all available save slots
     */
    listSaves() {
        return this.readRegistry().slots;
    }
    /**
     * Saves the current game state to a JSON file and updates the registry
     */
    saveGame(state, slotName = 'Quick Save') {
        // 1. Validate state
        FullSaveStateSchema.parse(state);
        // 2. Save state file
        const fileName = `${state.saveId}.json`;
        const filePath = path.join(this.saveDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
        // 3. Update registry
        const registry = this.readRegistry();
        const existingIndex = registry.slots.findIndex(s => s.id === state.saveId);
        const metadata = {
            id: state.saveId,
            slotName: slotName,
            characterName: state.character.name,
            characterLevel: state.character.level,
            characterClass: state.character.class,
            lastSaved: new Date().toISOString(),
            playTimeSeconds: state.playTimeSeconds || 0,
            locationSummary: `${state.location.hexId}${state.location.roomId ? ` / ${state.location.roomId}` : ''}`
        };
        if (existingIndex >= 0) {
            registry.slots[existingIndex] = metadata;
        }
        else {
            registry.slots.push(metadata);
        }
        this.writeRegistry(registry);
        console.log(`Game saved: ${metadata.slotName} (${state.saveId})`);
    }
    /**
     * Loads a game state from a JSON file
     */
    loadGame(saveId) {
        const filePath = path.join(this.saveDir, `${saveId}.json`);
        if (!fs.existsSync(filePath))
            return null;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return FullSaveStateSchema.parse(raw);
    }
    /**
     * Deletes a save slot
     */
    deleteSave(saveId) {
        const filePath = path.join(this.saveDir, `${saveId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        const registry = this.readRegistry();
        registry.slots = registry.slots.filter(s => s.id !== saveId);
        this.writeRegistry(registry);
    }
}
