import { FullSaveStateSchema, GameState } from '../schemas/FullSaveStateSchema';
import { SaveRegistrySchema, SaveRegistry } from '../schemas/SaveRegistrySchema';
import { IStorageProvider } from './IStorageProvider';
import { FileStorageProvider } from './FileStorageProvider';
import * as path from 'path';

export type { GameState };

export class GameStateManager {
    private saveDir: string;
    private registryPath: string;
    private storage: IStorageProvider;

    constructor(basePath: string, storage?: IStorageProvider) {
        this.storage = storage || new FileStorageProvider();
        this.saveDir = path.join(basePath, 'saves');
        this.registryPath = path.join(this.saveDir, 'save_registry.json');
    }

    private loadRegistry(): SaveRegistry {
        if (!this.storage.exists(this.registryPath)) {
            return { slots: [] };
        }
        const data = this.storage.read(this.registryPath) as string;
        return JSON.parse(data);
    }

    public saveGame(state: GameState, slotName: string = 'Quick Save') {
        const registry = this.loadRegistry();
        const saveFileName = `${state.saveId}.json`;
        const filePath = path.join(this.saveDir, saveFileName);

        this.storage.write(filePath, JSON.stringify(state, null, 2));

        const existingIndex = registry.slots.findIndex((s: any) => s.id === state.saveId);
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
        } else {
            registry.slots.push(meta);
        }

        this.storage.write(this.registryPath, JSON.stringify(registry, null, 2));
    }

    public loadGame(saveId: string): GameState | null {
        const filePath = path.join(this.saveDir, `${saveId}.json`);
        if (!this.storage.exists(filePath)) return null;

        const data = this.storage.read(filePath) as string;
        return FullSaveStateSchema.parse(JSON.parse(data));
    }

    public getSaveRegistry(): SaveRegistry {
        return this.loadRegistry();
    }

    public deleteSave(saveId: string): boolean {
        const registry = this.loadRegistry();
        const saveIndex = registry.slots.findIndex((s: any) => s.id === saveId);

        if (saveIndex === -1) return false;

        registry.slots.splice(saveIndex, 1);
        this.storage.write(this.registryPath, JSON.stringify(registry, null, 2));

        // Note: Real file deletion would need storage.delete() if we added it.
        // For now, removing from registry makes it "gone" in UI.
        return true;
    }
}
