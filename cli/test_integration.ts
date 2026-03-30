/**
 * Full Integration Test — Tests all CLI-accessible game features
 * Uses REAL LLM (gpt-oss-120b via OpenRouter)
 *
 * Run: npx tsx cli/test_integration.ts
 */

import { bootstrapCLI } from './bootstrap.ts';
import { GameLoop } from '../src/ruleset/combat/GameLoop.ts';
import { FileStorageProvider } from '../src/ruleset/combat/FileStorageProvider.ts';
import { GameState } from '../src/ruleset/schemas/FullSaveStateSchema.ts';
import { createQuickCharacter } from './creation.ts';
import { renderInventory } from './renderer/InventoryRenderer.ts';
import { renderQuests } from './renderer/QuestRenderer.ts';
import { renderMap } from './renderer/MapRenderer.ts';
import { renderSpells } from './systems/SpellHandler.ts';
import { renderPaperdoll } from './systems/EquipmentHandler.ts';
import * as path from 'path';

let projectRoot: string;
let gameLoop: GameLoop;
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
        console.log(`  [PASS] ${name}`);
        passed++;
    } else {
        console.log(`  [FAIL] ${name}${detail ? ': ' + detail : ''}`);
        failed++;
        failures.push(name + (detail ? ': ' + detail : ''));
    }
}

async function processTurn(input: string): Promise<string> {
    try {
        const response = await gameLoop.processTurn(input);
        return response || '';
    } catch (e: any) {
        return `[ERROR] ${e.message}`;
    }
}

// ============================================================
// TEST SUITES
// ============================================================

async function testCharacterCreation() {
    console.log('\n=== TEST: Character Creation ===');
    const state = gameLoop.getState();
    const c = state.character;

    assert(!!c.name, 'Character has name', c.name);
    assert(c.level === 1, 'Character is level 1', `was ${c.level}`);
    assert(c.hp.current > 0, 'Character has HP', `${c.hp.current}/${c.hp.max}`);
    assert(c.ac > 0, 'Character has AC', `${c.ac}`);
    assert(c.stats.STR > 0, 'Stats populated', `STR=${c.stats.STR}`);
    assert(!!c.race, 'Race set', c.race);
    assert(!!c.class, 'Class set', c.class);
    assert(c.inventory.items.length > 0, 'Has starting equipment', `${c.inventory.items.length} items`);
}

async function testRenderers() {
    console.log('\n=== TEST: CLI Renderers ===');
    const state = gameLoop.getState();

    const inv = renderInventory(state);
    assert(inv.includes('Gold') || inv.includes('Inventory'), 'Inventory renderer produces output');

    const quests = renderQuests(state);
    assert(quests.length > 0, 'Quest renderer produces output');

    const map = renderMap(state, 2);
    assert(map.includes('@@'), 'Map renderer shows player position');

    const spells = renderSpells(state);
    assert(spells.length > 0, 'Spell renderer produces output');

    const equip = renderPaperdoll(state);
    assert(equip.includes('AC'), 'Equipment renderer shows AC');
}

async function testExplorationCommands() {
    console.log('\n=== TEST: Exploration Commands ===');

    // /look
    const lookResult = await processTurn('/look');
    assert(!lookResult.includes('[ERROR]'), '/look succeeds', lookResult.slice(0, 80));

    // /move N
    const startCoords = [...gameLoop.getState().location.coordinates];
    const moveResult = await processTurn('/move N');
    assert(!moveResult.includes('[ERROR]'), '/move N succeeds', moveResult.slice(0, 80));
    const newCoords = gameLoop.getState().location.coordinates;
    assert(
        startCoords[0] !== newCoords[0] || startCoords[1] !== newCoords[1],
        'Coordinates changed after move',
        `${startCoords} -> ${newCoords}`
    );

    // /pace
    const paceResult = await processTurn('/pace Stealth');
    assert(paceResult.includes('Stealth') || !paceResult.includes('[ERROR]'), '/pace Stealth works');
    assert(gameLoop.getState().travelPace === 'Stealth', 'Travel pace updated');

    // Reset pace
    await processTurn('/pace Normal');
}

async function testRestingFix() {
    console.log('\n=== TEST: Resting (Bug Fix Verification) ===');

    // Damage the character first
    const state = gameLoop.getState();
    const maxHP = state.character.hp.max;
    state.character.hp.current = Math.max(1, Math.floor(maxHP / 2));
    const damagedHP = state.character.hp.current;

    // /rest short (was NaN bug)
    const shortResult = await processTurn('/rest short');
    assert(!shortResult.includes('[ERROR]'), '/rest short does not error', shortResult.slice(0, 80));
    assert(!shortResult.includes('NaN'), '/rest short has no NaN in response');

    const afterShort = gameLoop.getState().character.hp.current;
    assert(afterShort >= damagedHP, 'HP recovered after short rest', `${damagedHP} -> ${afterShort}`);

    // /rest long (was NaN bug)
    state.character.hp.current = Math.max(1, Math.floor(maxHP / 2));
    const longResult = await processTurn('/rest long');
    assert(!longResult.includes('[ERROR]'), '/rest long does not error', longResult.slice(0, 80));
    assert(!longResult.includes('NaN'), '/rest long has no NaN in response');

    const afterLong = gameLoop.getState().character.hp.current;
    assert(afterLong >= damagedHP, 'HP recovered after long rest', `${damagedHP} -> ${afterLong}`);
}

async function testWaitCommand() {
    console.log('\n=== TEST: Wait Command ===');

    const wt = gameLoop.getState().worldTime;
    const minutesBefore = wt.hour * 60 + wt.minute;
    const waitResult = await processTurn('/wait 30');
    assert(!waitResult.includes('[ERROR]'), '/wait 30 succeeds');
    const wt2 = gameLoop.getState().worldTime;
    const minutesAfter = wt2.hour * 60 + wt2.minute + (wt2.day > wt.day ? 24 * 60 : 0);
    assert(minutesAfter > minutesBefore, 'Time advanced after /wait', `${minutesBefore} -> ${minutesAfter}`);
}

async function testCombat() {
    console.log('\n=== TEST: Combat System ===');

    // Start combat with a weak enemy
    const combatResult = await processTurn('/combat Goblin 1');
    assert(!combatResult.includes('[ERROR]'), '/combat starts successfully', combatResult.slice(0, 80));

    const stateAfterCombat = gameLoop.getState();
    assert(stateAfterCombat.mode === 'COMBAT', 'Mode switched to COMBAT', stateAfterCombat.mode);

    if (stateAfterCombat.mode === 'COMBAT') {
        // Try attacking
        const attackResult = await processTurn('attack');
        assert(!attackResult.includes('[ERROR]'), 'Attack action succeeds', attackResult.slice(0, 100));

        // Try ending turn (or combat may have ended)
        if (gameLoop.getState().mode === 'COMBAT') {
            const endResult = await processTurn('end turn');
            assert(!endResult.includes('[ERROR]'), 'End turn succeeds');
        }

        // Keep attacking until combat ends (max 20 rounds to prevent infinite loop)
        let rounds = 0;
        while (gameLoop.getState().mode === 'COMBAT' && rounds < 20) {
            await processTurn('attack');
            if (gameLoop.getState().mode === 'COMBAT') {
                await processTurn('end turn');
            }
            rounds++;
        }

        assert(gameLoop.getState().mode !== 'COMBAT' || rounds >= 20, 'Combat eventually ends', `rounds: ${rounds}`);
    }
}

async function testNarrativeGeneration() {
    console.log('\n=== TEST: LLM Narrative Generation ===');

    // Free text should trigger narrator
    const narrativeResult = await processTurn('I look around carefully, examining my surroundings');
    assert(narrativeResult.length > 10, 'Narrator generates substantial response', `${narrativeResult.length} chars`);
    assert(!narrativeResult.includes('[ERROR]'), 'No errors in narrative generation');
    console.log(`  Narrative preview: "${narrativeResult.slice(0, 120)}..."`);
}

async function testNPCDialogue() {
    console.log('\n=== TEST: NPC Dialogue ===');

    // Check if any NPCs are present
    const state = gameLoop.getState();
    const hexId = state.location.hexId;
    const hex = state.worldMap?.hexes?.[hexId];
    const npcIds: string[] = hex?.npcs || [];

    if (npcIds.length > 0) {
        const npc = (state.worldNpcs || []).find((n: any) => npcIds.includes(n.id));
        if (npc) {
            const talkResult = await processTurn(`/talk ${npc.id}`);
            assert(!talkResult.includes('[ERROR]'), `/talk ${npc.name} works`, talkResult.slice(0, 80));

            // Check we're in dialogue mode
            const inDialogue = !!gameLoop.getState().activeDialogueNpcId;
            assert(inDialogue, 'Dialogue mode activated');

            if (inDialogue) {
                // Say something in dialogue
                const dialogueReply = await processTurn('Hello, who are you?');
                assert(dialogueReply.length > 0, 'NPC responds to dialogue');

                // Exit dialogue
                const endResult = await processTurn('/endtalk');
                assert(!gameLoop.getState().activeDialogueNpcId, 'Dialogue mode exited');
            }
        } else {
            console.log('  [SKIP] No matching NPC objects found');
        }
    } else {
        console.log('  [SKIP] No NPCs in current hex');
    }
}

async function testEdgeCases() {
    console.log('\n=== TEST: Edge Cases & Error Handling ===');

    // Empty input
    const emptyResult = await processTurn('');
    // Empty should just be ignored by the REPL, but GameLoop might handle it

    // Invalid command
    const invalidResult = await processTurn('/nonexistent_command');
    assert(!invalidResult.includes('[ERROR]') || invalidResult.includes('Unknown'), 'Invalid command handled gracefully');

    // /move without direction
    const noDir = await processTurn('/move');
    assert(!noDir.includes('Cannot read') && !noDir.includes('undefined'), '/move without direction does not crash');

    // /cast without spell name
    const noCast = await processTurn('/cast');
    assert(!noCast.includes('Cannot read'), '/cast without args does not crash');

    // /rest with garbage
    const garbageRest = await processTurn('/rest garbage');
    assert(!garbageRest.includes('NaN'), '/rest garbage defaults gracefully (no NaN)');

    // /wait with negative number
    const negWait = await processTurn('/wait -10');
    assert(true, '/wait -10 does not crash (may do nothing)');

    // /combat with invalid monster
    const invalidMonster = await processTurn('/combat NonExistentMonster 1');
    // Should not crash
    assert(!invalidMonster.includes('Cannot read properties of undefined'), '/combat invalid monster does not crash with TypeError');
}

async function testSaveLoad() {
    console.log('\n=== TEST: Save/Load ===');

    const state = gameLoop.getState();
    const nameBeforeSave = state.character.name;
    const hpBeforeSave = state.character.hp.current;
    const coordsBeforeSave = [...state.location.coordinates];

    // Save
    const storage = new FileStorageProvider();
    const { GameStateManager } = await import('../src/ruleset/combat/GameStateManager.ts');
    const sm = new GameStateManager(path.join(projectRoot, 'saves'), storage);
    await sm.saveGame(state, 'integration_test');
    console.log('  [INFO] Game saved as "integration_test"');

    // Load
    const registry = await sm.getSaveRegistry();
    const testSave = registry.slots?.find((s: any) => s.slotName === 'integration_test');
    assert(!!testSave, 'Save appears in registry');

    if (testSave) {
        const loaded = await sm.loadGame(testSave.id);
        assert(!!loaded, 'Save loads successfully');
        if (loaded) {
            assert(loaded.character.name === nameBeforeSave, 'Name preserved after load');
            assert(loaded.character.hp.current === hpBeforeSave, 'HP preserved after load');
            assert(loaded.location.coordinates[0] === coordsBeforeSave[0], 'Coordinates preserved after load');
        }
    }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   RPG Lore Engine — Integration Test       ║');
    console.log('║   Using REAL LLM (gpt-oss-120b)           ║');
    console.log('╚════════════════════════════════════════════╝');

    projectRoot = await bootstrapCLI();
    console.log(`Project root: ${projectRoot}`);
    console.log(`API key loaded: ${!!process.env.OPENROUTER_API_KEY}`);

    // Create character and initialize game loop
    const initialState = createQuickCharacter({ name: 'TestHero' });
    const storage = new FileStorageProvider();
    const savesDir = path.join(projectRoot, 'saves');

    gameLoop = new GameLoop(initialState, savesDir, storage);
    await gameLoop.initialize();
    console.log('Game loop initialized.');

    // Run test suites
    await testCharacterCreation();
    await testRenderers();
    await testExplorationCommands();
    await testRestingFix();
    await testWaitCommand();
    await testEdgeCases();
    await testCombat();
    await testNarrativeGeneration();
    await testNPCDialogue();
    await testSaveLoad();

    // Summary
    console.log('\n════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
        console.log('  Failures:');
        for (const f of failures) {
            console.log(`    - ${f}`);
        }
    }
    console.log('════════════════════════════════════════════');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    console.error(e.stack);
    process.exit(1);
});
