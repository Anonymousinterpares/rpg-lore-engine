import { GameLoop } from '../combat/GameLoop';
import { GameState } from '../combat/GameStateManager';
import { WorldClockEngine } from '../combat/WorldClockEngine';

async function runTimeSimulation() {
    console.log('--- Phase 12: Time Management Verification ---');

    const initialState: GameState = {
        character: {
            name: 'Chronos',
            level: 1,
            race: 'Human',
            class: 'Fighter',
            stats: { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10 },
            savingThrowProficiencies: [],
            skillProficiencies: [],
            hp: { current: 10, max: 10, temp: 0 },
            hitDice: { current: 1, max: 1, dieType: '1d10' },
            spellSlots: {},
            cantripsKnown: [],
            knownSpells: [],
            preparedSpells: [],
            spellbook: [],
            ac: 10,
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items: [] },
            equipmentSlots: {},
            attunedItems: [],
            inspiration: false,
            deathSaves: { successes: 0, failures: 0 },
            biography: {
                background: 'Sage',
                traits: [], ideals: [], bonds: [], flaws: [],
                chronicles: []
            }
        },
        mode: 'EXPLORATION',
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: { days: 1, hours: 8, minutes: 0 },
        worldMap: { grid_id: 'test', hexes: {} },
        activeQuests: [],
        factions: [],
        settings: { difficulty: 'normal', ironman: false, adaptiveCombat: true, explorationDensity: 1.0, loreWeight: 1.0 },
        saveId: 'test-save-time',
        saveVersion: 1,
        createdAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        playTimeSeconds: 0,
        companions: [],
        subLocations: [],
        worldNpcs: [],
        storySummary: '',
        conversationHistory: [],
        triggeredEvents: []
    } as any;

    const loop = new GameLoop(initialState, '.');

    const reportTime = () => {
        const time = loop.getState().worldTime;
        console.log(`Current Time: ${WorldClockEngine.formatTime(time)}`);
    };

    reportTime();

    // 1. Test Movement (4 hours)
    console.log('\nAction: /move N');
    await loop.processTurn('/move N');
    reportTime();

    // 2. Test Short Rest (1 hour)
    console.log('\nAction: /rest');
    await loop.processTurn('/rest');
    reportTime();

    // 3. Test Long Rest (8 hours)
    console.log('\nAction: /rest long');
    await loop.processTurn('/rest long');
    reportTime();

    // 4. Test Rollover (Advance many hours)
    console.log('\nSimulating 3 days of travel...');
    for (let i = 0; i < 18; i++) { // 18 * 4 hours = 72 hours = 3 days
        await loop.processTurn('/move S');
        await loop.processTurn('/move N');
    }
    reportTime();

    console.log('\n--- Time Management Simulation Finished ---');
}

runTimeSimulation();
