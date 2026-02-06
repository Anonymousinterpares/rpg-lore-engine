import { DirectorAgent } from '../agents/AgentSwarm';
import { DataManager } from '../data/DataManager';
import { GameState } from './GameStateManager';

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
        const potentialMonsters = DataManager.getMonstersByBiome(biome);

        if (potentialMonsters.length === 0) {
            // Fallback to Goblins if biome has no mapping yet
            return {
                name: "Scouting Party",
                description: `A group of sneaky Goblins ambushes you!`,
                monsters: ['Goblin', 'Goblin'],
                difficulty: level
            };
        }

        // Filter by CR. Level 1 can handle CR 0 to 0.5 easily.
        // We'll pick a "Budget" based on level. 
        // Simple formula: Budget = Level * 1.5
        const crBudget = Math.max(0.5, level * 1.25);
        const validMonsters = potentialMonsters.filter(m => m.cr <= crBudget);

        if (validMonsters.length === 0) {
            // Pick the weakest one if budget is too low
            const weakest = potentialMonsters.sort((a, b) => a.cr - b.cr)[0];
            return {
                name: `${weakest.id} Sighting`,
                description: `You encounter a lone ${weakest.id.replace(/_/g, ' ')}!`,
                monsters: [weakest.id],
                difficulty: weakest.cr
            };
        }

        // Pick 1-3 monsters randomly from the valid list
        // For now, let's keep it simple: Pick one type and spawn 1-3 of it if budget allows
        const baseMonster = validMonsters[Math.floor(Math.random() * validMonsters.length)];
        let count = 1;
        if (baseMonster.cr > 0) {
            count = Math.min(3, Math.floor(crBudget / Math.max(0.125, baseMonster.cr)));
        } else {
            count = 4; // Swarm of CR 0
        }

        // Final sanity check for count
        count = Math.max(1, count);

        const monsterList = Array(count).fill(baseMonster.id);
        const monsterName = baseMonster.id.replace(/_/g, ' ');
        const encounterName = count > 1 ? `Pack of ${monsterName}s` : `Lone ${monsterName}`;

        return {
            name: encounterName,
            description: `A ${encounterName.toLowerCase()} emerging from the ${biome.toLowerCase()} blocks your path!`,
            monsters: monsterList,
            difficulty: baseMonster.cr * count
        };
    }
}
