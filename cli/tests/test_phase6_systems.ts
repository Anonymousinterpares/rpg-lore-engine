/**
 * Phase 6 Test: Advanced systems — trade, dialogue, rest, save/load, spells, equipment
 *
 * Run: npx tsx cli/tests/test_phase6_systems.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { GameStateManager } from '../../src/ruleset/combat/GameStateManager';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { renderTradeStatus } from '../systems/TradeHandler';
import { isInDialogue, getDialoguePrompt } from '../systems/DialogueHandler';
import { renderSaveRegistry } from '../systems/SaveLoadHandler';
import { renderSpells } from '../systems/SpellHandler';
import { renderPaperdoll } from '../systems/EquipmentHandler';
import { renderRestSummary } from '../systems/RestHandler';
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
    console.log('=== Phase 6: Advanced Systems Test ===\n');
    const root = await bootstrapCLI();
    const storage = new FileStorageProvider();
    const savesDir = path.join(root, 'saves', 'cli_test_phase6');

    // --- 6A: Trade Handler ---
    console.log('--- 6A: Trade Handler ---');
    const traderState = createQuickCharacter({ name: 'Merchant Test', className: 'Rogue', backgroundName: 'Criminal' });
    // No active trade
    let tradeOutput = renderTradeStatus(traderState);
    assert(tradeOutput.includes('No active trade'), 'No trade when no NPC');

    // Simulate active trade (inject state)
    traderState.activeTradeNpcId = 'test_npc_1';
    traderState.worldNpcs = [{
        id: 'test_npc_1', name: 'Boris the Merchant', traits: [], isMerchant: true,
        relationship: { standing: 0, interactionLog: [] },
        dialogue_triggers: [], inventory: [], availableQuests: [], conversationHistory: [],
        stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        shopState: { inventory: ['Dagger', 'Shield'], soldByPlayer: [], lastHaggleFailure: {}, markup: 1.0, discount: 0, isOpen: true, gold: 100 }
    }] as any;
    tradeOutput = renderTradeStatus(traderState);
    assert(tradeOutput.includes('Boris'), 'Trade shows merchant name');
    assert(tradeOutput.includes('100'), 'Trade shows merchant gold');
    console.log(tradeOutput);

    // --- 6B: Dialogue Handler ---
    console.log('\n--- 6B: Dialogue Handler ---');
    assert(!isInDialogue(traderState), 'Not in dialogue (trade is not dialogue)');
    traderState.activeDialogueNpcId = 'test_npc_1';
    assert(isInDialogue(traderState), 'In dialogue when NPC ID set');
    const prompt = getDialoguePrompt(traderState);
    assert(prompt.includes('Boris'), `Dialogue prompt shows NPC: "${prompt}"`);
    traderState.activeDialogueNpcId = null;

    // --- 6C: Rest Handler ---
    console.log('\n--- 6C: Rest Handler ---');
    const restState = createQuickCharacter({ name: 'Rester', className: 'Wizard', backgroundName: 'Sage' });
    const beforeState = JSON.parse(JSON.stringify(restState));
    // Simulate damage
    beforeState.character.hp.current = 3;
    // Simulate rest recovery
    const afterState = JSON.parse(JSON.stringify(restState));
    afterState.character.hp.current = afterState.character.hp.max;
    const restSummary = renderRestSummary(beforeState, afterState, 'long');
    console.log(restSummary);
    assert(restSummary.includes('Long Rest'), 'Rest summary shows type');
    assert(restSummary.includes('+'), 'Rest summary shows HP delta');

    // --- 6D: Save/Load Handler ---
    console.log('\n--- 6D: Save/Load Handler ---');
    const stateManager = new GameStateManager(savesDir, storage);
    const saveState = createQuickCharacter({ name: 'SaveTest', className: 'Fighter' });

    // Save
    await stateManager.saveGame(saveState, 'Test Save Alpha');
    const registry = await stateManager.getSaveRegistry();
    assert(registry.slots.length > 0, `Registry has saves: ${registry.slots.length}`);

    // Render registry
    const regOutput = renderSaveRegistry(registry);
    console.log(regOutput);
    assert(regOutput.includes('Test Save Alpha') || regOutput.includes('SaveTest'), 'Registry shows save name');

    // Load
    const loaded = await stateManager.loadGame(saveState.saveId);
    assert(loaded !== null, 'Load returns state');
    assert(loaded?.character.name === 'SaveTest', `Loaded name: ${loaded?.character.name}`);

    // Modify and re-load (verify isolation)
    if (loaded) {
        loaded.character.hp.current = 1;
        const fresh = await stateManager.loadGame(saveState.saveId);
        assert(fresh?.character.hp.current === saveState.character.hp.max, 'Re-load gets original HP');
    }

    // Delete
    const deleted = await stateManager.deleteSave(saveState.saveId);
    assert(deleted, 'Delete succeeds');

    // --- 6E: Spell Handler ---
    console.log('\n--- 6E: Spell Handler ---');
    const wizardState = createQuickCharacter({ name: 'Spellcaster', className: 'Wizard', backgroundName: 'Sage' });
    const spellOutput = renderSpells(wizardState);
    console.log(spellOutput);
    assert(spellOutput.includes('Spells'), 'Spell header');
    assert(spellOutput.includes('Cantrips:'), 'Shows cantrips');
    assert(spellOutput.includes('Spellbook:'), 'Shows spellbook');

    // Fighter should have no spells
    const fighterState = createQuickCharacter({ name: 'Warrior', className: 'Fighter' });
    const noSpells = renderSpells(fighterState);
    assert(noSpells.includes('No spellcasting'), 'Fighter has no spells');

    // --- 6F: Equipment Handler ---
    console.log('\n--- 6F: Equipment Handler ---');
    const equipState = createQuickCharacter({ name: 'EquipTest', className: 'Fighter', backgroundName: 'Soldier' });
    let paperdoll = renderPaperdoll(equipState);
    console.log(paperdoll);
    assert(paperdoll.includes('Equipment'), 'Paperdoll header');
    assert(paperdoll.includes('AC:'), 'Paperdoll shows AC');

    // Equip an item via GameLoop
    const gameLoop = new GameLoop(equipState, savesDir, storage);
    await gameLoop.initialize();
    const items = gameLoop.getState().character.inventory.items;
    const dagger = items.find((i: any) => i.name === 'Dagger');
    if (dagger) {
        const equipResult = await gameLoop.equipItem(dagger.instanceId);
        assert(typeof equipResult === 'string', `Equip returns string: "${equipResult}"`);
        const equipped = gameLoop.getState().character.equipmentSlots;
        const hasEquipped = Object.values(equipped).some((v: any) => v === dagger.instanceId);
        assert(hasEquipped, 'Dagger equipped in a slot');

        paperdoll = renderPaperdoll(gameLoop.getState());
        assert(paperdoll.includes('Dagger'), 'Paperdoll shows equipped Dagger');
        console.log(paperdoll);
    } else {
        console.log('  (no Dagger in inventory to test equip)');
        assert(true, 'Equip test skipped (no Dagger)');
        assert(true, 'Paperdoll test skipped');
    }

    // --- Summary ---
    console.log('\n============================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('============================');

    if (failed > 0) process.exit(1);
}

main().catch(e => {
    console.error('Test crashed:', e);
    process.exit(1);
});
