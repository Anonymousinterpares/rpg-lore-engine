import { bootstrapCLI } from "../bootstrap";
import { createQuickCharacter } from "../creation";
async function main() {
    await bootstrapCLI();
    const s = createQuickCharacter({ name: "WizTest", className: "Wizard" });
    const pc = s.character;
    console.log("Level:", pc.level);
    console.log("Class:", pc.class);
    console.log("SpellSlots:", JSON.stringify(pc.spellSlots));
    console.log("Cantrips:", pc.cantripsKnown);
    console.log("Prepared:", pc.preparedSpells);
    console.log("Known:", pc.knownSpells);
}
main();
