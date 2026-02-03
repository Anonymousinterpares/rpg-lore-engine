import { MechanicsEngine } from '../combat/MechanicsEngine';
import { RestingEngine } from '../combat/RestingEngine';
import { InventoryEngine } from '../combat/InventoryEngine';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

function runMechanicsSimulation() {
    console.log('--- Phase 7: Mechanics & Logic Verification ---');

    const hero: PlayerCharacter = {
        name: 'Gimli II',
        level: 3,
        race: 'Dwarf',
        class: 'Fighter',
        conditions: [],
        stats: { 'STR': 16, 'DEX': 10, 'CON': 16, 'INT': 8, 'WIS': 12, 'CHA': 10 },
        savingThrowProficiencies: ['STR', 'CON'],
        skillProficiencies: ['Athletics'],
        hp: { current: 15, max: 35, temp: 0 },
        hitDice: { current: 1, max: 3, dieType: '1d10' },
        spellSlots: {},
        cantripsKnown: [],
        knownSpells: [],
        preparedSpells: [],
        spellbook: [],
        ac: 18,
        inventory: {
            gold: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 },
            items: [
                { id: 'axe_01', instanceId: 'axe_01', name: 'Battleaxe', type: 'Weapon', weight: 4, quantity: 1, equipped: true },
                { id: 'plate_01', instanceId: 'plate_01', name: 'Plate Armor', type: 'Armor', weight: 65, quantity: 1, equipped: true }
            ]
        },
        equipmentSlots: {},
        attunedItems: [],
        xp: 900,
        inspiration: false,
        deathSaves: { successes: 0, failures: 0 },
        biography: {
            background: 'Soldier',
            traits: [],
            ideals: [],
            bonds: [],
            flaws: [],
            chronicles: []
        }
    };

    console.log(`\n[Initial State] ${hero.name} | HP: ${hero.hp.current}/${hero.hp.max} | HD: ${hero.hitDice.current}/${hero.hitDice.max}`);

    // 1. Skill Checks & Saves
    console.log('\n--- 1. Skill Checks & Saves ---');
    console.log(MechanicsEngine.resolveCheck(hero, 'STR', 'Athletics', 15).message);
    console.log(MechanicsEngine.resolveCheck(hero, 'DEX', 'Stealth', 10, 'disadvantage').message);
    console.log(MechanicsEngine.resolveCheck(hero, 'CON', undefined, 12).message);

    // 2. Inventory & Encumbrance
    console.log('\n--- 2. Inventory & Encumbrance ---');
    const enc1 = InventoryEngine.getEncumbrance(hero);
    console.log(`Current Weight: ${enc1.currentWeight} / Capacity: ${enc1.capacity} | Status: ${enc1.statusEffect || 'Normal'}`);

    console.log('Adding "Barrel of Ale" (200 lbs)...');
    InventoryEngine.addItem(hero, { id: 'ale_01', name: 'Barrel of Ale', weight: 200 });
    const enc2 = InventoryEngine.getEncumbrance(hero);
    console.log(`New Weight: ${enc2.currentWeight} / Capacity: ${enc2.capacity} | Alert: ${enc2.statusEffect}`);

    // 3. Resting
    console.log('\n--- 3. Resting ---');
    console.log(RestingEngine.shortRest(hero, 1).message);
    console.log(`After Short Rest: HP: ${hero.hp.current}/${hero.hp.max} | HD: ${hero.hitDice.current}/${hero.hitDice.max}`);

    console.log(RestingEngine.longRest(hero).message);
    console.log(`After Long Rest: HP: ${hero.hp.current}/${hero.hp.max} | HD: ${hero.hitDice.current}/${hero.hitDice.max}`);

    console.log('\n--- Simulation Finished ---');
}

runMechanicsSimulation();
