/**
 * Test: Trade System Analysis — Pre-Phase 9
 *
 * Tests the entire trade pipeline without LLM dependency.
 * Manually creates a merchant NPC and exercises all trade commands.
 *
 * Run: npx tsx cli/tests/test_trade_system.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { ShopEngine } from '../../src/ruleset/combat/ShopEngine';
import { CurrencyEngine } from '../../src/ruleset/combat/CurrencyEngine';
import { DataManager } from '../../src/ruleset/data/DataManager';
import { ItemForgeEngine } from '../../src/ruleset/combat/ItemForgeEngine';
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
    console.log('=== Trade System Analysis ===\n');
    const root = await bootstrapCLI();

    const state = createQuickCharacter({ name: 'Trader', className: 'Rogue', backgroundName: 'Criminal' });
    const gl = new GameLoop(state, path.join(root, 'saves', 'test_trade'), new FileStorageProvider());
    await gl.initialize();
    const gs = gl.getState();

    // =============================================
    // 1. Manually create a merchant NPC in the current hex
    // =============================================
    console.log('--- 1. Setup: Create merchant in current hex ---');

    const merchantNpc: any = {
        id: 'test_merchant_01',
        name: 'Grimjaw the Trader',
        isMerchant: true,
        role: 'Merchant',
        traits: ['Stubborn'],
        stats: { STR: 10, DEX: 10, CON: 10, INT: 12, WIS: 14, CHA: 10 },
        relationship: { standing: 0, interactionLog: [], lastInteraction: '' },
        shopState: {
            inventory: ['Longsword', 'Chain Mail', 'Shield', 'Torch', 'Rations (1 day)', 'Shortbow'],
            soldByPlayer: [],
            lastHaggleFailure: {},
            markup: 1.1,
            discount: 0.0,
            isOpen: true,
            gold: 100,
        },
        personality: { traits: [], ideals: '', bonds: '', flaws: '' },
        dialogue: { greeting: 'Welcome!', topics: [] },
        currentHexId: gs.location.hexId,
    };
    gs.worldNpcs.push(merchantNpc);

    // Register NPC in the hex
    const hex = gs.worldMap.hexes[gs.location.hexId];
    if (hex) {
        if (!hex.npcs) hex.npcs = [];
        hex.npcs.push('test_merchant_01');
    }

    assert(gs.worldNpcs.some((n: any) => n.id === 'test_merchant_01'), 'Merchant NPC created');

    // Give player some gold
    gs.character.inventory.gold = { cp: 0, sp: 0, ep: 0, gp: 500, pp: 0 };
    console.log(`  Player gold: ${gs.character.inventory.gold.gp}gp`);

    // =============================================
    // 2. Open trade
    // =============================================
    console.log('\n--- 2. Open trade ---');
    let r = await gl.processTurn('/trade test_merchant_01');
    console.log(`  Result: ${r}`);
    assert(gs.activeTradeNpcId === 'test_merchant_01', 'activeTradeNpcId set');

    // =============================================
    // 3. Buy an item
    // =============================================
    console.log('\n--- 3. Buy item ---');
    const goldBefore = gs.character.inventory.gold.gp;
    r = await gl.processTurn('/buy Longsword');
    console.log(`  Result: ${r}`);
    const goldAfter = gs.character.inventory.gold;
    const boughtItem = gs.character.inventory.items.find((i: any) => i.name === 'Longsword' || i.id === 'Longsword');
    assert(boughtItem !== undefined, 'Longsword in player inventory after buy');
    console.log(`  Gold: ${goldBefore}gp → ${CurrencyEngine.format(goldAfter)}`);

    // Verify merchant lost the item
    assert(!merchantNpc.shopState.inventory.includes('Longsword'), 'Longsword removed from merchant');

    // =============================================
    // 4. Sell an item
    // =============================================
    console.log('\n--- 4. Sell item ---');
    // Add a dagger to player inventory
    gs.character.inventory.items.push({
        id: 'Dagger', instanceId: 'sell_test_001', name: 'Dagger',
        type: 'Weapon', weight: 1, quantity: 1, equipped: false,
    });
    const goldBeforeSell = CurrencyEngine.toCopper(gs.character.inventory.gold);
    r = await gl.processTurn('/sell Dagger');
    console.log(`  Result: ${r}`);
    const goldAfterSell = CurrencyEngine.toCopper(gs.character.inventory.gold);
    assert(goldAfterSell > goldBeforeSell, `Gold increased: ${goldBeforeSell}cp → ${goldAfterSell}cp`);

    // Verify buyback tracking
    const buybackEntry = merchantNpc.shopState.soldByPlayer.find((s: any) => s.itemId === 'Dagger');
    assert(buybackEntry !== undefined, 'Buyback entry created');
    assert(buybackEntry?.buybackEligible === true, 'Buyback eligible');

    // =============================================
    // 5. Buyback
    // =============================================
    console.log('\n--- 5. Buyback ---');
    r = await gl.processTurn('/buyback Dagger');
    console.log(`  Result: ${r}`);
    const hasDagger = gs.character.inventory.items.some((i: any) => i.name === 'Dagger');
    assert(hasDagger, 'Dagger returned to inventory via buyback');

    // =============================================
    // 6. Haggle
    // =============================================
    console.log('\n--- 6. Haggle ---');
    r = await gl.processTurn('/haggle Torch');
    console.log(`  Result: ${r}`);
    assert(typeof r === 'string' && r.length > 0, 'Haggle returned message');

    // =============================================
    // 7. Intimidate
    // =============================================
    console.log('\n--- 7. Intimidate ---');
    const standingBefore = merchantNpc.relationship.standing;
    r = await gl.processTurn('/intimidate');
    console.log(`  Result: ${r}`);
    console.log(`  Standing: ${standingBefore} → ${merchantNpc.relationship.standing}`);
    assert(merchantNpc.relationship.standing !== standingBefore, 'Standing changed after intimidate');

    // =============================================
    // 8. Deceive
    // =============================================
    console.log('\n--- 8. Deceive ---');
    r = await gl.processTurn('/deceive');
    console.log(`  Result: ${r}`);
    assert(typeof r === 'string' && r.length > 0, 'Deceive returned message');

    // =============================================
    // 9. Close trade
    // =============================================
    console.log('\n--- 9. Close trade ---');
    r = await gl.processTurn('/closetrade');
    console.log(`  Result: ${r}`);
    assert(gs.activeTradeNpcId === null || gs.activeTradeNpcId === undefined, 'activeTradeNpcId cleared');

    // =============================================
    // 10. Sell a FORGED item — test pricing
    // =============================================
    console.log('\n--- 10. Sell forged item (rarity pricing) ---');

    const origRoll = ItemForgeEngine.rollRarity;
    ItemForgeEngine.rollRarity = () => 'Rare';
    const forgedWeapon = ItemForgeEngine.forgeItem({
        category: 'weapon', baseItemName: 'Longsword', cr: 8,
        monsterType: 'undead', biome: 'Ruins', monsterName: 'Vampire',
    });
    ItemForgeEngine.rollRarity = origRoll;

    gs.character.inventory.items.push({
        ...forgedWeapon,
        instanceId: 'forge_sell_test',
        equipped: false,
    } as any);

    // Reopen trade
    await gl.processTurn('/trade test_merchant_01');

    const forgedCostGP = forgedWeapon.cost.gp;
    const baseLongswordGP = DataManager.getItem('Longsword')?.cost.gp || 15;
    console.log(`  Base Longsword: ${baseLongswordGP}gp`);
    console.log(`  Forged (Rare): ${forgedCostGP}gp (should be ${baseLongswordGP * 50}gp)`);
    assert(forgedCostGP === baseLongswordGP * 50, `Forged cost = base * 50 (Rare multiplier)`);

    r = await gl.processTurn('/sell ' + forgedWeapon.name);
    console.log(`  Sell result: ${r}`);

    await gl.processTurn('/closetrade');

    // =============================================
    // 11. Edge case: trade without active merchant
    // =============================================
    console.log('\n--- 11. Edge cases ---');
    r = await gl.processTurn('/buy Torch');
    assert(r?.includes('not trading') || r?.includes('No active') || r?.includes('trade'), 'Buy without active trade fails gracefully');

    r = await gl.processTurn('/trade nonexistent_npc');
    assert(r?.includes('not found') || r?.includes('No such'), 'Trade with nonexistent NPC fails');

    r = await gl.processTurn('/sell NonexistentSword');
    assert(r?.includes('not trading') || r?.includes('No active') || r?.includes("don't have"), 'Sell non-owned item fails');

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
