import { CharacterCreationEngine } from '../combat/CharacterCreationEngine';
import * as fs from 'fs';
import * as path from 'path';
function runCreationSimulation() {
    console.log('--- Starting Character Creation Simulation ---');
    // 1. Load Data (Simplified for simulation)
    const raceData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/race/Elf.json'), 'utf-8'));
    const classData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/class/Wizard.json'), 'utf-8'));
    const backgroundData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/backgrounds/Acolyte.json'), 'utf-8'));
    // 2. Setup Request
    const request = {
        name: 'Galandir',
        race: raceData,
        className: 'Wizard',
        classData: classData,
        background: backgroundData,
        baseStats: {
            'STR': 8,
            'DEX': 14, // Cost 7
            'CON': 12, // Cost 4
            'INT': 15, // Cost 9
            'WIS': 12, // Cost 4
            'CHA': 10 // Cost 2
        }, // Total Cost: 7+4+9+4+2 = 26/27. Valid.
        selectedSkills: ['Arcana', 'Investigation'],
        personality: {
            traits: [backgroundData.personalitySuggested.traits[0]],
            ideals: [backgroundData.personalitySuggested.ideals[0]],
            bonds: [backgroundData.personalitySuggested.bonds[0]],
            flaws: [backgroundData.personalitySuggested.flaws[0]]
        }
    };
    try {
        const hero = CharacterCreationEngine.createCharacter(request);
        console.log('SUCCESS: Character Created!');
        console.log(JSON.stringify(hero, null, 2));
        // Verification checks
        if (hero.stats['DEX'] !== 16)
            console.error('FAIL: Racial DEX bonus not applied');
        if (hero.hp.max !== 6 + 1)
            console.error(`FAIL: HP mismatch. Got ${hero.hp.max}, expected 7`);
        if (!hero.skillProficiencies.includes('Religion'))
            console.error('FAIL: Background skill Religion missing');
        if (hero.biography.backgroundId !== 'acolyte')
            console.error('FAIL: Background identity missing');
    }
    catch (error) {
        console.error('ERROR during creation:', error.message);
    }
    console.log('\n--- Simulation Finished ---');
}
runCreationSimulation();
