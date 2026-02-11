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

    private async loadRegistry(): Promise<SaveRegistry> {
        if (!(await this.storage.exists(this.registryPath))) {
            return { slots: [] };
        }
        const data = await this.storage.read(this.registryPath) as string;
        return JSON.parse(data);
    }

    public async saveGame(state: GameState, slotName?: string, narrativeSummary?: string, thumbnail?: string): Promise<void> {
        const registry = await this.loadRegistry();
        const saveFileName = `${state.saveId}.json`;
        const filePath = path.join(this.saveDir, saveFileName);

        await this.storage.write(filePath, JSON.stringify(state, null, 2));

        const existingIndex = registry.slots.findIndex((s: any) => s.id === state.saveId);

        // Determine the actual slot name to use
        let finalSlotName = slotName || 'Quick Save';

        // If no explicit name provided (or default), and it exists, preserve existing name
        if ((!slotName || slotName === 'Quick Save') && existingIndex >= 0) {
            finalSlotName = registry.slots[existingIndex].slotName;
        }

        const meta = {
            id: state.saveId,
            slotName: finalSlotName,
            characterName: state.character.name,
            characterLevel: state.character.level,
            characterClass: state.character.class,
            lastSaved: new Date().toISOString(),
            playTimeSeconds: state.playTimeSeconds || 0,
            locationSummary: `${state.location.hexId}${state.location.roomId ? ` / ${state.location.roomId}` : ''}`,
            narrativeSummary: narrativeSummary || (existingIndex >= 0 ? registry.slots[existingIndex].narrativeSummary : undefined),
            thumbnail: thumbnail
        };

        if (existingIndex >= 0) {
            registry.slots[existingIndex] = meta;
        } else {
            registry.slots.push(meta);
        }

        await this.storage.write(this.registryPath, JSON.stringify(registry, null, 2));
    }

    public async loadGame(saveId: string): Promise<GameState | null> {
        const filePath = path.join(this.saveDir, `${saveId}.json`);
        if (!(await this.storage.exists(filePath))) return null;

        const data = await this.storage.read(filePath) as string;
        return FullSaveStateSchema.parse(JSON.parse(data));
    }

    public async getSaveRegistry(): Promise<SaveRegistry> {
        return await this.loadRegistry();
    }

    public async deleteSave(saveId: string): Promise<boolean> {
        const registry = await this.loadRegistry();
        const saveIndex = registry.slots.findIndex((s: any) => s.id === saveId);

        if (saveIndex === -1) return false;

        registry.slots.splice(saveIndex, 1);
        await this.storage.write(this.registryPath, JSON.stringify(registry, null, 2));

        return true;
    }
}
