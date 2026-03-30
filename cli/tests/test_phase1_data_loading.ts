/**
 * Phase 1 Test: Verify all game data loads correctly via Node.js
 *
 * Run: npx tsx cli/tests/test_phase1_data_loading.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { DataManager } from '../../src/ruleset/data/DataManager';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
        console.log(`  [PASS] ${label}`);
        passed++;
    } else {
        console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
        failed++;
    }
}

async function main() {
    console.log('=== Phase 1: Data Loading Test ===\n');

    // Bootstrap
    const root = await bootstrapCLI();
    console.log(`Project root: ${root}\n`);

    // --- Races ---
    console.log('--- Races ---');
    const races = DataManager.getRaces();
    assert(races.length === 13, `Race count: ${races.length} === 13`);
    assert(DataManager.getRace('Human') !== undefined, 'getRace("Human") exists');
    assert(DataManager.getRace('Elf') !== undefined, 'getRace("Elf") exists');
    assert(DataManager.getRace('Dwarf') !== undefined, 'getRace("Dwarf") exists');
    assert(DataManager.getRace('Tiefling') !== undefined, 'getRace("Tiefling") exists');

    // --- Classes ---
    console.log('\n--- Classes ---');
    const classes = DataManager.getClasses();
    assert(classes.length === 12, `Class count: ${classes.length} === 12`);
    assert(DataManager.getClass('Fighter') !== undefined, 'getClass("Fighter") exists');
    assert(DataManager.getClass('Wizard') !== undefined, 'getClass("Wizard") exists');
    assert(DataManager.getClass('Rogue') !== undefined, 'getClass("Rogue") exists');
    assert(DataManager.getClass('Cleric') !== undefined, 'getClass("Cleric") exists');

    // --- Backgrounds ---
    console.log('\n--- Backgrounds ---');
    const backgrounds = DataManager.getBackgrounds();
    assert(backgrounds.length === 6, `Background count: ${backgrounds.length} === 6`);
    assert(DataManager.getBackground('Soldier') !== undefined, 'getBackground("Soldier") exists');
    assert(DataManager.getBackground('Sage') !== undefined, 'getBackground("Sage") exists');

    // --- Items (triple-key lookup) ---
    console.log('\n--- Items ---');
    const dagger = DataManager.getItem('Dagger');
    assert(dagger !== undefined, 'getItem("Dagger") exists');
    assert(DataManager.getItem('dagger') !== undefined, 'getItem("dagger") lowercase lookup');
    assert(DataManager.getItem('chain_mail') !== undefined || DataManager.getItem('Chain Mail') !== undefined, 'getItem chain mail lookup');

    const longsword = DataManager.getItem('Longsword');
    assert(longsword !== undefined, 'getItem("Longsword") exists');
    if (longsword) {
        assert(longsword.type !== undefined, `Longsword has type: "${longsword.type}"`);
    }

    // --- Spells ---
    console.log('\n--- Spells ---');
    const allSpells = DataManager.getSpells();
    assert(allSpells.length === 319, `Spell count: ${allSpells.length} === 319`, `got ${allSpells.length}`);
    assert(DataManager.getSpell('Magic Missile') !== undefined, 'getSpell("Magic Missile") exists');
    assert(DataManager.getSpell('magic missile') !== undefined, 'getSpell("magic missile") lowercase');
    assert(DataManager.getSpell('Fireball') !== undefined, 'getSpell("Fireball") exists');
    assert(DataManager.getSpell('Cure Wounds') !== undefined, 'getSpell("Cure Wounds") exists');

    const wizardL1 = DataManager.getSpellsByClass('Wizard', 1);
    assert(wizardL1.length > 0, `Wizard level 1 spells: ${wizardL1.length} > 0`);

    const clericL1 = DataManager.getSpellsByClass('Cleric', 1);
    assert(clericL1.length > 0, `Cleric level 1 spells: ${clericL1.length} > 0`);

    // --- Monsters ---
    console.log('\n--- Monsters ---');
    const goblin = DataManager.getMonster('Goblin');
    assert(goblin !== undefined, 'getMonster("Goblin") exists');
    assert(DataManager.getMonster('goblin') !== undefined, 'getMonster("goblin") lowercase');
    assert(DataManager.getMonster('Skeleton') !== undefined, 'getMonster("Skeleton") exists');
    assert(DataManager.getMonster('Wolf') !== undefined, 'getMonster("Wolf") exists');
    if (goblin) {
        assert(goblin.cr !== undefined, `Goblin has CR: ${goblin.cr}`);
        assert(goblin.hp !== undefined, `Goblin has HP defined`);
    }

    // --- Biome-Monster Mapping ---
    console.log('\n--- Biome-Monster Mapping ---');
    const forestMonsters = DataManager.getMonstersByBiome('Forest');
    assert(forestMonsters.length > 0, `Forest biome monsters: ${forestMonsters.length} > 0`);
    const plainsMonsters = DataManager.getMonstersByBiome('Plains');
    assert(plainsMonsters.length > 0, `Plains biome monsters: ${plainsMonsters.length} > 0`);

    // --- Cross-reference: Background starting equipment resolves ---
    console.log('\n--- Cross-reference: Background Equipment ---');
    const soldier = DataManager.getBackground('Soldier');
    if (soldier && soldier.startingEquipment) {
        let resolvedCount = 0;
        for (const eq of soldier.startingEquipment) {
            const item = DataManager.getItem(eq.id);
            if (item) resolvedCount++;
        }
        assert(resolvedCount > 0, `Soldier starting equipment resolves: ${resolvedCount}/${soldier.startingEquipment.length} items found`);
    }

    // --- Summary ---
    console.log('\n============================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('============================');

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch(e => {
    console.error('Test crashed:', e);
    process.exit(1);
});
