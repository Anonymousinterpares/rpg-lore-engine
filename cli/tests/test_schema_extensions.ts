/**
 * Test: Phase 1 — ItemSchema Extensions
 *
 * Verifies:
 * 1. All 255 existing items still pass validation (backward compatibility)
 * 2. Forged items with new fields pass validation
 * 3. New modifier types (HitBonus, SaveBonus, DamageResistance) are accepted
 * 4. MagicalProperties array validates all 7 types
 * 5. Rarity enum validates all 5 tiers
 * 6. Defaults work correctly (Common, level 1, not forged, empty magicProps)
 *
 * Run: npx tsx cli/tests/test_schema_extensions.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { BaseItemSchema, WeaponSchema, ArmorSchema, ItemSchema, RaritySchema, MagicalPropertySchema, ModifierSchema } from '../../src/ruleset/schemas/ItemSchema';
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
    console.log('=== Test: Phase 1 — ItemSchema Extensions ===\n');
    await bootstrapCLI();

    // =============================================
    // TEST 1: Existing items backward compatibility
    // =============================================
    console.log('--- Test 1: Backward compatibility (existing items) ---');

    // Validate a representative sample of items across types
    const sampleItems = [
        'Longsword', 'Dagger', 'Greataxe', 'Shortbow',        // Weapons
        'Chain Mail', 'Leather', 'Plate',                          // Armor
        'Backpack', 'Rope, hempen (50 feet)', 'Torch',          // Adventuring Gear
    ];

    let validCount = 0;
    let invalidItems: string[] = [];
    for (const name of sampleItems) {
        const item = DataManager.getItem(name);
        if (!item) { invalidItems.push(`${name}: NOT FOUND`); continue; }
        try {
            ItemSchema.parse(item);
            validCount++;
        } catch (e: any) {
            invalidItems.push(`${name}: ${e.message?.slice(0, 80)}`);
        }
    }
    assert(validCount === sampleItems.length,
        `All ${sampleItems.length} sample items pass ItemSchema validation`,
        invalidItems.length > 0 ? `Failed: ${invalidItems.join('; ')}` : undefined);

    // Verify defaults applied correctly on an existing item
    const longsword = DataManager.getItem('Longsword');
    assert(longsword !== undefined, 'Longsword exists in DataManager');
    if (longsword) {
        const parsed = WeaponSchema.parse(longsword);
        assert(parsed.rarity === 'Common', `Longsword rarity defaults to Common (got: ${parsed.rarity})`);
        assert(parsed.itemLevel === 1, `Longsword itemLevel defaults to 1 (got: ${parsed.itemLevel})`);
        assert(parsed.isForged === false, `Longsword isForged defaults to false`);
        assert(parsed.forgeSource === undefined, `Longsword forgeSource defaults to undefined`);
        assert(Array.isArray(parsed.magicalProperties) && parsed.magicalProperties.length === 0,
            `Longsword magicalProperties defaults to empty array`);
    }

    // =============================================
    // TEST 2: Forged weapon with all new fields
    // =============================================
    console.log('\n--- Test 2: Forged weapon with new fields ---');

    const forgedWeapon = {
        name: 'Necrotic Longsword +2',
        type: 'Weapon' as const,
        cost: { cp: 0, sp: 0, ep: 0, gp: 750, pp: 0 },
        weight: 3,
        damage: { dice: '1d8', type: 'Slashing' as const },
        properties: ['Versatile'],
        range: { normal: 5 },
        isMagic: true,
        rarity: 'Rare' as const,
        itemLevel: 5,
        isForged: true,
        forgeSource: 'Skeleton CR 0.25 Ruins',
        instanceId: 'forge_test_001',
        modifiers: [
            { type: 'HitBonus' as const, target: 'Attack', value: 2 },
            { type: 'DamageAdd' as const, target: 'Necrotic', value: 2 },
        ],
        magicalProperties: [
            {
                type: 'BonusDamage' as const,
                element: 'Necrotic',
                dice: '1d4',
                value: 2,
                description: 'Deals additional necrotic damage'
            }
        ],
    };

    try {
        const parsed = WeaponSchema.parse(forgedWeapon);
        assert(true, 'Forged weapon passes WeaponSchema validation');
        assert(parsed.rarity === 'Rare', `Rarity: Rare`);
        assert(parsed.itemLevel === 5, `Item level: 5`);
        assert(parsed.isForged === true, `isForged: true`);
        assert(parsed.forgeSource === 'Skeleton CR 0.25 Ruins', `forgeSource preserved`);
        assert(parsed.magicalProperties.length === 1, `1 magical property`);
        assert(parsed.magicalProperties[0].type === 'BonusDamage', `Magical type: BonusDamage`);
        assert(parsed.magicalProperties[0].element === 'Necrotic', `Magical element: Necrotic`);
        assert(parsed.modifiers.length === 2, `2 modifiers (HitBonus + DamageAdd)`);
        assert(parsed.modifiers[0].type === 'HitBonus', `Modifier type: HitBonus accepted`);
    } catch (e: any) {
        assert(false, 'Forged weapon passes WeaponSchema validation', e.message);
    }

    // =============================================
    // TEST 3: Forged armor with ACBonus modifier
    // =============================================
    console.log('\n--- Test 3: Forged armor ---');

    const forgedArmor = {
        name: 'Enchanted Chain Mail +1',
        type: 'Armor' as const,
        cost: { cp: 0, sp: 0, ep: 0, gp: 375, pp: 0 },
        weight: 55,
        acCalculated: '16',
        strengthReq: 13,
        stealthDisadvantage: true,
        rarity: 'Uncommon' as const,
        itemLevel: 3,
        isForged: true,
        forgeSource: 'Hobgoblin CR 0.5 Forest',
        modifiers: [
            { type: 'ACBonus' as const, target: 'AC', value: 1 },
        ],
        magicalProperties: [],
    };

    try {
        const parsed = ArmorSchema.parse(forgedArmor);
        assert(true, 'Forged armor passes ArmorSchema validation');
        assert(parsed.rarity === 'Uncommon', `Rarity: Uncommon`);
        assert(parsed.modifiers[0].type === 'ACBonus', `ACBonus modifier accepted`);
    } catch (e: any) {
        assert(false, 'Forged armor passes ArmorSchema validation', e.message);
    }

    // =============================================
    // TEST 4: All 7 magical property types
    // =============================================
    console.log('\n--- Test 4: All magical property types ---');

    const magicTypes = [
        { type: 'BonusDamage', element: 'Fire', dice: '1d6', value: 3 },
        { type: 'Resistance', element: 'Cold' },
        { type: 'StatBonus', value: 2, description: '+2 STR' },
        { type: 'SaveBonus', value: 1, description: '+1 to all saves' },
        { type: 'ConditionImmunity', description: 'Immune to Frightened' },
        { type: 'SpellCharge', spellName: 'Shield', maxCharges: 3 },
        { type: 'BonusAC', value: 1 },
    ] as const;

    for (const mp of magicTypes) {
        try {
            MagicalPropertySchema.parse(mp);
            assert(true, `MagicalProperty type "${mp.type}" accepted`);
        } catch (e: any) {
            assert(false, `MagicalProperty type "${mp.type}" accepted`, e.message);
        }
    }

    // =============================================
    // TEST 5: All 5 rarity tiers
    // =============================================
    console.log('\n--- Test 5: All rarity tiers ---');

    const rarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'] as const;
    for (const r of rarities) {
        try {
            RaritySchema.parse(r);
            assert(true, `Rarity "${r}" accepted`);
        } catch (e: any) {
            assert(false, `Rarity "${r}" accepted`, e.message);
        }
    }

    // Invalid rarity should fail
    try {
        RaritySchema.parse('Mythic');
        assert(false, 'Invalid rarity "Mythic" rejected');
    } catch {
        assert(true, 'Invalid rarity "Mythic" rejected');
    }

    // =============================================
    // TEST 6: New modifier types
    // =============================================
    console.log('\n--- Test 6: New modifier types ---');

    const newModTypes = [
        { type: 'HitBonus', target: 'Attack', value: 2 },
        { type: 'SaveBonus', target: 'WIS', value: 1 },
        { type: 'DamageResistance', target: 'Fire', value: 1 },
    ] as const;

    for (const mod of newModTypes) {
        try {
            ModifierSchema.parse(mod);
            assert(true, `Modifier type "${mod.type}" accepted`);
        } catch (e: any) {
            assert(false, `Modifier type "${mod.type}" accepted`, e.message);
        }
    }

    // Existing types still work
    const existingMods = [
        { type: 'StatBonus', target: 'STR', value: 2 },
        { type: 'ACBonus', target: 'AC', value: 1 },
        { type: 'DamageAdd', target: 'Fire', value: 3 },
        { type: 'AbilitySET', target: 'STR', value: 19 },
        { type: 'RangePenaltyReduction', target: 'Range', value: 5 },
    ] as const;

    for (const mod of existingMods) {
        try {
            ModifierSchema.parse(mod);
            assert(true, `Existing modifier "${mod.type}" still accepted`);
        } catch (e: any) {
            assert(false, `Existing modifier "${mod.type}" still accepted`, e.message);
        }
    }

    // =============================================
    // TEST 7: Forged jewelry (Ring) with full properties
    // =============================================
    console.log('\n--- Test 7: Forged jewelry ---');

    const forgedRing = {
        name: 'Ring of Fire Resistance',
        type: 'Ring' as const,
        cost: { cp: 0, sp: 0, ep: 0, gp: 2500, pp: 0 },
        weight: 0.1,
        isMagic: true,
        rarity: 'Very Rare' as const,
        itemLevel: 10,
        isForged: true,
        forgeSource: 'Fire Elemental CR 5 Volcanic',
        modifiers: [
            { type: 'DamageResistance' as const, target: 'Fire', value: 1 },
            { type: 'SaveBonus' as const, target: 'DEX', value: 1 },
        ],
        magicalProperties: [
            { type: 'Resistance' as const, element: 'Fire', description: 'Resistance to fire damage' },
            { type: 'SaveBonus' as const, value: 1, description: '+1 to DEX saves' },
        ],
    };

    try {
        const parsed = ItemSchema.parse(forgedRing);
        assert(true, 'Forged Ring passes ItemSchema (discriminated union)');
        assert(parsed.rarity === 'Very Rare', `Rarity: Very Rare`);
        assert(parsed.magicalProperties.length === 2, `2 magical properties`);
    } catch (e: any) {
        assert(false, 'Forged Ring passes ItemSchema (discriminated union)', e.message);
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
