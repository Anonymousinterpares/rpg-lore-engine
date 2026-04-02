/**
 * One-time migration: Add structured darkvision field to all monster JSON files.
 * Based on D&D 5e SRD creature senses.
 * Run: npx tsx cli/scripts/migrate_monster_darkvision.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONSTER_DIR = path.join(__dirname, '..', '..', 'data', 'monster');

// D&D 5e darkvision rules by creature type
// Most values are 60ft unless noted otherwise
const TYPE_DARKVISION: Record<string, number> = {
    'dragon': 120,       // All dragons have blindsight + darkvision 120ft
    'aberration': 120,   // Aberrations typically 60-120ft, default 120
    'fiend': 120,        // Devils/demons see in magical darkness too
    'undead': 60,        // Standard undead darkvision
    'giant': 60,         // Most giants
    'monstrosity': 60,   // Most monstrosities
    'fey': 60,           // Hags, satyrs etc.
    'celestial': 120,    // Angels, couatl etc.
    'elemental': 60,     // Most elementals
    'ooze': 0,           // Oozes are typically blind (blindsight instead)
    'plant': 0,          // Plants typically have blindsight, not darkvision
    'construct': 60,     // Most constructs (golems, animated objects)
    'humanoid': 0,       // Standard humanoids — no darkvision
    'beast': 0,          // Default for beasts — exceptions below
    'swarm of tiny beasts': 0, // Default — exceptions below
};

// Specific humanoid exceptions (dark-dwelling races)
const HUMANOID_WITH_DARKVISION: Record<string, number> = {
    'Drow': 120,
    'Duergar': 120,
    'Kobold': 60,
    'Goblin': 60,
    'Hobgoblin': 60,
    'Bugbear': 60,
    'Orc': 60,
    'Gnoll': 60,
    'Grimlock': 0,  // Blindsight, not darkvision
};

// Beasts with darkvision (nocturnal/subterranean hunters per SRD)
const BEASTS_WITH_DARKVISION: Record<string, number> = {
    'Bat': 60,
    'Giant Bat': 60,
    'Cat': 60,
    'Owl': 120,        // Owls have superior darkvision
    'Giant Owl': 120,
    'Spider': 60,
    'Giant Spider': 60,
    'Giant Wolf Spider': 60,
    'Rat': 30,
    'Giant Rat': 60,
    'Giant Rat (Diseased)': 60,
    'Weasel': 60,
    'Giant Weasel': 60,
    'Wolf': 60,
    'Dire Wolf': 60,
    'Giant Hyena': 60,
    'Hyena': 60,
    'Panther': 60,
    'Tiger': 60,
    'Saber-Toothed Tiger': 60,
    'Lion': 60,
    'Giant Toad': 30,
    'Giant Frog': 30,
    'Giant Poisonous Snake': 30,  // Pit vipers have heat-sensing, approx darkvision
    'Constrictor Snake': 10,
    'Giant Constrictor Snake': 10,
    'Giant Centipede': 30,
    'Giant Scorpion': 60,
    'Scorpion': 30,
    'Giant Fire Beetle': 30,
    'Giant Lizard': 30,
    'Cave Bear': 60,
    'Badger': 30,
    'Giant Badger': 30,
    'Octopus': 30,
    'Giant Octopus': 60,
    'Stirge': 60,
};

// Swarms with darkvision
const SWARMS_WITH_DARKVISION: Record<string, number> = {
    'Swarm of Bats': 60,
    'Swarm of Rats': 30,
    'Swarm of Spiders': 60,
};

// Specific monstrosities/aberrations with non-standard darkvision
const SPECIFIC_OVERRIDES: Record<string, number> = {
    // Aberrations with 120ft
    'Aboleth': 120,
    'Beholder': 120,
    'Mind Flayer': 120,
    // Oozes with blindsight only (no darkvision)
    'Black Pudding': 0,
    'Gelatinous Cube': 0,
    'Gray Ooze': 0,
    'Ochre Jelly': 0,
    // Constructs that are just animated objects (no senses)
    'Animated Armor': 0,
    'Flying Sword': 0,
    'Rug of Smothering': 0,
};

function getDarkvision(monster: any): number {
    const name = monster.name || '';
    const type = (monster.type || '').toLowerCase();

    // Check specific overrides first
    if (SPECIFIC_OVERRIDES[name] !== undefined) return SPECIFIC_OVERRIDES[name];

    // Check beast exceptions
    if (type === 'beast' && BEASTS_WITH_DARKVISION[name] !== undefined) return BEASTS_WITH_DARKVISION[name];

    // Check swarm exceptions
    if (type === 'swarm of tiny beasts' && SWARMS_WITH_DARKVISION[name] !== undefined) return SWARMS_WITH_DARKVISION[name];

    // Check humanoid exceptions
    if (type === 'humanoid') {
        for (const [race, dv] of Object.entries(HUMANOID_WITH_DARKVISION)) {
            if (name.includes(race)) return dv;
        }
        return 0;
    }

    // Default by type
    return TYPE_DARKVISION[type] ?? 0;
}

function main() {
    console.log('=== Monster Darkvision Migration ===\n');

    const files = fs.readdirSync(MONSTER_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} monster files\n`);

    let updated = 0;
    let skipped = 0;
    const stats = { withDV: 0, withoutDV: 0, byType: {} as Record<string, { total: number; withDV: number }> };

    for (const file of files) {
        const filePath = path.join(MONSTER_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const type = (data.type || 'unknown').toLowerCase();
        if (!stats.byType[type]) stats.byType[type] = { total: 0, withDV: 0 };
        stats.byType[type].total++;

        const dv = getDarkvision(data);

        if (data.darkvision !== undefined && data.darkvision === dv) {
            skipped++;
            if (dv > 0) { stats.withDV++; stats.byType[type].withDV++; }
            continue;
        }

        data.darkvision = dv;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

        if (dv > 0) {
            stats.withDV++;
            stats.byType[type].withDV++;
        } else {
            stats.withoutDV++;
        }
        updated++;
    }

    console.log(`Updated: ${updated}, Skipped: ${skipped}\n`);
    console.log('By creature type:');
    for (const [type, s] of Object.entries(stats.byType).sort()) {
        console.log(`  ${type.padEnd(25)} ${s.withDV}/${s.total} have darkvision`);
    }
    console.log(`\nTotal with darkvision: ${stats.withDV}/${files.length}`);
}

main();
