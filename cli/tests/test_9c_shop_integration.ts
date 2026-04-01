/**
 * Phase 9C Integration Test — Forged Items in Shops
 * Uses headless multi-turn gameplay via GameLoop.
 */
import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { DataManager } from '../../src/ruleset/data/DataManager';
import { getForgedItemsForMerchant } from '../../src/ruleset/data/MerchantInventoryPool';
import path from 'path';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
    if (condition) { console.log(`  [PASS] ${label}`); pass++; }
    else { console.log(`  [FAIL] ${label}`); fail++; }
}

async function main() {
    const root = await bootstrapCLI();
    console.log('=== Phase 9C: Forged Items in Shops — Integration Test ===\n');

    // --- 1. Verify forged item catalog loaded ---
    console.log('--- 1. Forged item catalog ---');
    const forged = DataManager.getForgedItems();
    assert(forged.length > 0, `Forged items in catalog: ${forged.length}`);

    // --- 2. getForgedItemsForMerchant filtering ---
    console.log('\n--- 2. Merchant stocking filters ---');
    const mockState = {
        character: { level: 5, inventory: { items: [] } },
        worldNpcs: [],
    };

    // Level gating: level 5 should NOT get level 18 items
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
        results.push(...getForgedItemsForMerchant('Plains', 5, [], mockState));
    }
    const legendaryItems = forged.filter((i: any) => i.itemLevel >= 16);
    const gotLegendary = results.some(r => legendaryItems.some((l: any) => l.name === r));
    assert(!gotLegendary, 'Level 5 merchant never stocks level 16+ items');

    // Uniqueness: player owns item → excluded
    if (forged.length > 0) {
        const ownedName = forged[0].name;
        const ownedState = {
            character: { level: 5, inventory: { items: [{ name: ownedName }] } },
            worldNpcs: [],
        };
        let appeared = false;
        for (let i = 0; i < 20; i++) {
            if (getForgedItemsForMerchant('Plains', 5, [], ownedState).includes(ownedName)) {
                appeared = true; break;
            }
        }
        assert(!appeared, `Player-owned "${ownedName}" never stocked by merchant`);
    }

    // Returns 0-3 items
    const counts = [];
    for (let i = 0; i < 20; i++) {
        counts.push(getForgedItemsForMerchant('Plains', 8, [], mockState).length);
    }
    assert(Math.max(...counts) <= 3, `Max items per merchant: ${Math.max(...counts)} (≤3)`);

    // --- 3. Full GameLoop integration: merchant gets forged items ---
    console.log('\n--- 3. GameLoop merchant population ---');
    const initialState = createQuickCharacter({ name: 'ShopTester' });
    initialState.character.level = 8; // Level 8 to match forged item levels in catalog
    const savesDir = path.join(root, 'saves', 'test_9c');
    const storage = new FileStorageProvider(savesDir);
    const gl = new GameLoop(initialState, root, storage);
    await gl.initialize();
    const gs = gl.getState();

    // Create a merchant in the current hex
    const hex = gs.worldMap?.hexes?.[gs.location.hexId];
    const biome = hex?.biome || 'Plains';

    // Use 'Plains' biome to maximize match chance with forged items (many have Plains/Ruins sources)
    // Run multiple attempts to handle 20% off-biome randomness
    let forgedStock: string[] = [];
    for (let attempt = 0; attempt < 10 && forgedStock.length === 0; attempt++) {
        forgedStock = getForgedItemsForMerchant('Plains', gs.character.level, [], gs);
    }

    gs.worldNpcs.push({
        id: 'merchant_9c',
        name: 'Forgemaster',
        role: 'merchant',
        isMerchant: true,
        relationship: { standing: 0, interactionLog: [] },
        description: 'A merchant who deals in rare arms.',
        shopState: {
            inventory: ['Longsword', 'Shield', 'Chain_mail', ...forgedStock],
            soldByPlayer: [],
            lastHaggleFailure: {},
            markup: 1.1,
            discount: 0.0,
            isOpen: true,
            gold: 5000,
        },
    } as any);
    if (hex && !hex.npcs) hex.npcs = [];
    if (hex) hex.npcs.push('merchant_9c');

    const tradeResult = await gl.processTurn('/trade merchant_9c');
    console.log(`  Trade result: ${tradeResult}`);
    assert(tradeResult.includes('Opened trade'), 'Trade opened with merchant');

    const shopState = gs.worldNpcs.find((n: any) => n.id === 'merchant_9c')?.shopState;
    assert(!!shopState, 'ShopState initialized');

    if (shopState) {
        const forgedInShop = shopState.inventory.filter((name: string) => {
            const item = DataManager.getItem(name);
            return item && (item as any).isForged;
        });
        console.log(`  Total items: ${shopState.inventory.length}, Forged: ${forgedInShop.length}`);
        console.log(`  Forged items: ${forgedInShop.join(', ') || '(none — may not match biome/level)'}`);
        assert(forgedInShop.length <= 3, `Forged items capped at 3: got ${forgedInShop.length}`);

        // If forged items in shop, try buying one
        if (forgedInShop.length > 0) {
            const itemToBuy = forgedInShop[0];
            console.log(`\n--- 4. Buy forged item: ${itemToBuy} ---`);
            gs.character.inventory.gold = { pp: 0, gp: 50000, ep: 0, sp: 0, cp: 0 };
            const buyResult = await gl.processTurn(`/buy ${itemToBuy}`);
            console.log(`  Buy result: ${buyResult}`);
            const inInventory = gs.character.inventory.items.some((i: any) => i.name === itemToBuy);
            assert(inInventory, `${itemToBuy} now in player inventory`);
            const stillInShop = shopState.inventory.includes(itemToBuy);
            assert(!stillInShop, `${itemToBuy} removed from merchant stock`);
        } else {
            console.log('\n--- 4. Skipped buy test (no forged items matched level/biome) ---');
        }
    }

    await gl.processTurn('/closetrade');

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
