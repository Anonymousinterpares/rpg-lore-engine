import { FullSaveStateSchema } from '../schemas/FullSaveStateSchema';
import { FileStorageProvider } from './FileStorageProvider';
import * as path from 'path';
export class GameStateManager {
    saveDir;
    registryPath;
    storage;
    constructor(basePath, storage) {
        this.storage = storage || new FileStorageProvider();
        this.saveDir = path.join(basePath, 'saves');
        this.registryPath = path.join(this.saveDir, 'save_registry.json');
    }
    loadRegistry() {
        if (!this.storage.exists(this.registryPath)) {
            return { slots: [] };
        }
        const data = this.storage.read(this.registryPath);
        return JSON.parse(data);
    }
    saveGame(state, slotName = 'Quick Save') {
        const registry = this.loadRegistry();
        const saveFileName = `${state.saveId}.json`;
        const filePath = path.join(this.saveDir, saveFileName);
        this.storage.write(filePath, JSON.stringify(state, null, 2));
        const existingIndex = registry.slots.findIndex((s) => s.id === state.saveId);
        const meta = {
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
            registry.slots[existingIndex] = meta;
        }
        else {
            registry.slots.push(meta);
        }
        this.storage.write(this.registryPath, JSON.stringify(registry, null, 2));
    }
    loadGame(saveId) {
        const filePath = path.join(this.saveDir, `${saveId}.json`);
        if (!this.storage.exists(filePath))
            return null;
        const data = this.storage.read(filePath);
        return FullSaveStateSchema.parse(JSON.parse(data));
    }
    getSaveRegistry() {
        return this.loadRegistry();
    }
    deleteSave(saveId) {
        const registry = this.loadRegistry();
        const saveIndex = registry.slots.findIndex((s) => s.id === saveId);
        if (saveIndex === -1)
            return false;
        registry.slots.splice(saveIndex, 1);
        this.storage.write(this.registryPath, JSON.stringify(registry, null, 2));
        // Note: Real file deletion would need storage.delete() if we added it.
        // For now, removing from registry makes it "gone" in UI.
        return true;
    }
}
