import * as fs from 'fs';
import * as path from 'path';
const MONSTER_DIR = path.join(__dirname, '..', '..', '..', 'data', 'monster');
const SPELLCASTERS = [
    "Acolyte.json", "Androsphinx.json", "Archmage.json", "Cult_Fanatic.json",
    "Druid.json", "Guardian_Naga.json", "Gynosphinx.json", "Lich.json",
    "Mage.json", "Mummy_Lord.json", "Priest.json", "Spirit_Naga.json"
];
const ABILITY_MAP = {
    "Intelligence": "INT",
    "Wisdom": "WIS",
    "Charisma": "CHA"
};
function parseSpellcasting(description) {
    const spellcasting = {
        slots: {}
    };
    // Extract basic stats
    const mainReg = /The .* is a (\d+)-level spellcaster\. Its spellcasting ability is (\w+) \(spell save DC (\d+), \+(\d+) to hit with spell attacks\)\./;
    const match = description.match(mainReg);
    if (match) {
        spellcasting.casterLevel = parseInt(match[1]);
        spellcasting.ability = ABILITY_MAP[match[2]] || "INT";
        spellcasting.spellSaveDC = parseInt(match[3]);
        spellcasting.spellAttackBonus = parseInt(match[4]);
    }
    // Extract At-will
    const atWillMatch = description.match(/can cast (.*?) at will/);
    if (atWillMatch) {
        spellcasting.atWill = atWillMatch[1].split(/, | and /).map(s => s.replace(/\*/g, '').trim());
    }
    // Extract Cantrips
    const cantripsMatch = description.match(/Cantrips \(at will\): (.*)/);
    if (cantripsMatch) {
        spellcasting.cantrips = cantripsMatch[1].split(/, | and /).map(s => s.replace(/\*/g, '').trim());
    }
    // Extract Slots
    const slotLines = description.split('\n').filter(l => l.includes('slots)'));
    for (const line of slotLines) {
        const slotMatch = line.match(/- (\d+)[stndrh]{2} level \((\d+) slots\): (.*)/);
        if (slotMatch) {
            spellcasting.slots[slotMatch[1]] = {
                count: parseInt(slotMatch[2]),
                spells: slotMatch[3].split(/, | and /).map(s => s.replace(/\*/g, '').trim())
            };
        }
    }
    return spellcasting;
}
function migrateMonsters() {
    console.log("Analyzing monster spellcasting...");
    for (const filename of SPELLCASTERS) {
        const filePath = path.join(MONSTER_DIR, filename);
        if (fs.existsSync(filePath)) {
            const monster = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const trait = monster.traits.find((t) => t.name === "Spellcasting");
            if (trait) {
                monster.spellcasting = parseSpellcasting(trait.description);
                fs.writeFileSync(filePath, JSON.stringify(monster, null, 2));
                console.log(`Migrated: ${filename}`);
            }
        }
    }
}
migrateMonsters();
