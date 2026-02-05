import { GameState } from '../schemas/FullSaveStateSchema';
import { Race } from '../schemas/RaceSchema';
import { CharacterClass } from '../schemas/ClassSchema';
import { Background } from '../schemas/BackgroundSchema';
import { v4 as uuidv4 } from 'uuid';
import { DataManager } from '../data/DataManager';
import { HexGenerator } from '../combat/HexGenerator';
import { HexMapManager } from '../combat/HexMapManager';
import { BiomePoolManager } from '../combat/BiomeRegistry';
import { BiomeType } from '../schemas/BiomeSchema';

export interface CharacterCreationOptions {
    name: string;
    race: Race;
    characterClass: CharacterClass;
    background: Background;
    abilityScores: { [key: string]: number }; // STR, DEX, etc.
    skillProficiencies: string[];
    selectedCantrips?: string[];
    selectedSpells?: string[];
}

export class CharacterFactory {
    public static createNewGameState(options: CharacterCreationOptions): GameState {
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

        // Initialize Spellcasting Defaults
        let cantrips: string[] = options.selectedCantrips || [];
        let spells: string[] = options.selectedSpells || [];
        let spellbook: string[] = [];

        // Special logic for Wizard Spellbook (they choose 6 for spellbook, but don't "know" them)
        if (options.characterClass.name === 'Wizard') {
            spellbook = [...spells];
            spells = []; // Wizards don't have "Known Spells" beyond cantrips
        }

        // Fallback for hardcoded classes if no selection was made (though UI should prevent this)
        if (cantrips.length === 0) {
            if (characterClass.name === 'Wizard') cantrips = ['Fire Bolt', 'Mage Hand', 'Light'];
            else if (characterClass.name === 'Sorcerer') cantrips = ['Fire Bolt', 'Light', 'Ray of Frost', 'Shocking Grasp'];
            else if (characterClass.name === 'Warlock') cantrips = ['Eldritch Blast', 'Mage Hand'];
            else if (characterClass.name === 'Cleric') cantrips = ['Sacred Flame', 'Guidance', 'Light'];
            else if (characterClass.name === 'Druid') cantrips = ['Druidcraft', 'Guidance', 'Produce Flame'];
            else if (characterClass.name === 'Bard') cantrips = ['Vicious Mockery', 'Light'];
        }

        if (spells.length === 0 && spellbook.length === 0) {
            if (characterClass.name === 'Wizard') {
                spellbook = ['Magic Missile', 'Shield', 'Sleep', 'Mage Armor', 'Burning Hands', 'Detect Magic'];
            } else if (characterClass.name === 'Sorcerer') {
                spells = ['Magic Missile', 'Shield'];
            } else if (characterClass.name === 'Warlock') {
                spells = ['Hellish Rebuke', 'Charm Person'];
            } else if (characterClass.name === 'Bard') {
                spells = ['Cure Wounds', 'Healing Word', 'Thunderwave', 'Charm Person'];
            }
        }

        // Always-Prepared classes: Synchronize preparedSpells with knownSpells
        // Cantrips are ALWAYS "prepared" (available to cast)
        const knownCasters = ['Sorcerer', 'Warlock', 'Bard', 'Ranger'];
        const preparedSpells = [...cantrips];
        if (knownCasters.includes(characterClass.name)) {
            preparedSpells.push(...spells);
        }

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
                skillProficiencies: skillProficiencies as any,
                hp: { current: maxHp, max: maxHp, temp: 0 },
                deathSaves: { successes: 0, failures: 0 },
                hitDice: { current: 1, max: 1, dieType: characterClass.hitDie },
                spellSlots: {},
                featureUsages: (() => {
                    const usages: any = {};
                    characterClass.allFeatures.forEach(feat => {
                        if (feat.level <= 1 && feat.usage && feat.usage.type !== 'PASSIVE') {
                            usages[feat.name] = {
                                current: feat.usage.limit || 0,
                                max: feat.usage.limit || 0,
                                usageType: feat.usage.type
                            };
                        }
                    });
                    return usages;
                })(),
                cantripsKnown: cantrips,
                knownSpells: spells,
                preparedSpells: preparedSpells,
                spellbook: spellbook,
                unseenSpells: DataManager.getSpellsByClass(characterClass.name, 1).map(s => s.name),
                ac: 10 + Math.floor((finalStats['DEX'] - 10) / 2),
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
            worldTime: { day: 1, hour: 9, month: 1, year: 1489, totalTurns: 0 },
            worldMap: (() => {
                const pool = new BiomePoolManager();
                const emptySizes = { 'Plains': 0, 'Forest': 0, 'Hills': 0, 'Mountains': 0, 'Swamp': 0, 'Desert': 0, 'Tundra': 0, 'Jungle': 0, 'Coast': 0, 'Ocean': 0, 'Volcanic': 0, 'Ruins': 0, 'Farmland': 0, 'Urban': 0 };
                const startHex = HexGenerator.generateHex([0, 0], [], emptySizes, pool);
                startHex.visited = true;
                startHex.name = "Initial Landing Site";
                startHex.biome = "Plains";

                const hexes: { [key: string]: any } = { '0,0': startHex };

                const directions: any[] = ['N', 'S', 'NE', 'NW', 'SE', 'SW'];
                directions.forEach(dir => {
                    const coords = HexMapManager.getNewCoords([0, 0], dir);
                    const key = `${coords[0]},${coords[1]}`;
                    const neighbor = HexGenerator.generateHex(coords, [{ biome: 'Plains' }], emptySizes, pool);
                    neighbor.visited = false;
                    neighbor.name = 'Uncharted Territory';
                    hexes[key] = neighbor;
                });
                return {
                    grid_id: 'world_map',
                    hexes,
                    discoveredHexIds: ['0,0'],
                    lastGeneratedTurn: 0
                };
            })(),
            subLocations: [],
            worldNpcs: [],
            activeQuests: [
                {
                    id: 'tutorial_01',
                    title: 'The First Step',
                    description: 'You awake in a strange clearing. The air is fresh, but the silence is heavy. You must get your bearings.',
                    status: 'ACTIVE',
                    isNew: true,
                    objectives: [
                        { id: 'obj_master_booklet', description: 'Master the Booklet: View all pages (Character, Map, Quests, Equipment, Codex)', isCompleted: false, currentProgress: 0, maxProgress: 5 },
                        { id: 'obj_study_gear', description: 'Study Your Gear: Examine an item in your inventory', isCompleted: false, currentProgress: 0, maxProgress: 1 },
                        { id: 'obj_begin_journey', description: 'Begin the Journey: Move to a neighboring hex', isCompleted: false, currentProgress: 0, maxProgress: 1 }
                    ],
                    rewards: {
                        xp: 50,
                        gold: { gp: 10, sp: 0, cp: 0, ep: 0, pp: 0 },
                        items: []
                    }
                }
            ],
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
