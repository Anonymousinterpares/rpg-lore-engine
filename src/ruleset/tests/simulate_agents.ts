import { GameLoop } from '../combat/GameLoop';
import { GameState } from '../combat/GameStateManager';
import { FactionEngine } from '../combat/FactionEngine';

async function runAgentSimulation() {
    console.log('--- Phase 17: Agent Activation Verification ---\n');

    const initialState: GameState = {
        character: {
            name: 'Valerius',
            level: 3,
            race: 'Human',
            class: 'Paladin',
            stats: { 'STR': 16, 'DEX': 10, 'CON': 14, 'INT': 10, 'WIS': 12, 'CHA': 14 },
            hp: { current: 28, max: 28, temp: 0 },
            ac: 18,
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 }, items: [] },
            spellSlots: { "1": { current: 3, max: 3 } },
            cantripsKnown: [],
            knownSpells: ["Searing Smite"],
            preparedSpells: ["Searing Smite"],
            spellbook: [],
            equipmentSlots: {},
            attunedItems: [],
            xp: 0,
            inspiration: false,
            biography: { background: 'Noble', traits: [], ideals: [], bonds: [], flaws: [], chronicles: [] },
            savingThrowProficiencies: ["WIS", "CHA"],
            skillProficiencies: ["Persuasion", "Athletics"]
        },
        mode: 'EXPLORATION',
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: { hour: 10, day: 1, month: 1, year: 1489, totalTurns: 0 },
        storySummary: 'Starting your holy quest.',
        factions: []
    } as any;

    const loop = new GameLoop(initialState);
    const state = loop.getState();

    // 1. Initial Factions
    console.log('--- 1. Initial Factions ---');
    state.factions.forEach(f => {
        console.log(`- ${f.name}: ${f.standing} (${FactionEngine.getStandingLabel(f.standing)})`);
    });

    // 2. Faction Adjustment
    console.log('\n--- 2. Reputation Change ---');
    console.log(FactionEngine.adjustStanding(state, 'crown', 25));
    console.log(`New Crown Status: ${FactionEngine.getStandingLabel(state.factions.find(f => f.id === 'crown')!.standing)}`);

    // 3. StoryScribe Trigger (Every 20 turns)
    console.log('\n--- 3. StoryScribe (Simulating 20 turns) ---');
    for (let i = 0; i < 20; i++) {
        await loop.processTurn('I travel further north.');
    }

    // 4. Director Encounter Check
    console.log('\n--- 4. Encounter Director ---');
    // We'll simulate movement to trigger encounter check
    console.log('Force checking movement...');
    await loop.processTurn('/move N');

    console.log('\n--- Agent Simulation Finished ---');
}

runAgentSimulation();
