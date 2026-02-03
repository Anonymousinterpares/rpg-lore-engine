import { SpellcastingEngine } from '../combat/SpellcastingEngine';
import { SpellbookEngine } from '../combat/SpellbookEngine';
import { CombatFactory } from '../combat/CombatFactory';
function testSpellcasting() {
    console.log("=== Testing Magic System ===\n");
    const wizardPC = {
        name: "Misty the Mage",
        class: "Wizard",
        stats: { "INT": 18, "DEX": 14, "CON": 12 },
        hp: { current: 30, max: 30, temp: 0 },
        ac: 12,
        spellSlots: {
            "1": { current: 4, max: 4 },
            "2": { current: 3, max: 3 }
        },
        cantripsKnown: ["Fire Bolt", "Light"],
        preparedSpells: ["Shield", "Magic Missile"],
        spellbook: ["Shield", "Magic Missile", "Misty Step"],
        inventory: {
            gold: { cp: 0, sp: 0, ep: 0, gp: 200, pp: 0 },
            items: []
        },
        equipmentSlots: {}
    };
    const fireball = {
        name: "Fireball",
        level: 3,
        school: "Evocation",
        time: "1 action",
        range: "150 feet",
        components: { v: true, s: true, m: "A tiny ball of bat guano and sulfur." },
        duration: "Instantaneous",
        concentration: false,
        damage: { dice: "8d6", type: "Fire" },
        description: "A bright streak flashes from your pointing finger..."
    };
    const shield = {
        name: "Shield",
        level: 1,
        school: "Abjuration",
        time: "1 reaction",
        range: "Self",
        components: { v: true, s: true },
        duration: "1 round",
        concentration: false,
        description: "An invisible barrier of magical force appears..."
    };
    const target = {
        id: "dummy",
        name: "Training Dummy",
        hp: { current: 100, max: 100, temp: 0 },
        ac: 10
    };
    const caster = CombatFactory.fromPlayer(wizardPC);
    // 1. Test Preparation/Casting
    console.log(`Caster: ${caster.name}, HP: ${caster.hp.current}`);
    console.log(`Slots: 1st=${caster.spellSlots?.['1'].current}, 2nd=${caster.spellSlots?.['2'].current}`);
    console.log("\nCasting Shield (1st level)...");
    console.log(SpellcastingEngine.castSpell(caster, target, shield, 1));
    console.log(`1st Level Slots Remaining: ${caster.spellSlots?.['1'].current}`);
    // 2. Test Spellbook Copying
    console.log("\nAttempting to copy Fireball from scroll...");
    const scroll = {
        name: "Spell Scroll: Fireball",
        type: "Spell Scroll",
        spellName: "Fireball",
        spellLevel: 3,
        cost: { cp: 0, sp: 0, ep: 0, gp: 500, pp: 0 } // Too expensive?
    };
    const copyResult = SpellbookEngine.copyFromScroll(wizardPC, scroll, fireball);
    console.log(copyResult);
    wizardPC.inventory.gold.gp += 500; // Add gold
    console.log("Added 500gp. Trying again...");
    console.log(SpellbookEngine.copyFromScroll(wizardPC, scroll, fireball));
    console.log(`Is Fireball in Spellbook? ${wizardPC.spellbook.includes("Fireball")}`);
    console.log("\n=== Magic System Tests Complete ===");
}
testSpellcasting();
