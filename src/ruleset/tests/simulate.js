import { CombatFactory } from '../combat/CombatFactory';
import { StandardActions } from '../combat/StandardActions';
import { InitiativeTracker } from '../combat/InitiativeTracker';
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
        conditions: [],
        stats: { 'STR': 10, 'DEX': 14, 'CON': 12, 'INT': 16, 'WIS': 12, 'CHA': 10 },
        savingThrowProficiencies: ['INT', 'WIS'],
        skillProficiencies: ['Arcana', 'Investigation'],
        hp: { current: 7, max: 7, temp: 0 },
        hitDice: { current: 1, max: 1, dieType: '1d6' },
        spellSlots: { '1': { current: 2, max: 2 } },
        cantripsKnown: [],
        knownSpells: [],
        preparedSpells: [],
        spellbook: [],
        ac: 12,
        inventory: {
            gold: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
            items: [
                { id: 'staff_01', instanceId: 'staff_01', name: 'Quarterstaff', type: 'Weapon', weight: 4, quantity: 1, equipped: true }
            ]
        },
        equipmentSlots: {},
        attunedItems: [],
        xp: 0,
        inspiration: false,
        deathSaves: { successes: 0, failures: 0 },
        biography: {
            background: 'Acolyte',
            traits: [],
            ideals: [],
            bonds: [],
            flaws: [],
            chronicles: []
        }
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
        }
        else {
            console.log(`\n--- Turn: ${active.name} ---`);
        }
        // Logic: Wizard tries to dodge if HP is low, Orc always attacks
        if (active.isPlayer && active.hp.current < 4) {
            console.log(StandardActions.dodge(active));
        }
        else {
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
