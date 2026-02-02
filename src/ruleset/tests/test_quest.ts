import { QuestEngine } from '../combat/QuestEngine';
import { GameState } from '../combat/GameStateManager';

const state: GameState = {
    character: {
        name: 'Kaelen',
        level: 1,
        stats: { 'STR': 8, 'DEX': 14, 'CON': 12, 'INT': 16, 'WIS': 10, 'CHA': 12 },
        hp: { current: 7, max: 7, temp: 0 },
        hitDice: { current: 1, max: 1, dieType: '1d6' },
        xp: 0,
        inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, items: [] },
    },
    activeQuests: [
        {
            id: 'orb_hunt',
            title: 'The Lost Orb',
            description: 'Recover the Orb of Arcanum.',
            objectives: [{ id: 'find_orb', description: 'Find orb', currentProgress: 1, maxProgress: 1, isCompleted: true }],
            status: 'ACTIVE',
            rewards: { xp: 1000, gold: { gp: 50 }, items: [] }
        }
    ]
} as any;

console.log('Testing quest completion...');
try {
    const result = QuestEngine.completeQuest(state, 'orb_hunt');
    console.log('Success:', result);
    console.log('New XP:', state.character.xp);
    console.log('New Gold:', state.character.inventory.gold);
} catch (e: any) {
    console.error('CRASHED!');
    console.error(e.message);
    console.error(e.stack);
}
