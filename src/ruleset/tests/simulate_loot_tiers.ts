import { LootEngine } from '../combat/LootEngine';
import { CurrencyEngine } from '../combat/CurrencyEngine';
import * as fs from 'fs';
import * as path from 'path';

const MONSTER_DIR = path.join(__dirname, '..', '..', '..', 'data', 'monster');

function testLoot() {
    console.log("=== Testing LootEngine ===\n");

    const testMonsters = [
        { name: 'Goblin.json', type: 'Humanoid', cr: 0.25 },
        { name: 'Guard.json', type: 'Humanoid', cr: 0.125 },
        { name: 'Gnoll.json', type: 'Humanoid', cr: 0.5 },
        { name: 'Hydra.json', type: 'Monstrosity', cr: 8 },
        { name: 'Gynosphinx.json', type: 'Monstrosity', cr: 11 },
        { name: 'Vampire.json', type: 'Undead', cr: 13 }
    ];

    for (const test of testMonsters) {
        const filePath = path.join(MONSTER_DIR, test.name);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${test.name} (not found)`);
            continue;
        }

        const monster = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const loot = LootEngine.processDefeat(monster);

        console.log(`- Monster: ${monster.name} (Type: ${monster.type}, CR: ${monster.cr})`);
        console.log(`  Gold: ${CurrencyEngine.format(loot.gold)}`);
        console.log(`  Items: ${loot.items.length > 0 ? loot.items.map(i => i.name).join(', ') : 'None'}`);

        // Quick verification logic
        if (test.type === 'Humanoid' || test.type === 'Undead') {
            if (loot.items.length === 0 && monster.actions.some((a: any) => a.name.includes('Sword') || a.name.includes('Spear'))) {
                console.log("  [!] WARNING: Expected equipment drop but got none.");
            }
        }
        console.log("");
    }

    console.log("=== Loot Tests Complete ===");
}

testLoot();
