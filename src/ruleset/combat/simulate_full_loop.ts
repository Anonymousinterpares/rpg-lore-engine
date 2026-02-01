import { GameLoop } from './GameLoop';
import { GameState } from './GameStateManager';

async function runFullLoopSimulation() {
    console.log('--- Phase 9: Full Game Loop & Persistence Verification ---');

    const initialState: GameState = {
        character: {
            name: 'Durin Strongbeard',
            level: 2,
            race: 'Dwarf',
            class: 'Fighter',
            stats: { 'STR': 17, 'DEX': 12, 'CON': 15, 'INT': 8, 'WIS': 10, 'CHA': 12 },
            hp: { current: 12, max: 22, temp: 0 },
            hitDice: { current: 0, max: 2, dieType: '1d10' },
            spellSlots: {},
            ac: 16,
            inventory: { gold: 10, items: [] },
            xp: 300,
            inspiration: false,
            biography: { chronicles: [] }
        },
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: 0,
        storySummary: 'Starting a new adventure.'
    };

    const loop = new GameLoop(initialState);

    // 1. Narrative Turn
    console.log('\n[Turn 1] Narrative Input: "I cautiously enter the cave."');
    const out1 = await loop.processTurn('I cautiously enter the cave.');
    console.log(out1);

    // 2. Command Turn
    console.log('\n[Turn 2] Command: "/stats"');
    const out2 = await loop.processTurn('/stats');
    console.log(out2);

    // 3. Resting Turn
    console.log('\n[Turn 3] Command: "/rest long"');
    const out3 = await loop.processTurn('/rest long');
    console.log(out3);

    // 4. Persistence Check
    console.log('\n[Step 4] Verifying Persistence...');
    const savedState = loop.getState();
    console.log(`Current HP: ${savedState.character.hp.current} (Expected 22 after Long Rest)`);

    console.log('\n--- Full Loop Simulation Finished ---');
}

runFullLoopSimulation();
