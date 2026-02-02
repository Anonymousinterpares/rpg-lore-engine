import * as fs from 'fs';
import * as path from 'path';
import { PlayerCharacter, PlayerCharacterSchema } from '../schemas/PlayerCharacterSchema';
import { WorldClock } from '../schemas/WorldClockSchema';

export type GameMode = 'EXPLORATION' | 'SUB_LOCATION' | 'COMBAT' | 'DIALOGUE' | 'REST' | 'SHOP' | 'CHARACTER_CREATION';

export interface GameState {
    character: PlayerCharacter;
    mode: GameMode;
    location: {
        hexId: string;
        coordinates: [number, number];
        subLocationId?: string | null;
        roomId?: string | null;
    };
    worldTime: WorldClock;
    storySummary: string;
}

export class GameStateManager {
    private saveDir: string;

    constructor(basePath: string) {
        this.saveDir = path.join(basePath, 'data', 'saves');
        if (!fs.existsSync(this.saveDir)) {
            fs.mkdirSync(this.saveDir, { recursive: true });
        }
    }

    /**
     * Saves the current game state to a JSON file
     */
    public saveGame(state: GameState, slotName: string = 'autosave') {
        const filePath = path.join(this.saveDir, `${slotName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
        console.log(`Game saved to ${filePath}`);
    }

    /**
     * Loads a game state from a JSON file
     */
    public loadGame(slotName: string = 'autosave'): GameState | null {
        const filePath = path.join(this.saveDir, `${slotName}.json`);
        if (!fs.existsSync(filePath)) return null;

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // We could validate with Zod here if we want strict safety
        return raw as GameState;
    }
}
