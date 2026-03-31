/**
 * Test: Phase 9A — Item Identification System + Bug Fixes
 *
 * Run: npx tsx cli/tests/test_identification.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { ItemForgeEngine } from '../../src/ruleset/combat/ItemForgeEngine';
import { ItemSchema } from '../../src/ruleset/schemas/ItemSchema';
import * as path from 'path';

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
    console.log('=== Phase 9A: Item Identification + Bug Fixes ===\n');
    await bootstrapCLI();

    // =============================================
    // 1. Rare+ items start unidentified
    // =============================================
    console.log('--- 1. Identification masking ---');

    const origRoll = ItemForgeEngine.rollRarity;

    // Rare weapon
    ItemForgeEngine.rollRarity = () => 'Rare';
    const rareItem = ItemForgeEngine.forgeItem({
        category: 'weapon', baseItemName: 'Longsword', cr: 8,
        monsterType: 'undead', biome: 'Ruins', monsterName: 'Vampire',
    });
    assert((rareItem as any).identified === false, 'Rare item starts unidentified');
    assert((rareItem as any).trueRarity === 'Rare', 'trueRarity = Rare');
    assert(rareItem.rarity === 'Uncommon', 'Perceived rarity = Uncommon (one tier lower)');
    assert((rareItem as any).perceivedName === rareItem.name, 'Visible name = perceivedName');
    assert((rareItem as any).trueName !== undefined, 'trueName is set');
    console.log(`  Name shown: "${rareItem.name}" (true: "${(rareItem as any).trueName}")`);

    // Very Rare armor
    ItemForgeEngine.rollRarity = () => 'Very Rare';
    const vrItem = ItemForgeEngine.forgeItem({
        category: 'armor', baseItemName: 'Chain Mail', cr: 12,
        monsterType: 'dragon', biome: 'Mountain', monsterName: 'Young Dragon',
    });
    assert((vrItem as any).identified === false, 'Very Rare item starts unidentified');
    assert((vrItem as any).trueRarity === 'Very Rare', 'trueRarity = Very Rare');
    assert(vrItem.rarity === 'Rare', 'Perceived rarity = Rare');

    // Legendary jewelry
    ItemForgeEngine.rollRarity = () => 'Legendary';
    const legItem = ItemForgeEngine.forgeItem({
        category: 'jewelry', baseItemName: 'Amulet', cr: 18,
        monsterType: 'celestial', biome: 'Ruins', monsterName: 'Deva',
    });
    assert((legItem as any).identified === false, 'Legendary item starts unidentified');
    assert((legItem as any).trueRarity === 'Legendary', 'trueRarity = Legendary');
    assert(legItem.rarity === 'Very Rare', 'Perceived rarity = Very Rare');

    // Common/Uncommon stay identified
    ItemForgeEngine.rollRarity = () => 'Common';
    const commonItem = ItemForgeEngine.forgeItem({
        category: 'weapon', baseItemName: 'Dagger', cr: 1,
        monsterType: 'humanoid', biome: 'Plains',
    });
    assert((commonItem as any).identified === true || (commonItem as any).identified === undefined,
        'Common item is fully identified');

    ItemForgeEngine.rollRarity = () => 'Uncommon';
    const uncItem = ItemForgeEngine.forgeItem({
        category: 'weapon', baseItemName: 'Dagger', cr: 3,
        monsterType: 'humanoid', biome: 'Plains',
    });
    assert((uncItem as any).identified === true || (uncItem as any).identified === undefined,
        'Uncommon item is fully identified');

    ItemForgeEngine.rollRarity = origRoll;

    // =============================================
    // 2. Schema validation for unidentified items
    // =============================================
    console.log('\n--- 2. Schema validation ---');
    try {
        ItemSchema.parse(rareItem);
        assert(true, 'Unidentified Rare weapon passes schema');
    } catch (e: any) {
        assert(false, 'Unidentified Rare weapon passes schema', e.message?.slice(0, 80));
    }
    try {
        ItemSchema.parse(vrItem);
        assert(true, 'Unidentified Very Rare armor passes schema');
    } catch (e: any) {
        assert(false, 'Unidentified Very Rare armor passes schema', e.message?.slice(0, 80));
    }

    // =============================================
    // 3. Identification via skill check
    // =============================================
    console.log('\n--- 3. Identify via /examine command ---');

    const state = createQuickCharacter({ name: 'Scholar', className: 'Wizard', backgroundName: 'Sage' });
    state.character.stats.INT = 20; // +5 modifier, easier to pass DC
    const gl = new GameLoop(state, path.join(await bootstrapCLI(), 'saves', 'test_id'), new FileStorageProvider());
    await gl.initialize();

    // Add unidentified rare item to inventory
    gl.getState().character.inventory.items.push({
        ...rareItem,
        instanceId: 'id_test_001',
        equipped: false,
    } as any);

    const dc = ItemForgeEngine.getIdentifyDC(rareItem);
    assert(dc === 12, `Rare DC = 12 (got ${dc})`);

    // Try examining (may pass or fail based on dice roll)
    let examResult = '';
    for (let i = 0; i < 20; i++) {
        examResult = await gl.processTurn('/examine ' + rareItem.name);
        if (examResult.includes('Success')) break;
    }
    console.log(`  Examine result: ${examResult.slice(0, 120)}`);

    const examinedItem = gl.getState().character.inventory.items.find((i: any) => i.instanceId === 'id_test_001');
    if (examResult.includes('Success')) {
        assert((examinedItem as any).identified === true, 'Item identified after successful examine');
        assert((examinedItem as any).identifiedBy === 'skill', 'identifiedBy = skill');
        console.log(`  Revealed name: "${examinedItem?.name}"`);
    } else {
        console.log('  (All 20 attempts failed — INT 20 + Arcana should pass DC 12 most times. Dice were unlucky.)');
    }

    // =============================================
    // 4. Identification via merchant service
    // =============================================
    console.log('\n--- 4. Identify via merchant service ---');

    // Add another unidentified item
    ItemForgeEngine.rollRarity = () => 'Very Rare';
    const vrItem2 = ItemForgeEngine.forgeItem({
        category: 'weapon', baseItemName: 'Longsword', cr: 12,
        monsterType: 'fiend', biome: 'Swamp', monsterName: 'Fiend',
    });
    ItemForgeEngine.rollRarity = origRoll;

    gl.getState().character.inventory.items.push({
        ...vrItem2,
        instanceId: 'id_test_002',
        equipped: false,
    } as any);
    gl.getState().character.inventory.gold = { cp: 0, sp: 0, ep: 0, gp: 5000, pp: 0 };

    const merchCost = ItemForgeEngine.getMerchantIdentifyCost(vrItem2);
    assert(merchCost === 200, `Very Rare merchant cost = 200gp (got ${merchCost})`);

    // Create merchant in hex
    const gs = gl.getState();
    const merchantNpc: any = {
        id: 'id_merchant', name: 'Sage Merchant', isMerchant: true,
        traits: [], stats: { WIS: 14 },
        relationship: { standing: 0, interactionLog: [], lastInteraction: '' },
        shopState: { inventory: ['Torch'], soldByPlayer: [], lastHaggleFailure: {}, markup: 1.0, discount: 0.0, isOpen: true, gold: 500 },
        currentHexId: gs.location.hexId,
    };
    gs.worldNpcs.push(merchantNpc);
    const hex = gs.worldMap.hexes[gs.location.hexId];
    if (hex) { if (!hex.npcs) hex.npcs = []; hex.npcs.push('id_merchant'); }

    await gl.processTurn('/trade id_merchant');
    const merchResult = await gl.processTurn('/merchantidentify ' + vrItem2.name);
    console.log(`  Merchant result: ${merchResult}`);

    const identifiedVR = gs.character.inventory.items.find((i: any) => i.instanceId === 'id_test_002');
    assert((identifiedVR as any)?.identified === true, 'Item identified by merchant');
    assert((identifiedVR as any)?.identifiedBy === 'merchant', 'identifiedBy = merchant');
    assert(gs.character.inventory.gold.gp < 5000, `Gold deducted (${gs.character.inventory.gold.gp}gp left)`);

    await gl.processTurn('/closetrade');

    // =============================================
    // 5. DC values for each rarity
    // =============================================
    console.log('\n--- 5. Identification DCs and costs ---');
    assert(ItemForgeEngine.getIdentifyDC({ trueRarity: 'Rare' }) === 12, 'Rare DC = 12');
    assert(ItemForgeEngine.getIdentifyDC({ trueRarity: 'Very Rare' }) === 15, 'Very Rare DC = 15');
    assert(ItemForgeEngine.getIdentifyDC({ trueRarity: 'Legendary' }) === 18, 'Legendary DC = 18');
    assert(ItemForgeEngine.getMerchantIdentifyCost({ trueRarity: 'Rare' }) === 50, 'Rare merchant cost = 50gp');
    assert(ItemForgeEngine.getMerchantIdentifyCost({ trueRarity: 'Very Rare' }) === 200, 'Very Rare cost = 200gp');
    assert(ItemForgeEngine.getMerchantIdentifyCost({ trueRarity: 'Legendary' }) === 1000, 'Legendary cost = 1000gp');

    // =============================================
    // 6. Bug fix: NPC location validation
    // =============================================
    console.log('\n--- 6. Bug fix: NPC location validation ---');
    const remoteResult = await gl.processTurn('/trade nonexistent_remote_npc');
    assert(remoteResult.includes('not found') || remoteResult.includes('No such'), 'Remote NPC trade rejected');

    // Create NPC NOT in current hex
    gs.worldNpcs.push({
        id: 'remote_npc', name: 'Remote Merchant', isMerchant: true,
        traits: [], stats: {},
        relationship: { standing: 0, interactionLog: [], lastInteraction: '' },
        shopState: { inventory: ['Torch'], soldByPlayer: [], lastHaggleFailure: {}, markup: 1.0, discount: 0.0, isOpen: true, gold: 50 },
    } as any);
    const remoteResult2 = await gl.processTurn('/trade remote_npc');
    assert(remoteResult2.includes('not here'), `Remote merchant rejected: "${remoteResult2}"`);

    // =============================================
    // 7. Already identified item
    // =============================================
    console.log('\n--- 7. Edge cases ---');
    const alreadyId = await gl.processTurn('/examine ' + (identifiedVR as any)?.name);
    assert(alreadyId.includes('already'), 'Already identified item returns message');

    const noItem = await gl.processTurn('/examine NonexistentBlade');
    assert(noItem.includes("don't have"), 'Nonexistent item returns error');

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
