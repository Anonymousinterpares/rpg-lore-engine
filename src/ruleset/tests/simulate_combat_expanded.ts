import { CombatFactory } from '../combat/CombatFactory';
import { StandardActions } from '../combat/StandardActions';
import { MechanicsEngine } from '../combat/MechanicsEngine';
import { InitiativeTracker } from '../combat/InitiativeTracker';

function runExpandedCombatSimulation() {
    console.log('--- Phase 13: Combat Mechanics Expansion Verification ---');

    const hero = CombatFactory.fromPlayer({
        name: 'Aragorn',
        level: 5,
        race: 'Human',
        class: 'Ranger',
        conditions: [],
        stats: { 'STR': 16, 'DEX': 14, 'CON': 14, 'INT': 10, 'WIS': 12, 'CHA': 10 },
        savingThrowProficiencies: ['STR', 'DEX'],
        skillProficiencies: ['Athletics', 'Perception', 'Stealth'],
        hp: { current: 40, max: 40, temp: 0 },
        hitDice: { current: 5, max: 5, dieType: '1d10' },
        spellSlots: {},
        cantripsKnown: [],
        knownSpells: [],
        preparedSpells: [],
        spellbook: [],
        unseenSpells: [],
        ac: 16,
        inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items: [] },
        equipmentSlots: {},
        attunedItems: [],
        xp: 0,
        inspiration: false,
        deathSaves: { successes: 0, failures: 0 },
        featureUsages: {},
        biography: {
            background: 'Outlander',
            traits: [],
            ideals: [],
            bonds: [],
            flaws: [],
            chronicles: []
        }
    });

    const orc = CombatFactory.fromMonster({
        name: 'Orc Warrior',
        cr: 1 / 2,
        size: 'Medium',
        type: 'Humanoid',
        alignment: 'Chaotic Evil',
        ac: 13,
        hp: { average: 15, formula: '2d8+6' },
        speed: '30 ft',
        stats: { 'STR': 16, 'DEX': 12, 'CON': 16, 'INT': 7, 'WIS': 11, 'CHA': 10 },
        traits: [],
        actions: []
    });

    console.log(`\n[Initial State] ${hero.name} (AC: ${hero.ac}) vs ${orc.name} (AC: ${orc.ac})`);

    // 1. Cover System
    console.log('\n--- 1. Cover System ---');
    orc.tactical.cover = 'Half';
    console.log(`Orc takes Half Cover (+2 AC).`);
    console.log(StandardActions.attack(hero, orc, 5, '1d8', 3));

    orc.tactical.cover = 'Three-Quarters';
    console.log(`Orc takes Three-Quarters Cover (+5 AC).`);
    console.log(StandardActions.attack(hero, orc, 5, '1d8', 3)); // Action already spent, resetting for test

    hero.resources.actionSpent = false;
    orc.tactical.cover = 'Full';
    console.log(`Orc takes Full Cover (Untargetable).`);
    console.log(StandardActions.attack(hero, orc, 5, '1d8', 3));

    // 2. Grappling & Shoving
    console.log('\n--- 2. Grappling & Shoving ---');
    hero.resources.actionSpent = false;
    console.log(StandardActions.grapple(hero, orc, 5, 3));
    console.log(`Orc Grappled: ${orc.conditions.includes('Grappled')}`);

    hero.resources.actionSpent = false;
    console.log(StandardActions.shove(hero, orc, 5, 3, 'prone'));
    console.log(`Orc Prone: ${orc.conditions.includes('Prone')}`);

    // 3. Ranged in Melee / Prone Disadvantage
    console.log('\n--- 3. Tactical Disadvantage ---');
    hero.resources.actionSpent = false;
    console.log(`Aragorn attacks prone Orc with a ranged weapon...`);
    console.log(StandardActions.attack(hero, orc, 5, '1d8', 3, true)); // isRanged = true

    // 4. Two-Weapon Fighting
    console.log('\n--- 4. Two-Weapon Fighting ---');
    hero.resources.bonusActionSpent = false;
    console.log(StandardActions.twoWeaponAttack(hero, orc, 5, '1d6'));

    // 5. Surprise & Reactions
    console.log('\n--- 5. Surprise & Reactions ---');
    const goblin = CombatFactory.fromMonster({
        name: 'Sneaky Goblin',
        cr: 1 / 4,
        size: 'Small',
        type: 'Humanoid',
        alignment: 'Neutral Evil',
        ac: 15,
        hp: { average: 7, formula: '2d6' },
        speed: '30 ft',
        stats: { 'STR': 8, 'DEX': 14, 'CON': 10, 'INT': 10, 'WIS': 8, 'CHA': 8 },
        traits: [],
        actions: []
    });
    goblin.conditions.push('Surprised');

    // Set initiative for order
    hero.initiative = 20;
    goblin.initiative = 10;

    const tracker = new InitiativeTracker([hero, goblin]);

    console.log(`Goblin is Surprised.`);
    let turn = tracker.getCurrentCombatant();
    console.log(`Current Turn: ${turn.name}`);

    console.log(`Next turn (Goblin)...`);
    const nextResult = tracker.nextTurn();
    const gTurn = nextResult.combatant;

    console.log(`${gTurn.name} Action Spent: ${gTurn.resources.actionSpent} (Expected: true if surprised)`);
    console.log(`${gTurn.name} Conditions: ${gTurn.conditions.join(', ')} (Expected: no Surprise)`);

    // 6. Stealth & Passive Perception
    console.log('\n--- 6. Stealth & Passive Perception ---');
    // Using a simple cast for the simulation parts that use PlayerCharacter/Monster
    const pcAragorn = {
        name: 'Aragorn',
        level: 5,
        stats: { 'WIS': 12 },
        skillProficiencies: ['Perception']
    } as any;

    const passive = MechanicsEngine.getPassivePerception(pcAragorn);
    console.log(`${hero.name} Passive Perception: ${passive}`);

    const groupStealth = MechanicsEngine.resolveGroupStealth([pcAragorn], 12);
    console.log(`Group Stealth result: ${groupStealth.success ? 'SUCCESS' : 'FAILURE'}`);

    console.log('\n--- Simulation Finished ---');
}

runExpandedCombatSimulation();
