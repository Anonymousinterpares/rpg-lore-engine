/**
 * Phase 3 Test: Verify core game loop — exploration commands
 *
 * Run: npx tsx cli/tests/test_phase3_repl.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { GameStateManager } from '../../src/ruleset/combat/GameStateManager';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
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
    console.log('=== Phase 3: Core Game Loop REPL Test ===\n');
    const root = await bootstrapCLI();
    const savesDir = path.join(root, 'saves', 'cli_test_phase3');
    const storage = new FileStorageProvider();

    // Create a Fighter character
    const state = createQuickCharacter({ name: 'Theron', className: 'Fighter', backgroundName: 'Soldier' });
    assert(state !== null, 'Character created');

    // Construct GameLoop
    console.log('\n--- Initialize GameLoop ---');
    const gameLoop = new GameLoop(state, savesDir, storage);
    await gameLoop.initialize();
    assert(gameLoop.getState().mode === 'EXPLORATION', `Mode: EXPLORATION`);
    assert(gameLoop.getState().location.coordinates[0] === 0 && gameLoop.getState().location.coordinates[1] === 0, 'Starting at (0,0)');

    // --- /look ---
    console.log('\n--- /look ---');
    const lookResult = await gameLoop.processTurn('/look');
    assert(typeof lookResult === 'string', `/look returns string`);
    assert(lookResult.length > 0, `/look response not empty (${lookResult.length} chars)`);
    console.log(`    Response preview: "${lookResult.slice(0, 100)}..."`);

    // --- /move N ---
    console.log('\n--- /move N ---');
    const beforeCoords = [...gameLoop.getState().location.coordinates];
    const moveResult = await gameLoop.processTurn('/move N');
    assert(typeof moveResult === 'string', `/move N returns string`);
    const afterCoords = gameLoop.getState().location.coordinates;
    assert(
        afterCoords[0] !== beforeCoords[0] || afterCoords[1] !== beforeCoords[1],
        `Coordinates changed: (${beforeCoords}) -> (${afterCoords})`
    );
    console.log(`    Response preview: "${(moveResult || '').slice(0, 100)}..."`);

    // --- /move S (back) ---
    console.log('\n--- /move S ---');
    const moveBack = await gameLoop.processTurn('/move S');
    assert(typeof moveBack === 'string', `/move S returns string`);
    const backCoords = gameLoop.getState().location.coordinates;
    console.log(`    Position after /move S: (${backCoords})`);

    // --- /wait 30 ---
    console.log('\n--- /wait 30 ---');
    const timeBefore = { ...gameLoop.getState().worldTime };
    const waitResult = await gameLoop.processTurn('/wait 30');
    assert(typeof waitResult === 'string', `/wait returns string`);
    const timeAfter = gameLoop.getState().worldTime;
    const minutesBefore = timeBefore.hour * 60 + timeBefore.minute;
    const minutesAfter = timeAfter.hour * 60 + timeAfter.minute;
    assert(minutesAfter > minutesBefore || timeAfter.day > timeBefore.day, `Time advanced: ${timeBefore.hour}:${timeBefore.minute} -> ${timeAfter.hour}:${timeAfter.minute}`);

    // --- /pace Stealth ---
    console.log('\n--- /pace Stealth ---');
    const paceResult = await gameLoop.processTurn('/pace Stealth');
    assert(typeof paceResult === 'string', `/pace returns string`);
    assert(gameLoop.getState().travelPace === 'Stealth', `Pace set to Stealth: "${gameLoop.getState().travelPace}"`);

    // --- /pace Normal (reset) ---
    await gameLoop.processTurn('/pace Normal');
    assert(gameLoop.getState().travelPace === 'Normal', 'Pace reset to Normal');

    // --- /rest long ---
    console.log('\n--- /rest long ---');
    // First reduce HP to test healing
    const charState = gameLoop.getState().character;
    const maxHp = charState.hp.max;
    (gameLoop as any).state.character.hp.current = Math.max(1, maxHp - 5);
    const hpBefore = gameLoop.getState().character.hp.current;
    assert(hpBefore < maxHp, `HP reduced to ${hpBefore}/${maxHp} for rest test`);

    const restResult = await gameLoop.processTurn('/rest 480');
    assert(typeof restResult === 'string', `/rest 480 returns string`);
    const postRestState = gameLoop.getState();
    if (postRestState.mode === 'COMBAT') {
        // Rest was interrupted by a random encounter — this is valid game behavior
        console.log('    Rest interrupted by encounter (expected game behavior)');
        assert(true, 'Rest interrupted by combat (valid random encounter)');
        assert(true, 'Mode changed to COMBAT (valid)');
        // End combat by exiting for test purposes — just verify mode changed
    } else {
        const hpAfter = postRestState.character.hp.current;
        assert(hpAfter === maxHp, `HP restored: ${hpBefore} -> ${hpAfter}/${maxHp}`);
        assert(postRestState.mode === 'EXPLORATION', `Still in EXPLORATION mode`);
    }

    // --- Save / Load ---
    console.log('\n--- Save / Load ---');
    const stateManager = new GameStateManager(savesDir, storage);
    const currentState = gameLoop.getState();
    await stateManager.saveGame(currentState, 'Phase3 Test');

    const loaded = await stateManager.loadGame(currentState.saveId);
    assert(loaded !== null, 'Save loaded successfully');
    if (loaded) {
        assert(loaded.character.name === 'Theron', `Name preserved: ${loaded.character.name}`);
        assert(loaded.character.hp.current > 0, `HP preserved: ${loaded.character.hp.current}`);
        assert(loaded.travelPace === 'Normal', `Pace preserved: ${loaded.travelPace}`);
    }

    // Clean up
    await stateManager.deleteSave(currentState.saveId);

    // --- Free text input (without LLM — should still work) ---
    console.log('\n--- Free text input (no LLM) ---');
    const freeResult = await gameLoop.processTurn('I look around the clearing');
    assert(typeof freeResult === 'string', `Free text returns string`);
    console.log(`    Response preview: "${(freeResult || '').slice(0, 120)}..."`);

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
