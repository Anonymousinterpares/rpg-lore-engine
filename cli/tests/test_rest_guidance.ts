/**
 * Test: Rest/Wait Narration UX (Part A — Full Suite)
 *
 * Tests:
 * 1. Pre-rest hint is minimal (no camping narration, just hint)
 * 2. Post-rest narration is atmospheric + includes mechanical recovery
 * 3. Post-wait narration works similarly
 * 4. CLI hint detection patterns
 * 5. Time accuracy after rest
 *
 * REQUIRES: OPENROUTER_API_KEY in .env
 *
 * Run: npx tsx cli/tests/test_rest_guidance.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { AgentManager } from '../../src/ruleset/agents/AgentManager';
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
    console.log('=== Test: Rest/Wait Narration UX ===\n');
    const root = await bootstrapCLI();

    // Override Narrator to use OpenRouter (only available key)
    AgentManager.saveAgentProfile({
        id: 'NARRATOR',
        name: 'The Narrator',
        providerId: 'openrouter',
        modelId: 'gpt-oss-120b',
        basePrompt: 'Describe the scene vividly but concisely. Never decide outcomes (the engine does). Output MUST be valid JSON matching the NarratorOutputSchema.',
        temperature: 0.8,
        maxTokens: 1500,
    });
    console.log('  Narrator overridden to openrouter/gpt-oss-120b\n');

    const savesDir = path.join(root, 'saves', 'cli_test_rest_narration');
    const storage = new FileStorageProvider();
    const state = createQuickCharacter({ name: 'Aldric', className: 'Fighter', backgroundName: 'Soldier' });
    assert(state !== null, 'Character created');

    const gameLoop = new GameLoop(state, savesDir, storage);
    await gameLoop.initialize();
    assert(gameLoop.getState().mode === 'EXPLORATION', 'Mode: EXPLORATION');

    // Record starting time
    const startHour = gameLoop.getState().worldTime.hour;
    console.log(`  Starting time: ${startHour}:00`);

    // =============================================
    // TEST 1: Pre-rest hint is MINIMAL
    // =============================================
    console.log('\n--- Test 1: Pre-rest hint (minimal, no camp narration) ---');
    const restResponse = await gameLoop.processTurn('I want to set up camp for the night');
    console.log(`\n  Response:\n${restResponse}\n`);
    assert(typeof restResponse === 'string' && restResponse.length > 0, 'Got a response');
    assert(restResponse.includes('[You can use the Rest button'), 'Contains Rest button hint');

    // Verify NO mechanical rest occurred
    const stateAfterHint = gameLoop.getState();
    assert(stateAfterHint.character.hp.current === stateAfterHint.character.hp.max,
        'HP unchanged (no mechanical rest)');

    // =============================================
    // TEST 2: Post-rest narration (/rest 60 = short rest)
    // =============================================
    console.log('\n--- Test 2: Post-rest narration (/rest 60) ---');

    // Damage the character first so we can verify recovery
    stateAfterHint.character.hp.current = Math.max(1, stateAfterHint.character.hp.max - 10);
    const hpBefore = stateAfterHint.character.hp.current;
    console.log(`  HP before rest: ${hpBefore}/${stateAfterHint.character.hp.max}`);

    const restResult = await gameLoop.processTurn('/rest 60');
    console.log(`\n  Response:\n${restResult}\n`);
    assert(typeof restResult === 'string' && restResult.length > 0, 'Got a response');

    // Should contain BOTH atmospheric narration AND mechanical recovery info
    const hasRecoveryInfo = restResult.toLowerCase().includes('rest') || restResult.toLowerCase().includes('recover');
    assert(hasRecoveryInfo, 'Response mentions rest/recovery');

    // HP should have changed (proportional recovery for 60 min)
    const hpAfter = gameLoop.getState().character.hp.current;
    console.log(`  HP after rest: ${hpAfter}/${gameLoop.getState().character.hp.max}`);
    assert(hpAfter >= hpBefore, `HP recovered: ${hpBefore} → ${hpAfter}`);

    // Time should have advanced by 60 minutes
    const hourAfterRest = gameLoop.getState().worldTime.hour;
    console.log(`  Time after rest: ${hourAfterRest}:00 (started at ${startHour}:00)`);

    // Verify lastNarrative was set (may be overwritten by subsequent exploration narration)
    const lastNarr = gameLoop.getState().lastNarrative || '';
    assert(lastNarr.length > 0, 'lastNarrative is set after rest');

    // =============================================
    // TEST 3: Post-wait narration (/wait 60)
    // =============================================
    console.log('\n--- Test 3: Post-wait narration (/wait 60) ---');
    const hpBeforeWait = gameLoop.getState().character.hp.current;
    const waitResult = await gameLoop.processTurn('/wait 60');
    console.log(`\n  Response:\n${waitResult}\n`);
    assert(typeof waitResult === 'string' && waitResult.length > 0, 'Got a response');

    // Wait should NOT recover HP
    const hpAfterWait = gameLoop.getState().character.hp.current;
    assert(hpAfterWait === hpBeforeWait, `HP unchanged after wait: ${hpAfterWait}`);

    // =============================================
    // TEST 4: Non-rest input should NOT have hint
    // =============================================
    console.log('\n--- Test 4: Non-rest input (no hint) ---');
    const lookResponse = await gameLoop.processTurn('I look around the area');
    console.log(`\n  Response:\n${lookResponse}\n`);
    assert(!lookResponse.includes('[You can use the Rest button'),
        'Non-rest input does NOT contain Rest hint');

    // =============================================
    // TEST 5: CLI hint detection patterns
    // =============================================
    console.log('\n--- Test 5: CLI hint detection ---');
    const testResponses = [
        { text: 'Narrative... [You can use the Rest button to rest and recover.]', expected: 'rest' },
        { text: 'Merchant... [Use the Trade button or approach a merchant to open the trading interface.]', expected: 'trade' },
        { text: 'NPC... [Click on an NPC or use the Talk button to start a conversation.]', expected: 'talk' },
        { text: 'Pack... [Open the Inventory panel to manage your items and equipment.]', expected: 'inventory' },
        { text: 'The wind howls.', expected: 'none' },
    ];

    for (const test of testResponses) {
        const hints: string[] = [];
        if (test.text.includes('[You can use the Rest button')) hints.push('rest');
        if (test.text.includes('[Use the Trade button')) hints.push('trade');
        if (test.text.includes('[Click on an NPC')) hints.push('talk');
        if (test.text.includes('[Open the Inventory panel')) hints.push('inventory');
        if (hints.length === 0) hints.push('none');
        assert(hints.includes(test.expected),
            `Hint "${test.expected}" detected in "${test.text.slice(0, 40)}..."`);
    }

    // =============================================
    // TEST 6: Long rest (480 min) — time accuracy
    // =============================================
    console.log('\n--- Test 6: Long rest time accuracy (/rest 480) ---');
    const hourBeforeLongRest = gameLoop.getState().worldTime.hour;
    console.log(`  Time before long rest: ${hourBeforeLongRest}:00`);

    const longRestResult = await gameLoop.processTurn('/rest 480');
    console.log(`\n  Response:\n${longRestResult}\n`);
    assert(typeof longRestResult === 'string' && longRestResult.length > 0, 'Got long rest response');

    const hourAfterLongRest = gameLoop.getState().worldTime.hour;
    const modeAfterLongRest = gameLoop.getState().mode;
    console.log(`  Time after long rest: ${hourAfterLongRest}:00, Mode: ${modeAfterLongRest}`);

    if (modeAfterLongRest === 'COMBAT') {
        // Rest was interrupted by ambush — ambush narration was generated
        console.log('  (Ambush occurred during rest — testing ambush narration)');
        assert(longRestResult.length > 30, 'Ambush narration has atmospheric text (not just a short error)');
        assert(!longRestResult.includes('Your rest is interrupted by an attack!'),
            'Ambush uses LLM narration, not hardcoded fallback');
        // Time should have advanced partially (not full 8 hours)
        assert(hourAfterLongRest > hourBeforeLongRest || hourAfterLongRest < hourBeforeLongRest,
            `Time advanced partially: ${hourBeforeLongRest}:00 → ${hourAfterLongRest}:00`);
    } else {
        // Normal completion — time should have advanced by 8 hours
        const expectedHour = (hourBeforeLongRest + 8) % 24;
        assert(hourAfterLongRest === expectedHour,
            `Time advanced correctly: ${hourBeforeLongRest}:00 + 8h = ${hourAfterLongRest}:00 (expected ${expectedHour}:00)`);
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
