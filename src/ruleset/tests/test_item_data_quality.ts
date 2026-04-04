/**
 * Item Data Quality Verification
 * Checks ALL equippable item JSON files for required fields.
 *
 * Run: npx tsx src/ruleset/tests/test_item_data_quality.ts
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ITEM_DIR = resolve(process.cwd(), 'data/item');

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }

function runTests() {
    console.log('=== ITEM DATA QUALITY VERIFICATION ===\n');

    const files = readdirSync(ITEM_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.'));
    let totalChecked = 0;
    let weaponsFailed = 0;
    let armorFailed = 0;
    let weaponsOk = 0;
    let armorOk = 0;
    const issues: string[] = [];

    for (const file of files) {
        const data = JSON.parse(readFileSync(resolve(ITEM_DIR, file), 'utf-8'));
        const type = (data.type || '').toLowerCase();

        // Skip non-equippable items
        if (!type.includes('weapon') && !type.includes('armor') && !type.includes('shield') && !type.includes('ammunition')) continue;

        totalChecked++;
        const fileIssues: string[] = [];

        // Check description
        if (!data.description) fileIssues.push('missing description');

        // Check proper type classification
        if (type === 'weapon' || type === 'armor') {
            fileIssues.push(`generic type "${data.type}" — needs classification (e.g., "Weapon (Martial, Melee)")`);
        }

        // Weapon-specific checks
        if (type.includes('weapon')) {
            if (!data.damage) fileIssues.push('missing damage');
            if (!data.properties) fileIssues.push('missing properties');
        }

        // Armor-specific checks
        if (type.includes('armor')) {
            if (!data.acCalculated) fileIssues.push('missing acCalculated');
            if (data.stealthDisadvantage === undefined) fileIssues.push('missing stealthDisadvantage');
        }

        if (fileIssues.length > 0) {
            fail(`${file} (${data.name}): ${fileIssues.join(', ')}`);
            issues.push(`${file}: ${fileIssues.join(', ')}`);
            if (type.includes('weapon')) weaponsFailed++;
            else armorFailed++;
        } else {
            if (type.includes('weapon')) weaponsOk++;
            else armorOk++;
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`  Total equippable items checked: ${totalChecked}`);
    console.log(`  Weapons OK: ${weaponsOk}, Failed: ${weaponsFailed}`);
    console.log(`  Armor/Shield OK: ${armorOk}, Failed: ${armorFailed}`);
    console.log(`  Total issues: ${issues.length}`);

    if (issues.length === 0) {
        pass('ALL equippable items have proper data');
    } else {
        fail(`${issues.length} items still have issues`);
    }

    console.log('\n=== ITEM DATA QUALITY CHECK COMPLETE ===');
}

runTests();
