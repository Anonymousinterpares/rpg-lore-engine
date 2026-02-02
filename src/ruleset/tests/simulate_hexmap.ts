import { GameLoop } from '../combat/GameLoop';
import { GameState } from '../combat/GameStateManager';

async function runHexMapSimulation() {
    console.log('--- Hex Map Management Verification ---');

    const initialState: GameState = {
        character: {
            name: 'Thorn Oakenshield',
            level: 1,
            race: 'Dwarf',
            class: 'Ranger',
            stats: { 'STR': 14, 'DEX': 16, 'CON': 14, 'INT': 10, 'WIS': 14, 'CHA': 8 },
            savingThrowProficiencies: ['DEX', 'WIS'],
            skillProficiencies: ['Nature', 'Survival'],
            hp: { current: 12, max: 12, temp: 0 },
            hitDice: { current: 1, max: 1, dieType: '1d10' },
            spellSlots: {},
            ac: 14,
            inventory: { gold: 50, items: [] },
            xp: 0,
            inspiration: false,
            biography: {
                background: 'Sage',
                traits: [],
                ideals: [],
                bonds: [],
                flaws: [],
                chronicles: []
            }
        },
        mode: 'EXPLORATION',
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: 0,
        storySummary: ''
    };

    const loop = new GameLoop(initialState, process.cwd());

    // 1. Look at starting hex
    console.log('\n[Turn 1] Command: "/look"');
    console.log(await loop.processTurn('/look'));

    // 2. Move North into unexplored territory
    console.log('\n[Turn 2] Command: "/move N"');
    console.log(await loop.processTurn('/move N'));

    // 3. Check new location
    console.log('\n[Turn 3] Command: "/stats"');
    console.log(await loop.processTurn('/stats'));

    // 4. Move East
    console.log('\n[Turn 4] Command: "/move E"');
    console.log(await loop.processTurn('/move E'));

    // 5. Look at new hex
    console.log('\n[Turn 5] Command: "/look"');
    console.log(await loop.processTurn('/look'));

    console.log('\n--- Hex Map Simulation Finished ---');
}

runHexMapSimulation();
