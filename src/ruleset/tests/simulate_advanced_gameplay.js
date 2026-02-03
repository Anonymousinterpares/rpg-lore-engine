import { DeathEngine } from '../combat/DeathEngine';
import { LevelingEngine } from '../combat/LevelingEngine';
import { QuestEngine } from '../combat/QuestEngine';
import { MulticlassingEngine } from '../combat/MulticlassingEngine';
async function runAdvancedSimulation() {
    console.log('--- Phase 18: Advanced Gameplay Verification ---\n');
    const pc = {
        name: 'Kaelen',
        level: 1,
        race: 'Elf',
        class: 'Wizard',
        stats: { 'STR': 8, 'DEX': 14, 'CON': 12, 'INT': 16, 'WIS': 10, 'CHA': 12 },
        hp: { current: 7, max: 7, temp: 0 },
        ac: 12,
        hitDice: { current: 1, max: 1, dieType: '1d6' },
        inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, items: [] },
        xp: 0,
        skillProficiencies: ['Arcana'],
        savingThrowProficiencies: ['INT', 'WIS'],
        biography: { chronicles: [] }
    };
    const state = {
        character: pc,
        activeQuests: [
            {
                id: 'orb_hunt',
                title: 'The Lost Orb',
                description: 'Recover the Orb of Arcanum.',
                objectives: [
                    { id: 'find_orb', description: 'Find the orb in the cave.', currentProgress: 0, maxProgress: 1 }
                ],
                status: 'ACTIVE',
                rewards: { xp: 1000, gold: { gp: 50 } }
            }
        ]
    };
    // 1. Death Engine
    console.log('--- 1. Death Engine ---');
    const combatant = { ...pc, conditions: [], resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false } };
    console.log(DeathEngine.handleDowned(combatant));
    console.log('Rolling death save...');
    console.log(DeathEngine.rollDeathSave().message);
    // 2. Leveling Engine
    console.log('\n--- 2. Leveling Engine ---');
    console.log(`Current: Level ${pc.level}, XP ${pc.xp}, HP ${pc.hp.max}`);
    LevelingEngine.addXP(pc, 400);
    console.log(`Added 400 XP. Can level up? ${LevelingEngine.canLevelUp(pc)}`);
    console.log(LevelingEngine.levelUp(pc));
    console.log(`New: Level ${pc.level}, XP ${pc.xp}, HP ${pc.hp.max}`);
    // 3. Quest Engine
    console.log('\n--- 3. Quest Engine ---');
    console.log(QuestEngine.updateObjective(state.activeQuests[0], 'find_orb', 1));
    console.log(QuestEngine.completeQuest(state, 'orb_hunt'));
    console.log(`PC XP after quest: ${pc.xp}. Level: ${pc.level}`);
    // 4. Multiclassing Engine
    console.log('\n--- 4. Multiclassing Engine ---');
    console.log('Trying to multiclass into Paladin (needs STR 13 & CHA 13):');
    const paladinCheck = MulticlassingEngine.canMulticlass(pc, 'Paladin');
    console.log(`Success: ${paladinCheck.success} | Message: ${paladinCheck.message}`);
    console.log('Trying to multiclass into Sorcerer (needs CHA 13):');
    const sorcCheck = MulticlassingEngine.canMulticlass(pc, 'Sorcerer');
    console.log(`Success: ${sorcCheck.success} | Message: ${sorcCheck.message}`);
    console.log('\n--- Advanced Simulation Finished ---');
}
runAdvancedSimulation();
