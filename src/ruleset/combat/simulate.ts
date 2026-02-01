import { CombatEngine } from './CombatEngine';
import { InitiativeTracker } from './InitiativeTracker';
import { CombatFactory } from './CombatFactory';
import { StandardActions } from './StandardActions';

/**
 * Example simulation script to verify combat logic.
 */
function runSimulation() {
    console.log('--- Starting Combat Simulation (V2) ---');

    // Creating combatants via factory
    const hero = CombatFactory.fromPlayer({
        name: 'Aelar the Wizard',
        level: 1,
        race: 'Elf',
        class: 'Wizard',
        stats: { 'STR': 8, 'DEX': 15, 'CON': 12, 'INT': 16, 'WIS': 13, 'CHA': 10 },
        hp: { current: 7, max: 7, temp: 0 },
        ac: 12, // Mage Armor would be higher
        equipment: ['Quarterstaff'],
        xp: 0,
        inspiration: false
    });
    hero.initiative = 18;

    const orc = CombatFactory.fromMonster({
        name: 'Angry Orc',
        cr: '1/2',
        size: 'Medium',
        type: 'Humanoid',
        alignment: 'Chaotic Evil',
        ac: 13,
        hp: { average: 15, formula: '2d8+6' },
        speed: '30ft',
        stats: { 'STR': 16, 'DEX': 12, 'CON': 16, 'INT': 7, 'WIS': 11, 'CHA': 10 },
        traits: [{ name: 'Aggressive', description: 'Can move toward enemy as bonus action' }],
        actions: [{ name: 'Greataxe', description: 'Melee Weapon Attack', attackBonus: 5, damage: '1d12+3' }]
    });
    orc.initiative = 10;

    const tracker = new InitiativeTracker([hero, orc]);
    console.log('Initiative Order:');
    tracker.getOrder().forEach((c, i) => console.log(`${i + 1}. ${c.name} (Init: ${c.initiative}, AC: ${c.ac}, HP: ${c.hp.current})`));

    let roundInfo = { combatant: tracker.getCurrentCombatant(), round: 1, newRound: false };

    while (hero.hp.current > 0 && orc.hp.current > 0) {
        const active = roundInfo.combatant;
        const target = active.id === hero.id ? orc : hero;

        if (roundInfo.newRound) {
            console.log(`\n=== Round ${roundInfo.round} ===`);
        } else {
            console.log(`\n--- Turn: ${active.name} ---`);
        }

        // Logic: Wizard tries to dodge if HP is low, Orc always attacks
        if (active.isPlayer && active.hp.current < 4) {
            console.log(StandardActions.dodge(active));
        } else {
            console.log(StandardActions.attack(active, target, 5, active.isPlayer ? '1d6+2' : '1d12+3', 0));
        }

        if (target.hp.current <= 0) {
            console.log(`\n*** ${target.name} has been defeated! ***`);
            break;
        }

        roundInfo = tracker.nextTurn();

        // Safety break for simulation
        if (roundInfo.round > 10) {
            console.log('\nSimulation timed out (10 rounds).');
            break;
        }
    }

    console.log('\n--- Combat Simulation Finished ---');
}

runSimulation();
