import { GameState } from './GameStateManager';
import { HexMapManager } from './HexMapManager';
import { DirectorAgent } from '../agents/AgentSwarm';

export interface Encounter {
    name: string;
    description: string;
    monsters: string[]; // Monster IDs
    difficulty: number;
}

export class EncounterDirector {
    private director = new DirectorAgent();
    private encounterChance: number = 0.15; // 15% chance per turn/travel

    /**
     * Checks for a random encounter.
     */
    public checkEncounter(state: GameState, hex: any): Encounter | null {
        if (state.mode !== 'EXPLORATION') return null;

        if (Math.random() < this.encounterChance) {
            return this.generateEncounter(hex.biome, state.character.level);
        }
        return null;
    }

    private generateEncounter(biome: string, level: number): Encounter {
        // This would normally pull from data/encounters/
        return {
            name: `${biome} Ambush`,
            description: `A group of hostile creatures emerges from the ${biome.toLowerCase()}!`,
            monsters: ['Goblin', 'Goblin'], // Placeholder
            difficulty: level
        };
    }
}
