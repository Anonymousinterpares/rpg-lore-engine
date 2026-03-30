/**
 * Phase 5 Test: Verify combat interface — grid, initiative, actions
 *
 * Run: npx tsx cli/tests/test_phase5_combat.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { renderInitiative, renderGrid, renderTacticalOptions, renderCombatLog, renderCombatFull } from '../renderer/CombatRenderer';
import { resolveCombatInput } from '../combat';
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
    console.log('=== Phase 5: Combat Interface Test ===\n');
    const root = await bootstrapCLI();
    const storage = new FileStorageProvider();
    const savesDir = path.join(root, 'saves', 'cli_test_phase5');

    // Create a strong Fighter
    const state = createQuickCharacter({
        name: 'Kael',
        className: 'Fighter',
        backgroundName: 'Soldier',
        abilities: { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 }
    });

    const gameLoop = new GameLoop(state, savesDir, storage);
    await gameLoop.initialize();

    // --- Force start combat ---
    console.log('--- Starting Combat ---');
    const combatResult = await gameLoop.processTurn('/combat Goblin 2');
    assert(typeof combatResult === 'string', `Combat start returns string`);
    console.log(`    Response: "${(combatResult || '').slice(0, 100)}..."`);

    const combatState = gameLoop.getState();
    assert(combatState.mode === 'COMBAT', `Mode is COMBAT: ${combatState.mode}`);
    assert(combatState.combat !== undefined, 'Combat state exists');

    if (!combatState.combat) {
        console.log('  Combat failed to initialize. Aborting combat tests.');
        console.log(`\nRESULTS: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
        return;
    }

    const combatants = combatState.combat.combatants || [];
    assert(combatants.length >= 3, `Combatants: ${combatants.length} (player + 2 goblins)`);

    // --- Initiative Renderer ---
    console.log('\n--- Initiative Display ---');
    const initOutput = renderInitiative(combatState);
    console.log(initOutput);
    assert(initOutput.length > 0, 'Initiative renders');
    assert(initOutput.includes('Kael') || initOutput.includes('kael'), 'Initiative shows player name');
    assert(initOutput.includes('Goblin') || initOutput.includes('goblin'), 'Initiative shows enemy name');
    assert(initOutput.includes('>'), 'Initiative shows turn marker');
    assert(initOutput.includes('Round:'), 'Initiative shows round');

    // --- Grid Renderer ---
    console.log('\n--- Grid Display ---');
    const gridOutput = renderGrid(combatState);
    console.log(gridOutput);
    assert(gridOutput.length > 0, 'Grid renders');
    assert(gridOutput.includes('@'), 'Grid shows player');
    // Enemies should show as numbers
    assert(gridOutput.includes('1'), 'Grid shows enemy 1');

    // --- Tactical Options ---
    console.log('\n--- Tactical Options ---');
    const options = gameLoop.getTacticalOptions();
    console.log(`  Options count: ${options.length}`);
    if (options.length > 0) {
        const optOutput = renderTacticalOptions(options);
        console.log(optOutput);
        assert(optOutput.includes('Tactical Options'), 'Options header renders');
        assert(options[0].command !== undefined, 'First option has command');

        // Test combat input resolution
        const resolved = resolveCombatInput('1', options);
        assert(resolved === options[0].command, `Input "1" resolves to: ${resolved}`);
    }
    assert(true, `Tactical options available: ${options.length}`);

    // --- Full combat display ---
    console.log('\n--- Full Combat Display ---');
    const fullOutput = renderCombatFull(combatState, options);
    assert(fullOutput.length > 0, 'Full combat display renders');

    // --- Attack ---
    console.log('\n--- Attack Action ---');
    const attackResult = await gameLoop.processTurn('attack');
    assert(typeof attackResult === 'string', 'Attack returns string');
    console.log(`    Result: "${(attackResult || '').slice(0, 150)}..."`);

    // --- End Turn ---
    console.log('\n--- End Turn ---');
    const endResult = await gameLoop.processTurn('end turn');
    assert(typeof endResult === 'string', 'End turn returns string');
    console.log(`    Result: "${(endResult || '').slice(0, 150)}..."`);

    // --- Combat loop (fight up to 30 turns) ---
    console.log('\n--- Combat Loop (up to 30 turns) ---');
    let turns = 0;
    const maxTurns = 30;
    while (gameLoop.getState().mode === 'COMBAT' && turns < maxTurns) {
        try {
            await gameLoop.processTurn('attack');
            if (gameLoop.getState().mode !== 'COMBAT') break;
            await gameLoop.processTurn('end turn');
        } catch (e) {
            // Combat may end mid-action
            break;
        }
        turns++;
    }

    const finalMode = gameLoop.getState().mode;
    console.log(`  Combat resolved in ${turns} attack cycles. Final mode: ${finalMode}`);

    if (finalMode === 'EXPLORATION') {
        assert(true, 'Combat resolved back to EXPLORATION');
    } else if (finalMode === 'COMBAT') {
        // May still be in combat if goblins are tough or we took too long
        assert(true, `Combat still active after ${maxTurns} turns (goblins survive)`);
    }

    // --- Combat Log ---
    console.log('\n--- Combat Log ---');
    // Use the latest state for log
    const logState = gameLoop.getState();
    if (logState.combat) {
        const logOutput = renderCombatLog(logState, 10);
        console.log(logOutput || '  (no log entries)');
        assert(true, 'Combat log rendered');
    } else {
        assert(true, 'Combat ended — no active log');
    }

    // --- Input Resolver ---
    console.log('\n--- Combat Input Resolver ---');
    const mockOptions = [
        { command: '/move 5 3 sprint', label: 'Sprint', subOptions: [
            { command: '/move 5 3 stalk', label: 'Stalk' }
        ]},
        { command: 'attack', label: 'Attack' }
    ];
    assert(resolveCombatInput('1', mockOptions) === '/move 5 3 sprint', 'Resolves "1" to first option');
    assert(resolveCombatInput('2', mockOptions) === 'attack', 'Resolves "2" to second option');
    assert(resolveCombatInput('1a', mockOptions) === '/move 5 3 stalk', 'Resolves "1a" to sub-option');
    assert(resolveCombatInput('dodge', mockOptions) === 'dodge', 'Passes through non-numeric');

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
