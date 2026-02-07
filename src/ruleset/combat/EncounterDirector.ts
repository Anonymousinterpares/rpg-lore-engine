import { DirectorAgent } from '../agents/AgentSwarm';
import { DataManager } from '../data/DataManager';
import { GameState } from './GameStateManager';
import { MechanicsEngine } from './MechanicsEngine';

export interface Encounter {
    name: string;
    description: string;
    monsters: string[]; // Monster IDs
    difficulty: number;
    xpAward: number;
}

const XP_THRESHOLDS: Record<number, { easy: number, medium: number, hard: number, deadly: number }> = {
    1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
    2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
    3: { easy: 75, medium: 150, deadly: 400, hard: 225 },
    4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
    5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
    // Simplified for higher levels
};

export class EncounterDirector {
    private director = new DirectorAgent();
    private encounterChance: number = 0.15; // 15% chance per turn/travel

    /**
     * Checks for a random encounter.
     */
    public checkEncounter(state: GameState, hex: any): Encounter | null {
        if (state.mode !== 'EXPLORATION') return null;

        if (Math.random() < this.encounterChance) {
            const difficulty = state.settings?.gameplay?.difficulty || 'normal';
            return this.generateEncounter(hex.biome, state.character.level, difficulty as any);
        }
        return null;
    }

    private generateEncounter(biome: string, level: number, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): Encounter {
        const potentialMonsters = DataManager.getMonstersByBiome(biome);
        const thresholds = XP_THRESHOLDS[level] || { easy: level * 25, medium: level * 50, hard: level * 75, deadly: level * 100 };

        // Map UI difficulty to XP target
        const xpTarget = difficulty === 'easy' ? thresholds.easy :
            difficulty === 'hard' ? thresholds.hard :
                thresholds.medium;

        if (potentialMonsters.length === 0) {
            return {
                name: "Scouting Party",
                description: `A group of sneaky Goblins ambushes you!`,
                monsters: ['Goblin', 'Goblin'],
                difficulty: 0.25 * 2,
                xpAward: 100
            };
        }

        // 1. Pick a base monster from the biome
        // Filter out monsters that are "Deadly" solo if we want a balanced encounter
        const validBasics = potentialMonsters.filter(m => MechanicsEngine.getCRtoXP(m.cr) <= xpTarget);
        const baseMonsterInfo = validBasics.length > 0
            ? validBasics[Math.floor(Math.random() * validBasics.length)]
            : potentialMonsters.sort((a, b) => a.cr - b.cr)[0];

        const monsterXP = MechanicsEngine.getCRtoXP(baseMonsterInfo.cr);

        // 2. Determine how many we can fit in the budget (Adjusted XP)
        let count = 1;
        let adjustedXP = monsterXP;

        while (count < 8) { // Cap at 8 for standard encounters
            const nextCount = count + 1;
            const nextAdjusted = this.calculateAdjustedXP(monsterXP, nextCount);
            if (nextAdjusted <= xpTarget * 1.2) { // Allow 20% slack
                count = nextCount;
                adjustedXP = nextAdjusted;
            } else {
                break;
            }
        }

        const monsterList = Array(count).fill(baseMonsterInfo.id);
        const monsterName = baseMonsterInfo.id.replace(/_/g, ' ');
        const encounterName = count > 1 ? `Pack of ${monsterName}s` : `Lone ${monsterName}`;

        return {
            name: encounterName,
            description: `A ${encounterName.toLowerCase()} emerging from the ${biome.toLowerCase()} blocks your path!`,
            monsters: monsterList,
            difficulty: baseMonsterInfo.cr * count,
            xpAward: monsterXP * count
        };
    }

    private calculateAdjustedXP(baseXP: number, count: number): number {
        const totalRaw = baseXP * count;
        let multiplier = 1.0;
        if (count === 2) multiplier = 1.5;
        else if (count >= 3 && count <= 6) multiplier = 2.0;
        else if (count >= 7 && count <= 10) multiplier = 2.5;
        else if (count >= 11 && count <= 14) multiplier = 3.0;
        else if (count >= 15) multiplier = 4.0;

        return totalRaw * multiplier;
    }
}
