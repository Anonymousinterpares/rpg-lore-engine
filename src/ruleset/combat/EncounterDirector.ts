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
    private baseChance: number = 0.05; // 5% base chance per 30 min interval

    private BIOME_MULTIPLIERS: Record<string, number> = {
        'Urban': 0.5,
        'Farmland': 0.5,
        'Plains': 1.0,
        'Forest': 1.1,
        'Hills': 1.1,
        'Coast': 1.0,
        'Swamp': 2.0,
        'Mountain': 1.8,
        'Desert': 1.5,
        'Tundra': 1.5,
        'Jungle': 2.2,
        'Volcanic': 3.0,
        'Ruins': 3.0,
        'Ocean': 1.5
    };

    /**
     * Checks for a random encounter.
     */
    public checkEncounter(state: GameState, hex: any, isResting: boolean = false, travelType: 'Road' | 'Path' | 'Ancient' | 'Stealth' | 'Wilderness' = 'Wilderness'): Encounter | null {
        if (state.mode !== 'EXPLORATION') return null;

        const baseChance = this.calculateFinalProbability(state, hex, isResting);

        // Infrastructure Safety Factor (§4.3)
        let infraMultiplier = 1.0;
        if (travelType === 'Road') infraMultiplier = 0.3;
        else if (travelType === 'Path') infraMultiplier = 0.7;
        else if (travelType === 'Ancient') infraMultiplier = 0.1; // Magical safety!

        const chance = baseChance * infraMultiplier;

        if (Math.random() < chance) {
            const difficulty = state.settings?.gameplay?.difficulty || 'normal';
            return this.generateEncounter(hex.biome, state.character.level, difficulty as any);
        }
        return null;
    }

    /**
     * Calculates the final probability P_encounter
     */
    public calculateFinalProbability(state: GameState, hex: any, isResting: boolean = false): number {
        const mBiome = this.BIOME_MULTIPLIERS[hex.biome] || 1.0;

        // Time Multiplier: Night = 2x
        const hour = state.worldTime.hour;
        const mTime = (hour < 6 || hour > 20) ? 2.0 : 1.0;

        // Activity Multiplier: Slow = 0.5x, Normal = 1.0x, Fast = 1.5x
        const activity = state.travelPace || 'Normal';
        const mActivity = activity === 'Slow' ? 0.5 : activity === 'Fast' ? 1.5 : 1.0;

        // Weather Multiplier (Storm/Blizzard increase danger/obscuration)
        let mWeather = 1.0;
        if (state.weather.type === 'Storm') mWeather = 1.2;
        if (state.weather.type === 'Blizzard') mWeather = 1.5;

        // Rest Multiplier: Being stationary and vulnerable
        let mRest = isResting ? 1.5 : 1.0;

        // Cleared Hex Modifier
        let pCleared = 0;
        if (state.clearedHexes && state.clearedHexes[hex.id]) {
            const lastCleared = state.clearedHexes[hex.id];
            const currentTime = state.worldTime.totalTurns; // turns as proxy
            // If cleared in last 4 hours (2400 turns given 10 turns = 1 min? No, 10 turns = 1 min is 6s each.
            // 4 hours = 240 mins = 2400 turns.
            if (currentTime - lastCleared < 2400) {
                pCleared = 0.9; // 90% reduction
            }
        }

        let pRaw = (this.baseChance * mBiome * mTime * mActivity * mWeather * mRest);

        // Apply reduction
        if (pCleared > 0) {
            pRaw *= (1 - pCleared);
        }

        return pRaw;
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
