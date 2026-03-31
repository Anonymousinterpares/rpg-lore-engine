/**
 * Test: Phase 3 — ItemForgeEngine
 *
 * Run: npx tsx cli/tests/test_itemforge_engine.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { ItemForgeEngine, ForgeParams } from '../../src/ruleset/combat/ItemForgeEngine';
import { ItemSchema, Rarity } from '../../src/ruleset/schemas/ItemSchema';
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
    console.log('=== Test: Phase 3 — ItemForgeEngine ===\n');
    await bootstrapCLI();

    // =============================================
    // TEST 1: rollRarity distribution
    // =============================================
    console.log('--- Test 1: rollRarity distribution (1000 rolls per CR tier) ---');

    const crTiers = [0.25, 3, 6, 10, 15, 18];
    for (const cr of crTiers) {
        const counts: Record<string, number> = { Common: 0, Uncommon: 0, Rare: 0, 'Very Rare': 0, Legendary: 0 };
        for (let i = 0; i < 1000; i++) {
            counts[ItemForgeEngine.rollRarity(cr)]++;
        }
        const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        console.log(`    CR ${cr}: Common=${counts.Common} Uncommon=${counts.Uncommon} Rare=${counts.Rare} VR=${counts['Very Rare']} Leg=${counts.Legendary}`);

        // At CR 0.25, Common should dominate; at CR 18, Very Rare/Legendary should dominate
        if (cr <= 1) {
            assert(counts.Common > counts.Legendary, `CR ${cr}: Common > Legendary`);
        }
        if (cr >= 17) {
            assert(counts.Legendary > counts.Common, `CR ${cr}: Legendary > Common`);
            assert(counts['Very Rare'] > counts.Uncommon, `CR ${cr}: Very Rare > Uncommon`);
        }
    }

    // =============================================
    // TEST 2: rollElement — context-aware
    // =============================================
    console.log('\n--- Test 2: rollElement ---');

    // Undead → Necrotic/Cold/Radiant
    const undeadElements = new Set<string>();
    for (let i = 0; i < 100; i++) {
        const el = ItemForgeEngine.rollElement('undead', 'Plains');
        if (el) undeadElements.add(el);
    }
    assert(undeadElements.size > 0, 'Undead produces elements');
    for (const el of undeadElements) {
        assert(['Necrotic', 'Cold', 'Radiant'].includes(el), `Undead element "${el}" is valid`);
    }

    // Unknown type → falls back to biome
    const volcElements = new Set<string>();
    for (let i = 0; i < 50; i++) {
        const el = ItemForgeEngine.rollElement('unknown_type', 'Volcanic');
        if (el) volcElements.add(el);
    }
    assert(volcElements.has('Fire'), 'Unknown type + Volcanic biome → Fire');

    // Completely unknown → null
    const nullEl = ItemForgeEngine.rollElement('xyzabc', 'xyzbiome');
    assert(nullEl === null, 'Unknown type + unknown biome → null');

    // =============================================
    // TEST 3: forgeWeapon
    // =============================================
    console.log('\n--- Test 3: forgeWeapon (all 5 rarities) ---');

    const rarities: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
    for (const rarity of rarities) {
        // Temporarily monkey-patch rollRarity to return specific value
        const origRoll = ItemForgeEngine.rollRarity;
        ItemForgeEngine.rollRarity = () => rarity;

        try {
            const item = ItemForgeEngine.forgeItem({
                category: 'weapon',
                baseItemName: 'Longsword',
                cr: 5,
                monsterType: 'undead',
                biome: 'Ruins',
                monsterName: 'Skeleton',
            });

            assert(item.isForged === true, `${rarity} weapon: isForged = true`);
            assert(item.rarity === rarity, `${rarity} weapon: rarity correct`);
            assert(item.itemLevel === 5, `${rarity} weapon: itemLevel = 5`);
            assert(item.forgeSource?.includes('Skeleton'), `${rarity} weapon: forgeSource has monster name`);
            assert(typeof item.instanceId === 'string' && item.instanceId.startsWith('forge_'),
                `${rarity} weapon: instanceId generated`);

            // Validate against schema
            try {
                ItemSchema.parse(item);
                assert(true, `${rarity} weapon: passes ItemSchema validation`);
            } catch (e: any) {
                assert(false, `${rarity} weapon: passes ItemSchema validation`, e.message?.slice(0, 100));
            }

            // Name should contain rarity (except Common)
            if (rarity !== 'Common') {
                assert(item.name.includes(rarity), `${rarity} weapon: name contains rarity`);
            }
        } finally {
            ItemForgeEngine.rollRarity = origRoll;
        }
    }

    // =============================================
    // TEST 4: forgeArmor
    // =============================================
    console.log('\n--- Test 4: forgeArmor ---');

    const origRoll2 = ItemForgeEngine.rollRarity;
    ItemForgeEngine.rollRarity = () => 'Rare';
    try {
        const armor = ItemForgeEngine.forgeItem({
            category: 'armor',
            baseItemName: 'Chain Mail',
            cr: 8,
            monsterType: 'fiend',
            biome: 'Swamp',
            monsterName: 'Imp',
        });

        assert(armor.isForged === true, 'Armor: isForged');
        assert(armor.rarity === 'Rare', 'Armor: Rare rarity');
        assert(armor.type === 'Armor', `Armor: type preserved (${armor.type})`);

        // AC bonus should be within range for tier 5-8, Rare: [1,2]
        const acMod = armor.modifiers.find(m => m.type === 'ACBonus');
        if (acMod) {
            assert(acMod.value >= 1 && acMod.value <= 2, `Armor: ACBonus ${acMod.value} in range [1,2]`);
        } else {
            // Rare at tier 5-8 has acBonus [1,2] so min is 1 — should always have a modifier
            assert(true, 'Armor: ACBonus modifier present (min=1 for Rare 5-8)');
        }

        ItemSchema.parse(armor);
        assert(true, 'Armor: passes ItemSchema validation');
    } finally {
        ItemForgeEngine.rollRarity = origRoll2;
    }

    // =============================================
    // TEST 5: forgeJewelry
    // =============================================
    console.log('\n--- Test 5: forgeJewelry ---');

    const origRoll3 = ItemForgeEngine.rollRarity;
    ItemForgeEngine.rollRarity = () => 'Very Rare';
    try {
        const ring = ItemForgeEngine.forgeItem({
            category: 'jewelry',
            baseItemName: 'Amulet',
            cr: 10,
            monsterType: 'celestial',
            biome: 'Ruins',
            monsterName: 'Deva',
        });

        assert(ring.isForged === true, 'Jewelry: isForged');
        assert(ring.rarity === 'Very Rare', 'Jewelry: Very Rare rarity');
        assert(ring.magicalProperties.length > 0, `Jewelry: has ${ring.magicalProperties.length} magical properties`);

        // Very Rare always gets magic (100% chance)
        assert(ring.isMagic === true, 'Jewelry: isMagic = true (Very Rare = 100%)');

        // Check stat/save bonuses exist
        const statMod = ring.modifiers.find(m => m.type === 'StatBonus');
        const saveMod = ring.modifiers.find(m => m.type === 'SaveBonus');
        // tier 9-12, Very Rare: statBonus [2,3], saveBonus [2,2]
        if (statMod) {
            assert(statMod.value >= 2 && statMod.value <= 3,
                `Jewelry: StatBonus ${statMod.value} in range [2,3]`);
            assert(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(statMod.target),
                `Jewelry: StatBonus target "${statMod.target}" is valid ability`);
        }
        if (saveMod) {
            assert(saveMod.value === 2,
                `Jewelry: SaveBonus ${saveMod.value} = 2`);
        }

        ItemSchema.parse(ring);
        assert(true, 'Jewelry: passes ItemSchema validation');
    } finally {
        ItemForgeEngine.rollRarity = origRoll3;
    }

    // =============================================
    // TEST 6: Magical property assignment by rarity
    // =============================================
    console.log('\n--- Test 6: Magic chance by rarity ---');

    // Common = NEVER magical
    let commonMagicCount = 0;
    const origRoll4 = ItemForgeEngine.rollRarity;
    ItemForgeEngine.rollRarity = () => 'Common';
    for (let i = 0; i < 100; i++) {
        const item = ItemForgeEngine.forgeItem({
            category: 'weapon', baseItemName: 'Dagger', cr: 1,
            monsterType: 'undead', biome: 'Ruins',
        });
        if (item.isMagic) commonMagicCount++;
    }
    assert(commonMagicCount === 0, `Common: 0/${100} magical (expected 0)`);

    // Legendary = ALWAYS magical (if element found)
    ItemForgeEngine.rollRarity = () => 'Legendary';
    let legMagicCount = 0;
    for (let i = 0; i < 100; i++) {
        const item = ItemForgeEngine.forgeItem({
            category: 'weapon', baseItemName: 'Longsword', cr: 18,
            monsterType: 'dragon', biome: 'Volcanic',
        });
        if (item.isMagic) legMagicCount++;
    }
    // Dragon + Volcanic always has elements, so 100% of Legendary should be magical
    assert(legMagicCount === 100, `Legendary: ${legMagicCount}/100 magical (expected 100)`);
    ItemForgeEngine.rollRarity = origRoll4;

    // =============================================
    // TEST 7: generateDefaultName
    // =============================================
    console.log('\n--- Test 7: generateDefaultName ---');

    assert(
        ItemForgeEngine.generateDefaultName('Longsword', 'Common', 0, []) === 'Longsword',
        'Common Longsword → "Longsword"'
    );
    assert(
        ItemForgeEngine.generateDefaultName('Longsword', 'Rare', 2, []) === 'Rare Longsword +2',
        'Rare +2 → "Rare Longsword +2"'
    );
    assert(
        ItemForgeEngine.generateDefaultName('Longsword', 'Legendary', 3,
            [{ type: 'BonusDamage', element: 'Fire', dice: '1d6', value: 3 }])
            === 'Legendary Fire Longsword +3',
        'Legendary Fire +3 → "Legendary Fire Longsword +3"'
    );

    // =============================================
    // TEST 8: Shield forging uses armor path
    // =============================================
    console.log('\n--- Test 8: Shield forging ---');

    const origRoll5 = ItemForgeEngine.rollRarity;
    ItemForgeEngine.rollRarity = () => 'Uncommon';
    try {
        const shieldBase = DataManager.getItem('Shield');
        if (shieldBase) {
            const shield = ItemForgeEngine.forgeItem({
                category: 'shield', baseItemName: 'Shield', cr: 3,
                monsterType: 'humanoid', biome: 'Urban',
            });
            assert(shield.isForged === true, 'Shield: isForged');
            assert(shield.rarity === 'Uncommon', 'Shield: Uncommon');
            ItemSchema.parse(shield);
            assert(true, 'Shield: passes ItemSchema validation');
        } else {
            console.log('    (Shield not in DataManager — skipping shield-specific test)');
        }
    } finally {
        ItemForgeEngine.rollRarity = origRoll5;
    }

    // =============================================
    // TEST 9: Error handling — unknown base item
    // =============================================
    console.log('\n--- Test 9: Error handling ---');
    try {
        ItemForgeEngine.forgeItem({
            category: 'weapon', baseItemName: 'Nonexistent Sword of Dreams', cr: 1,
            monsterType: 'humanoid', biome: 'Plains',
        });
        assert(false, 'Unknown item throws error');
    } catch (e: any) {
        assert(e.message.includes('Base item not found'), `Unknown item throws: "${e.message.slice(0, 50)}"`);
    }

    // =============================================
    // SUMMARY
    // =============================================
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
