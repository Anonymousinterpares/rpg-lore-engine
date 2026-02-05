import { PlayerCharacterSchema } from '../schemas/PlayerCharacterSchema';
import { MechanicsEngine } from './MechanicsEngine';
import { DataManager } from '../data/DataManager';
export class CharacterCreationEngine {
    static POINT_BUY_COSTS = {
        8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
    };
    /**
     * Returns the Standard Array stats.
     */
    static getStandardArray() {
        return [15, 14, 13, 12, 10, 8];
    }
    /**
     * Generates stats using 4d6-drop-lowest method.
     */
    static rollStats() {
        const stats = [];
        for (let i = 0; i < 6; i++) {
            const rolls = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
            rolls.sort((a, b) => b - a); // Sort descending
            const sum = rolls[0] + rolls[1] + rolls[2]; // Sum top 3
            stats.push(sum);
        }
        return stats;
    }
    /**
     * Validates if a set of base stats (8-15) fits within the 27 point-buy budget.
     */
    static validatePointBuy(stats) {
        let totalCost = 0;
        for (const score of Object.values(stats)) {
            if (score < 8 || score > 15)
                return { valid: false, cost: -1 };
            totalCost += this.POINT_BUY_COSTS[score];
        }
        return { valid: totalCost <= 27, cost: totalCost };
    }
    /**
     * Assembles a level 1 PlayerCharacter based on creation choices.
     */
    static createCharacter(request) {
        const { valid, cost } = this.validatePointBuy(request.baseStats);
        if (!valid)
            throw new Error(`Invalid point-buy stats. Cost: ${cost}/27`);
        // 1. Initial Stats + Racial Bonuses
        const finalStats = { ...request.baseStats };
        for (const [stat, increase] of Object.entries(request.race.abilityScoreIncreases)) {
            finalStats[stat] += increase;
        }
        // 2. HP Calculation (Level 1: Max Hit Die + CON Mod)
        const hitDieValue = parseInt(request.classData.hitDie.replace('1d', ''));
        const conMod = MechanicsEngine.getModifier(finalStats['CON']);
        const maxHP = hitDieValue + conMod;
        // 3. Proficiencies (Class + Background)
        const skillProficiencies = Array.from(new Set([
            ...request.selectedSkills,
            ...request.background.skillProficiencies
        ]));
        // 4. Equipment Assembly
        const finalItems = [
            ...request.background.startingEquipment.map(i => {
                const itemData = DataManager.getItem(i.id);
                return {
                    id: i.id,
                    instanceId: crypto.randomUUID(), // Unique ID
                    name: itemData?.name || i.id.replace(/_/g, ' '),
                    type: itemData?.type || 'Misc',
                    weight: itemData?.weight || 1,
                    quantity: i.quantity,
                    equipped: false
                };
            })
            // Class equipment would go here
        ];
        // 5. Build the character object
        const pc = {
            name: request.name,
            level: 1,
            race: request.race.name,
            class: request.className,
            conditions: [],
            stats: finalStats,
            savingThrowProficiencies: request.classData.savingThrowProficiencies,
            skillProficiencies: skillProficiencies,
            hp: {
                current: maxHP,
                max: maxHP,
                temp: 0
            },
            hitDice: {
                current: 1,
                max: 1,
                dieType: request.classData.hitDie
            },
            spellSlots: {}, // To be populated if caster
            cantripsKnown: [],
            knownSpells: [],
            preparedSpells: [],
            spellbook: [],
            unseenSpells: DataManager.getSpellsByClass(request.className, 1).map(s => s.name),
            ac: 10 + MechanicsEngine.getModifier(finalStats['DEX']),
            inventory: {
                gold: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, // Background/Class might provide gold
                items: finalItems
            },
            equipmentSlots: {},
            attunedItems: [],
            xp: 0,
            inspiration: false,
            deathSaves: { successes: 0, failures: 0 },
            featureUsages: {},
            biography: {
                background: request.background.name,
                backgroundId: request.background.id,
                traits: request.personality?.traits || [],
                ideals: request.personality?.ideals || [],
                bonds: request.personality?.bonds || [],
                flaws: request.personality?.flaws || [],
                chronicles: [
                    { turn: 0, event: `${request.name} started their journey as a ${request.race.name} ${request.className}.` }
                ]
            }
        };
        return PlayerCharacterSchema.parse(pc);
    }
}
