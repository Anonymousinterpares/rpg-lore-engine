/**
 * Test: Phase 2 — ForgeConfig Data Tables
 *
 * Verifies:
 * 1. CR→ItemLevel mapping is correct and clamped
 * 2. CR→LevelTier mapping covers full range
 * 3. Rarity weights sum to 100 for each CR bracket
 * 4. All level tiers × rarities have entries in weapon/armor/jewelry tables
 * 5. Bonus ranges are valid ([min, max] where min <= max)
 * 6. Element pools cover all monster types from the data
 * 7. Utility functions (randomInRange, averageDice) are correct
 * 8. getCRBracket covers edge cases
 *
 * Run: npx tsx cli/tests/test_forge_config.ts
 */

import {
    crToItemLevel, crToLevelTier, getCRBracket, LevelTier,
    RARITY_WEIGHTS, MAGIC_CHANCE,
    WEAPON_BONUSES, ARMOR_BONUSES, JEWELRY_BONUSES,
    ELEMENT_POOLS, BIOME_ELEMENT_POOLS,
    RARITY_VALUE_MULTIPLIER,
    randomInRange, averageDice,
} from '../../src/ruleset/data/ForgeConfig';
import { Rarity } from '../../src/ruleset/schemas/ItemSchema';

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

function main() {
    console.log('=== Test: Phase 2 — ForgeConfig Data Tables ===\n');

    const rarities: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
    const tiers: LevelTier[] = ['1-4', '5-8', '9-12', '13-16', '17-20'];

    // =============================================
    // TEST 1: crToItemLevel
    // =============================================
    console.log('--- Test 1: crToItemLevel ---');
    assert(crToItemLevel(0) === 1, 'CR 0 → level 1 (clamped)');
    assert(crToItemLevel(0.25) === 1, 'CR 0.25 → level 1');
    assert(crToItemLevel(0.5) === 1, 'CR 0.5 → level 1');
    assert(crToItemLevel(1) === 1, 'CR 1 → level 1');
    assert(crToItemLevel(2) === 2, 'CR 2 → level 2');
    assert(crToItemLevel(5.5) === 6, 'CR 5.5 → level 6 (ceil)');
    assert(crToItemLevel(10) === 10, 'CR 10 → level 10');
    assert(crToItemLevel(20) === 20, 'CR 20 → level 20');
    assert(crToItemLevel(25) === 20, 'CR 25 → level 20 (clamped)');
    assert(crToItemLevel(-1) === 1, 'CR -1 → level 1 (clamped)');

    // =============================================
    // TEST 2: crToLevelTier
    // =============================================
    console.log('\n--- Test 2: crToLevelTier ---');
    assert(crToLevelTier(0) === '1-4', 'CR 0 → tier 1-4');
    assert(crToLevelTier(1) === '1-4', 'CR 1 → tier 1-4');
    assert(crToLevelTier(4) === '1-4', 'CR 4 → tier 1-4');
    assert(crToLevelTier(5) === '5-8', 'CR 5 → tier 5-8');
    assert(crToLevelTier(8) === '5-8', 'CR 8 → tier 5-8');
    assert(crToLevelTier(9) === '9-12', 'CR 9 → tier 9-12');
    assert(crToLevelTier(13) === '13-16', 'CR 13 → tier 13-16');
    assert(crToLevelTier(17) === '17-20', 'CR 17 → tier 17-20');
    assert(crToLevelTier(20) === '17-20', 'CR 20 → tier 17-20');

    // =============================================
    // TEST 3: getCRBracket
    // =============================================
    console.log('\n--- Test 3: getCRBracket ---');
    assert(getCRBracket(0) === 'CR_0-1', 'CR 0 → CR_0-1');
    assert(getCRBracket(0.25) === 'CR_0-1', 'CR 0.25 → CR_0-1');
    assert(getCRBracket(1) === 'CR_0-1', 'CR 1 → CR_0-1');
    assert(getCRBracket(2) === 'CR_2-4', 'CR 2 → CR_2-4');
    assert(getCRBracket(4) === 'CR_2-4', 'CR 4 → CR_2-4');
    assert(getCRBracket(5) === 'CR_5-8', 'CR 5 → CR_5-8');
    assert(getCRBracket(12) === 'CR_9-12', 'CR 12 → CR_9-12');
    assert(getCRBracket(16) === 'CR_13-16', 'CR 16 → CR_13-16');
    assert(getCRBracket(17) === 'CR_17-20', 'CR 17 → CR_17-20');
    assert(getCRBracket(30) === 'CR_17-20', 'CR 30 → CR_17-20');

    // =============================================
    // TEST 4: Rarity weights sum to 100
    // =============================================
    console.log('\n--- Test 4: Rarity weights sum to 100 ---');
    for (const bracket of Object.keys(RARITY_WEIGHTS)) {
        const weights = RARITY_WEIGHTS[bracket];
        const sum = rarities.reduce((s, r) => s + weights[r], 0);
        assert(sum === 100, `${bracket}: weights sum to ${sum}`);
    }

    // =============================================
    // TEST 5: MAGIC_CHANCE values are valid probabilities
    // =============================================
    console.log('\n--- Test 5: MAGIC_CHANCE ---');
    assert(MAGIC_CHANCE['Common'] === 0, 'Common: 0% magic');
    assert(MAGIC_CHANCE['Uncommon'] === 0.15, 'Uncommon: 15% magic');
    assert(MAGIC_CHANCE['Rare'] === 0.75, 'Rare: 75% magic');
    assert(MAGIC_CHANCE['Very Rare'] === 1.0, 'Very Rare: 100% magic');
    assert(MAGIC_CHANCE['Legendary'] === 1.0, 'Legendary: 100% magic');

    // =============================================
    // TEST 6: Weapon bonus tables — completeness + validity
    // =============================================
    console.log('\n--- Test 6: Weapon bonus tables ---');
    for (const tier of tiers) {
        for (const rarity of rarities) {
            const entry = WEAPON_BONUSES[tier]?.[rarity];
            assert(entry !== undefined, `WEAPON[${tier}][${rarity}] exists`);
            if (entry) {
                assert(entry.hitBonus[0] <= entry.hitBonus[1],
                    `WEAPON[${tier}][${rarity}] hitBonus range valid: [${entry.hitBonus}]`);
                assert(entry.damageBonus[0] <= entry.damageBonus[1],
                    `WEAPON[${tier}][${rarity}] damageBonus range valid: [${entry.damageBonus}]`);
            }
        }
    }

    // =============================================
    // TEST 7: Armor bonus tables
    // =============================================
    console.log('\n--- Test 7: Armor bonus tables ---');
    for (const tier of tiers) {
        for (const rarity of rarities) {
            const entry = ARMOR_BONUSES[tier]?.[rarity];
            assert(entry !== undefined, `ARMOR[${tier}][${rarity}] exists`);
            if (entry) {
                assert(entry.acBonus[0] <= entry.acBonus[1],
                    `ARMOR[${tier}][${rarity}] acBonus range valid: [${entry.acBonus}]`);
                assert(entry.acBonus[1] <= 3,
                    `ARMOR[${tier}][${rarity}] acBonus never exceeds +3 (got: ${entry.acBonus[1]})`);
            }
        }
    }

    // =============================================
    // TEST 8: Jewelry bonus tables
    // =============================================
    console.log('\n--- Test 8: Jewelry bonus tables ---');
    for (const tier of tiers) {
        for (const rarity of rarities) {
            const entry = JEWELRY_BONUSES[tier]?.[rarity];
            assert(entry !== undefined, `JEWELRY[${tier}][${rarity}] exists`);
            if (entry) {
                assert(entry.statBonus[0] <= entry.statBonus[1],
                    `JEWELRY[${tier}][${rarity}] statBonus range valid: [${entry.statBonus}]`);
                assert(entry.saveBonus[0] <= entry.saveBonus[1],
                    `JEWELRY[${tier}][${rarity}] saveBonus range valid: [${entry.saveBonus}]`);
            }
        }
    }

    // =============================================
    // TEST 9: Element pools — all monster types covered
    // =============================================
    console.log('\n--- Test 9: Element pools ---');
    const expectedTypes = ['undead', 'fiend', 'celestial', 'dragon', 'elemental', 'fey',
        'aberration', 'construct', 'monstrosity', 'ooze', 'plant', 'beast', 'giant', 'humanoid'];
    for (const type of expectedTypes) {
        const pool = ELEMENT_POOLS[type];
        assert(pool !== undefined && pool.length > 0, `ELEMENT_POOLS["${type}"] has ${pool?.length || 0} elements`);
    }

    // Biome pools
    const expectedBiomes = ['Volcanic', 'Tundra', 'Swamp', 'Ruins', 'Forest', 'Desert',
        'Mountain', 'Ocean', 'Coast', 'Jungle', 'Plains', 'Hills', 'Urban', 'Farmland'];
    for (const biome of expectedBiomes) {
        const pool = BIOME_ELEMENT_POOLS[biome];
        assert(pool !== undefined && pool.length > 0, `BIOME_ELEMENT_POOLS["${biome}"] has ${pool?.length || 0} elements`);
    }

    // =============================================
    // TEST 10: Gold value multipliers
    // =============================================
    console.log('\n--- Test 10: Gold multipliers ---');
    assert(RARITY_VALUE_MULTIPLIER['Common'] === 1, 'Common: 1x');
    assert(RARITY_VALUE_MULTIPLIER['Uncommon'] === 5, 'Uncommon: 5x');
    assert(RARITY_VALUE_MULTIPLIER['Rare'] === 50, 'Rare: 50x');
    assert(RARITY_VALUE_MULTIPLIER['Very Rare'] === 500, 'Very Rare: 500x');
    assert(RARITY_VALUE_MULTIPLIER['Legendary'] === 5000, 'Legendary: 5000x');
    // Verify monotonic increase
    let prev = 0;
    for (const r of rarities) {
        assert(RARITY_VALUE_MULTIPLIER[r] > prev,
            `${r} multiplier (${RARITY_VALUE_MULTIPLIER[r]}) > previous (${prev})`);
        prev = RARITY_VALUE_MULTIPLIER[r];
    }

    // =============================================
    // TEST 11: Utility functions
    // =============================================
    console.log('\n--- Test 11: Utility functions ---');

    // randomInRange
    for (let i = 0; i < 100; i++) {
        const val = randomInRange(2, 5);
        if (val < 2 || val > 5) {
            assert(false, `randomInRange(2,5) returned ${val} — out of bounds`);
            break;
        }
    }
    assert(true, 'randomInRange(2,5) — 100 rolls all within [2,5]');
    assert(randomInRange(3, 3) === 3, 'randomInRange(3,3) always returns 3');

    // averageDice
    assert(averageDice('1d4') === 2, 'averageDice("1d4") = 2');
    assert(averageDice('1d6') === 3, 'averageDice("1d6") = 3');
    assert(averageDice('1d8') === 4, 'averageDice("1d8") = 4');
    assert(averageDice('1d10') === 5, 'averageDice("1d10") = 5');
    assert(averageDice('2d6') === 7, 'averageDice("2d6") = 7');
    assert(averageDice('2d8') === 9, 'averageDice("2d8") = 9');
    assert(averageDice('invalid') === 0, 'averageDice("invalid") = 0');

    // =============================================
    // SUMMARY
    // =============================================
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

main();
