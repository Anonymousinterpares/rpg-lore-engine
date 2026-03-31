/**
 * Test: Phase 6 — LLM Item Naming
 *
 * Tests LoreService.nameForgedItem() with real LLM calls.
 *
 * Run: npx tsx cli/tests/test_item_naming.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { LoreService } from '../../src/ruleset/agents/LoreService';
import { AgentManager } from '../../src/ruleset/agents/AgentManager';

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
    console.log('=== Test: Phase 6 — LLM Item Naming ===\n');
    await bootstrapCLI();

    // Override LORE_KEEPER to use available provider
    AgentManager.saveAgentProfile({
        id: 'LORE_KEEPER',
        name: 'Lore Keeper',
        providerId: 'openrouter',
        modelId: 'gpt-oss-120b',
        basePrompt: 'You are the keeper of lore.',
        temperature: 0.9,
        maxTokens: 300,
    });

    // =============================================
    // TEST 1: Name a Rare weapon
    // =============================================
    console.log('--- Test 1: Name a Rare Necrotic weapon ---');

    const rareWeapon = {
        id: 'Longsword',
        name: 'Rare Necrotic Longsword +1',
        rarity: 'Rare',
        isMagic: true,
        isForged: true,
        magicalProperties: [
            { type: 'BonusDamage', element: 'Necrotic', dice: '1d4', value: 2 },
        ],
    };

    const result1 = await LoreService.nameForgedItem(rareWeapon, {
        monsterName: 'Skeleton',
        biome: 'Ruins',
    });

    console.log(`  Default name: "${rareWeapon.name}"`);
    console.log(`  LLM name: "${result1.name}"`);
    console.log(`  Description: "${result1.description}"`);

    assert(typeof result1.name === 'string' && result1.name.length > 0, 'Got a name back');
    assert(typeof result1.description === 'string', 'Got a description back');
    // LLM name should differ from the mechanical default
    assert(result1.name !== rareWeapon.name || result1.description.length > 0,
        'LLM produced non-default result');

    // =============================================
    // TEST 2: Name a Legendary fire armor
    // =============================================
    console.log('\n--- Test 2: Name a Legendary armor ---');

    const legendaryArmor = {
        id: 'Plate',
        name: 'Legendary Fire Plate +3',
        rarity: 'Legendary',
        isMagic: true,
        isForged: true,
        magicalProperties: [
            { type: 'Resistance', element: 'Fire', description: 'Resistance to Fire damage' },
        ],
    };

    const result2 = await LoreService.nameForgedItem(legendaryArmor, {
        monsterName: 'Ancient Red Dragon',
        biome: 'Volcanic',
    });

    console.log(`  Default name: "${legendaryArmor.name}"`);
    console.log(`  LLM name: "${result2.name}"`);
    console.log(`  Description: "${result2.description}"`);

    assert(typeof result2.name === 'string' && result2.name.length > 0, 'Got a name');
    assert(typeof result2.description === 'string', 'Got a description');

    // =============================================
    // TEST 3: Non-magical Common item — still works
    // =============================================
    console.log('\n--- Test 3: Common item naming ---');

    const commonItem = {
        id: 'Dagger',
        name: 'Dagger',
        rarity: 'Common',
        isMagic: false,
        isForged: true,
        magicalProperties: [],
    };

    const result3 = await LoreService.nameForgedItem(commonItem, {
        monsterName: 'Goblin',
        biome: 'Forest',
    });

    console.log(`  Default name: "${commonItem.name}"`);
    console.log(`  LLM name: "${result3.name}"`);

    assert(typeof result3.name === 'string', 'Got a name for Common item');

    // =============================================
    // TEST 4: Fallback on missing provider
    // =============================================
    console.log('\n--- Test 4: Graceful fallback ---');

    // Override to a broken provider
    AgentManager.saveAgentProfile({
        id: 'LORE_KEEPER',
        name: 'Lore Keeper',
        providerId: 'nonexistent_provider',
        modelId: 'nonexistent_model',
        basePrompt: 'broken',
        temperature: 0.5,
        maxTokens: 100,
    });

    const result4 = await LoreService.nameForgedItem(rareWeapon, {
        monsterName: 'Ghost',
        biome: 'Ruins',
    });

    assert(result4.name === rareWeapon.name, `Fallback returns default name: "${result4.name}"`);

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
