import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { GameState } from '../combat/GameStateManager';
import { HexGenerator } from '../combat/HexGenerator';
import { BiomeGenerationEngine } from '../combat/BiomeGenerationEngine';
import { GatheringEngine } from '../combat/GatheringEngine';
import { DowntimeEngine } from '../combat/DowntimeEngine';
import { QuestParser } from '../combat/QuestParser';
import { BiomeType } from '../schemas/BiomeSchema';

async function runExpansionSimulation() {
    console.log('--- Phase 18 Expansion: World & Logic Verification ---\n');

    // 1. Biome Generation Test
    console.log('--- 1. Biome Generation (Adjacency & Clusters) ---');
    const clusterSizes: any = {
        'Plains': 0, 'Forest': 7, 'Hills': 0, 'Mountains': 0, 'Swamp': 0,
        'Desert': 0, 'Tundra': 0, 'Jungle': 0, 'Coast': 0, 'Ocean': 0,
        'Volcanic': 0, 'Ruins': 0, 'Farmland': 0, 'Urban': 0,
        'Coast_Cold': 0, 'Coast_Desert': 0, 'Mountain_High': 0
    };
    const neighbors: any[] = [{ biome: 'Forest' }, { biome: 'Forest' }];

    console.log('Simulating 10 hex generation rolls next to Forest cluster (size 7):');
    for (let i = 0; i < 10; i++) {
        const result = BiomeGenerationEngine.selectBiome([0, 0], []);
        process.stdout.write(`${result.biome} `);
    }
    console.log('\n(Expect higher chance of Forest, but penalty if size reaches 8)\n');

    // 2. Gathering Test
    console.log('--- 2. Gathering Engine ---');
    const pc: PlayerCharacter = {
        name: 'Grom',
        stats: { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 14, 'CHA': 10 },
        inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, items: [] },
        xp: 0,
        level: 1,
        race: 'Orc',
        class: 'Druid',
        hp: { current: 10, max: 10, temp: 0 },
        ac: 12,
        hitDice: { current: 1, max: 1, dieType: '1d8' },
        skillProficiencies: ['Nature'],
        savingThrowProficiencies: ['WIS', 'INT'],
        biography: { chronicles: [] },
        deathSaves: { successes: 0, failures: 0 }
    } as any;

    const { hex } = HexGenerator.generateHex([0, 0], neighbors, clusterSizes);
    hex.biome = 'Forest';
    hex.resourceNodes = [
        { id: 'node_1', resourceType: 'Herb', itemId: 'herb_silverleaf', quantityRemaining: 2, respawnDays: 7, skillCheck: { skill: 'Nature', dc: 5 } }
    ];

    console.log(`Hex biome: ${hex.biome}. Seeking node_1...`);
    const gatherResult = GatheringEngine.gather(pc, hex as any, 'node_1');
    console.log(gatherResult.message);
    console.log('Inventory:', JSON.stringify(pc.inventory.items));

    // 3. Crafting Test
    console.log('\n--- 3. Crafting Engine (Recipes) ---');
    // Give materials for a potion
    pc.inventory.items.push({
        id: 'herb_bogbean',
        instanceId: 'bog_01',
        name: 'herb bogbean',
        type: 'Misc',
        quantity: 1,
        weight: 0.1,
        equipped: false
    });
    console.log('Crafting Potion of Healing (needs silverleaf + bogbean)...');
    const craftResult = DowntimeEngine.craft(pc, 'recipe_potion_healing');
    console.log(craftResult.message);
    console.log('Inventory after craft:', JSON.stringify(pc.inventory.items));

    // 4. Quest ICP Test
    console.log('\n--- 4. Quest ICP (Tag Parsing) ---');
    const state: GameState = {
        character: pc,
        activeQuests: [],
        factions: [],
        codexEntries: [],
        location: { hexId: '0,0', coordinates: [0, 0], droppedItems: [] },
        worldTime: { days: 1, hours: 12, minutes: 0 },
        worldMap: { grid_id: 'test', hexes: {} },
        settings: { difficulty: 'normal', ironman: false, adaptiveCombat: true, explorationDensity: 1.0, loreWeight: 1.0 },
        saveId: 'test-expansion',
        saveVersion: 1,
        createdAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        playTimeSeconds: 0,
        companions: [],
        subLocations: [],
        worldNpcs: [],
        storySummary: 'Grom is gathering herbs.',
        conversationHistory: [],
        triggeredEvents: []
    } as any;

    const narrativeOutput = `
    The priest looks at the potion. "Excellent work!" 
    !!QUEST_START: {"id": "priest_favor", "title": "Priest's Favor", "description": "Help the village priest.", "objectives": [{"id": "heal_sick", "description": "Heal the sick boy.", "maxProgress": 1}], "rewards": {"xp": 500}} !!
    !!QUEST_UPDATE: {"questId": "priest_favor", "objectiveId": "heal_sick", "progress": 1} !!
    `;

    console.log('Parsing LLM Narrative Output...');
    const questLogs = QuestParser.parseAndApply(narrativeOutput, state);
    questLogs.forEach(log => console.log(`> ${log}`));
    console.log('Active Quests:', JSON.stringify(state.activeQuests));

    console.log('\n--- Expansion Simulation Finished ---');
}

runExpansionSimulation();
