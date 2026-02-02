import { LevelingEngine } from '../combat/LevelingEngine';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

const pc: PlayerCharacter = {
    name: 'Test',
    level: 1,
    race: 'Human',
    class: 'Wizard',
    stats: { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10 },
    hp: { current: 6, max: 6, temp: 0 },
    hitDice: { current: 1, max: 1, dieType: '1d6' },
    xp: 300,
    inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items: [] },
    ac: 10,
    skillProficiencies: [],
    savingThrowProficiencies: [],
} as any;

console.log('Testing levelUp...');
try {
    const result = LevelingEngine.levelUp(pc);
    console.log('Success:', result);
} catch (e: any) {
    console.error('CRASHED!');
    console.error(e.message);
    console.error(e.stack);
}
