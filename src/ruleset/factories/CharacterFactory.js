import { v4 as uuidv4 } from 'uuid';
import { DataManager } from '../data/DataManager';
export class CharacterFactory {
    static createNewGameState(options) {
        const { name, race, characterClass, background, abilityScores, skillProficiencies } = options;
        // Apply Racial Bonuses to Ability Scores
        const finalStats = { ...abilityScores };
        for (const [stat, bonus] of Object.entries(race.abilityScoreIncreases)) {
            if (finalStats[stat] !== undefined) {
                finalStats[stat] += bonus;
            }
        }
        // Calculate HP
        // Level 1: Max Hit Die + CON Modifier
        const conMod = Math.floor((finalStats['CON'] - 10) / 2);
        const hitDieValue = parseInt(characterClass.hitDie.replace('1d', ''));
        const maxHp = hitDieValue + conMod;
        // Initial Inventory from Background
        // Lookup actual item data to get Name, Weight, etc.
        const inventoryItems = background.startingEquipment.map(eq => {
            const itemData = DataManager.getItem(eq.id);
            // Fallback for missing items (shouldn't happen with full data)
            const name = itemData?.name || eq.id;
            const weight = itemData?.weight || 0;
            return {
                name: name,
                id: eq.id,
                type: itemData?.type || 'Misc',
                weight: weight,
                quantity: eq.quantity,
                equipped: false,
                instanceId: uuidv4()
            };
        });
        const now = new Date().toISOString();
        return {
            saveId: uuidv4(),
            saveVersion: 1,
            createdAt: now,
            lastSavedAt: now,
            playTimeSeconds: 0,
            character: {
                name: name,
                level: 1,
                race: race.name,
                class: characterClass.name,
                conditions: [],
                stats: finalStats,
                savingThrowProficiencies: characterClass.savingThrowProficiencies,
                // Combine skill proficiencies from Class (would need user selection, simplified here to take first 2 for automation or need UI pass-in)
                // For this factory, we assume the UI handles specific skill choices, 
                // BUT if we are simplifying, we'll take Background skills + 2 random class skills?
                // Let's take Background skills for sure.
                skillProficiencies: skillProficiencies,
                hp: { current: maxHp, max: maxHp, temp: 0 },
                deathSaves: { successes: 0, failures: 0 },
                hitDice: { current: 1, max: 1, dieType: characterClass.hitDie },
                spellSlots: {}, // To be calculated based on class
                cantripsKnown: [],
                knownSpells: [],
                preparedSpells: [],
                spellbook: [],
                ac: 10 + Math.floor((finalStats['DEX'] - 10) / 2), // Basic AC, armor needs equipping logic
                inventory: {
                    gold: { cp: 0, sp: 0, ep: 0, gp: background.startingGold || 0, pp: 0 },
                    items: inventoryItems
                },
                equipmentSlots: {},
                attunedItems: [],
                xp: 0,
                inspiration: false,
                biography: {
                    background: background.name,
                    traits: background.personalitySuggested?.traits || [],
                    ideals: background.personalitySuggested?.ideals || [],
                    bonds: background.personalitySuggested?.bonds || [],
                    flaws: background.personalitySuggested?.flaws || [],
                    chronicles: [
                        { turn: 0, event: "The adventure begins." }
                    ]
                }
            },
            companions: [],
            mode: 'EXPLORATION',
            location: {
                hexId: '0,0',
                coordinates: [0, 0],
                droppedItems: []
            },
            worldTime: { day: 1, hour: 8, month: 1, year: 1489, totalTurns: 0 },
            worldMap: {
                grid_id: 'world_map',
                hexes: {}
            },
            subLocations: [],
            worldNpcs: [],
            activeQuests: [],
            factions: [],
            storySummary: `started their journey as a ${race.name} ${characterClass.name} with the ${background.name} background.`,
            conversationHistory: [],
            triggeredEvents: [],
            settings: {
                permadeath: false,
                variantEncumbrance: false,
                milestoneLeveling: false,
                criticalFumbleEffects: false,
                difficultyModifier: 1.0,
                inspirationEnabled: true,
                multiclassingAllowed: true,
                maxConversationHistoryTurns: 50
            }
        };
    }
}
