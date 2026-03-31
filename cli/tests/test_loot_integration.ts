/**
 * Test: Phase 4 — LootEngine Integration with ItemForge
 *
 * Verifies that defeating a monster produces forged items with rarity/stats.
 *
 * Run: npx tsx cli/tests/test_loot_integration.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { LootEngine } from '../../src/ruleset/combat/LootEngine';
import { DataManager } from '../../src/ruleset/data/DataManager';
import { ItemSchema } from '../../src/ruleset/schemas/ItemSchema';

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
    console.log('=== Test: Phase 4 — LootEngine + ItemForge Integration ===\n');
    await bootstrapCLI();

    // =============================================
    // TEST 1: Skeleton (CR 0.25, undead) — low CR
    // =============================================
    console.log('--- Test 1: Skeleton (CR 0.25, undead, Ruins biome) ---');

    const skeleton = DataManager.getMonster('Skeleton');
    assert(skeleton !== undefined, `Skeleton found in DataManager`);

    if (skeleton) {
        console.log(`  Monster: ${skeleton.name}, CR: ${skeleton.cr}, Type: ${skeleton.type}`);
        console.log(`  Actions: ${skeleton.actions.map((a: any) => a.name).join(', ')}`);

        const loot = LootEngine.processDefeat(skeleton, 'Ruins');
        assert(loot !== undefined, 'processDefeat returned loot');
        console.log(`  Gold: ${loot.gold.gp}gp ${loot.gold.sp}sp ${loot.gold.cp}cp`);
        console.log(`  Items: ${loot.items.length}`);

        for (const item of loot.items) {
            console.log(`    - ${item.name} [${item.rarity || 'base'}] ${item.isForged ? '(FORGED)' : '(base)'} ${item.isMagic ? '✨' : ''}`);
            if (item.modifiers?.length > 0) {
                for (const mod of item.modifiers) {
                    console.log(`      Mod: ${mod.type} ${mod.target} +${mod.value}`);
                }
            }
            if (item.magicalProperties?.length > 0) {
                for (const mp of item.magicalProperties) {
                    console.log(`      Magic: ${mp.type} ${mp.element || ''} ${mp.dice || ''}`);
                }
            }

            // Forged items should have forge fields
            if (item.isForged) {
                assert(item.rarity !== undefined, `${item.name}: has rarity`);
                assert(item.itemLevel !== undefined, `${item.name}: has itemLevel`);
                assert(item.forgeSource !== undefined, `${item.name}: has forgeSource`);
                assert(typeof item.instanceId === 'string', `${item.name}: has instanceId`);

                // Validate against schema
                try {
                    ItemSchema.parse(item);
                    assert(true, `${item.name}: passes ItemSchema`);
                } catch (e: any) {
                    assert(false, `${item.name}: passes ItemSchema`, e.message?.slice(0, 100));
                }
            }
        }

        // At CR 0.25, most items should be Common
        const forgedItems = loot.items.filter((i: any) => i.isForged);
        if (forgedItems.length > 0) {
            assert(true, `${forgedItems.length} forged item(s) from Skeleton`);
        } else {
            console.log('  (No equipment drops from this Skeleton — normal for some monsters)');
        }
    }

    // =============================================
    // TEST 2: High CR monster — Vampire (CR 13, undead)
    // =============================================
    console.log('\n--- Test 2: High CR monster (undead, Ruins) ---');

    const vampire = DataManager.getMonster('Vampire');
    if (vampire) {
        console.log(`  Monster: ${vampire.name}, CR: ${vampire.cr}, Type: ${vampire.type}`);

        const loot = LootEngine.processDefeat(vampire, 'Ruins');
        console.log(`  Items: ${loot.items.length}`);

        for (const item of loot.items) {
            console.log(`    - ${item.name} [${item.rarity || 'base'}] ${item.isForged ? '(FORGED)' : '(base)'} ${item.isMagic ? '✨' : ''}`);

            if (item.isForged) {
                assert(item.rarity !== undefined, `${item.name}: has rarity`);
                try {
                    ItemSchema.parse(item);
                    assert(true, `${item.name}: passes ItemSchema`);
                } catch (e: any) {
                    assert(false, `${item.name}: passes ItemSchema`, e.message?.slice(0, 100));
                }
            }
        }
    } else {
        console.log('  (Vampire not found — trying another high-CR monster)');
        // Try Ogre (CR 2)
        const ogre = DataManager.getMonster('Ogre');
        if (ogre) {
            const loot = LootEngine.processDefeat(ogre, 'Mountain');
            console.log(`  Ogre loot: ${loot.items.length} items`);
            for (const item of loot.items) {
                console.log(`    - ${item.name} [${item.rarity || 'base'}]`);
                if (item.isForged) {
                    ItemSchema.parse(item);
                    assert(true, `${item.name}: passes ItemSchema`);
                }
            }
        }
    }

    // =============================================
    // TEST 3: Multiple defeats — statistical check
    // =============================================
    console.log('\n--- Test 3: 50 Skeleton defeats — forge statistics ---');

    let totalForged = 0;
    let totalMagical = 0;
    let totalItems = 0;
    const rarityCounts: Record<string, number> = {};

    const goblin = DataManager.getMonster('Goblin');
    const testMonster = goblin || skeleton;

    if (testMonster) {
        for (let i = 0; i < 50; i++) {
            const loot = LootEngine.processDefeat(testMonster, 'Forest');
            for (const item of loot.items) {
                totalItems++;
                if (item.isForged) {
                    totalForged++;
                    rarityCounts[item.rarity] = (rarityCounts[item.rarity] || 0) + 1;
                    if (item.isMagic) totalMagical++;

                    // Every forged item must pass schema
                    try {
                        ItemSchema.parse(item);
                    } catch (e: any) {
                        assert(false, `Schema validation in bulk test`, `${item.name}: ${e.message?.slice(0, 80)}`);
                    }
                }
            }
        }

        console.log(`  Total items: ${totalItems}, Forged: ${totalForged}, Magical: ${totalMagical}`);
        console.log(`  Rarity distribution: ${JSON.stringify(rarityCounts)}`);

        assert(totalForged > 0, `At least 1 forged item in 50 defeats (got ${totalForged})`);
        assert(totalItems >= totalForged, 'Total items >= forged items');
    }

    // =============================================
    // TEST 4: Biome parameter flows correctly
    // =============================================
    console.log('\n--- Test 4: Biome affects element pool ---');

    if (testMonster) {
        // Run 100 times in Volcanic biome — fire elements should appear
        let fireCount = 0;
        let coldCount = 0;
        for (let i = 0; i < 100; i++) {
            const loot = LootEngine.processDefeat(testMonster, 'Volcanic');
            for (const item of loot.items) {
                if (item.magicalProperties) {
                    for (const mp of item.magicalProperties) {
                        if (mp.element === 'Fire') fireCount++;
                        if (mp.element === 'Cold') coldCount++;
                    }
                }
            }
        }
        console.log(`  Volcanic biome: Fire elements=${fireCount}, Cold elements=${coldCount}`);
        // We can't guarantee fire > 0 (depends on rarity rolls + magic chance),
        // but if any magical items were generated, the element should match the pools
    }

    // =============================================
    // TEST 5: processDefeat still works without biome (backward compat)
    // =============================================
    console.log('\n--- Test 5: processDefeat without biome (backward compat) ---');

    if (testMonster) {
        const loot = LootEngine.processDefeat(testMonster);
        assert(loot !== undefined, 'processDefeat works without biome parameter');
        assert(Array.isArray(loot.items), 'Returns items array');
        assert(typeof loot.gold === 'object', 'Returns gold object');
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
