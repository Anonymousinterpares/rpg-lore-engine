import * as fs from 'fs';
import * as path from 'path';
const SPELL_DIR = path.join(__dirname, '..', '..', '..', 'data', 'spell');
const RITUAL_SPELLS = [
    "Alarm", "Comprehend_Languages", "Detect_Magic", "Detect_Poison_and_Disease",
    "Find_Familiar", "Identify", "Illusory_Script", "Purify_Food_and_Drink",
    "Speak_with_Animals", "Unseen_Servant", "Animal_Messenger", "Augury",
    "Gentle_Repose", "Locate_Animals_or_Plants", "Silence", "Water_Breathing",
    "Water_Walk", "Commune", "Commune_with_Nature", "Contact_Other_Plane",
    "Telepathic_Bond", "Forbiddance"
];
function updateRituals() {
    console.log("Updating ritual spells...");
    let updatedCount = 0;
    for (const spellName of RITUAL_SPELLS) {
        const filePath = path.join(SPELL_DIR, `${spellName}.json`);
        if (fs.existsSync(filePath)) {
            const spell = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            spell.ritual = true;
            fs.writeFileSync(filePath, JSON.stringify(spell, null, 2));
            console.log(`Updated: ${spellName}`);
            updatedCount++;
        }
        else {
            console.warn(`File not found: ${filePath}`);
        }
    }
    console.log(`Successfully updated ${updatedCount} ritual spells.`);
}
updateRituals();
