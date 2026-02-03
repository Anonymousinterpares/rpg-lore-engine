import { DirectorAgent } from '../agents/AgentSwarm';
export class EncounterDirector {
    director = new DirectorAgent();
    encounterChance = 0.15; // 15% chance per turn/travel
    /**
     * Checks for a random encounter.
     */
    checkEncounter(state, hex) {
        if (state.mode !== 'EXPLORATION')
            return null;
        if (Math.random() < this.encounterChance) {
            return this.generateEncounter(hex.biome, state.character.level);
        }
        return null;
    }
    generateEncounter(biome, level) {
        // This would normally pull from data/encounters/
        return {
            name: `${biome} Ambush`,
            description: `A group of hostile creatures emerges from the ${biome.toLowerCase()}!`,
            monsters: ['Goblin', 'Goblin'], // Placeholder
            difficulty: level
        };
    }
}
