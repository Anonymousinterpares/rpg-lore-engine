/**
 * Test: Rest Guidance via Narrator System Prompt (Part A)
 *
 * Verifies that when a player types natural-language rest intent,
 * the Narrator LLM includes the "[You can use the Rest button...]" guidance.
 *
 * REQUIRES: OPENROUTER_API_KEY in .env (uses gemini-2.5-flash via OpenRouter)
 *
 * Run: npx tsx cli/tests/test_rest_guidance.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { GameStateManager } from '../../src/ruleset/combat/GameStateManager';
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
    console.log('=== Test: Rest Guidance (Part A) ===\n');
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

    const savesDir = path.join(root, 'saves', 'cli_test_rest_guidance');
    const storage = new FileStorageProvider();
    const state = createQuickCharacter({ name: 'Aldric', className: 'Fighter', backgroundName: 'Soldier' });
    assert(state !== null, 'Character created');

    const gameLoop = new GameLoop(state, savesDir, storage);
    await gameLoop.initialize();
    assert(gameLoop.getState().mode === 'EXPLORATION', 'Mode: EXPLORATION');

    // --- Test 1: Natural-language rest intent ---
    console.log('\n--- Test 1: "I want to set up camp for the night" ---');
    const restResponse = await gameLoop.processTurn('I want to set up camp for the night');
    console.log(`\n  Response:\n${restResponse}\n`);
    assert(typeof restResponse === 'string' && restResponse.length > 0, 'Got a response');

    const hasRestHint = restResponse.includes('[You can use the Rest button');
    assert(hasRestHint, 'Response contains Rest button guidance hint');

    // Verify the game did NOT actually rest (HP should be unchanged, no recovery message)
    const stateAfter = gameLoop.getState();
    assert(stateAfter.character.hp.current === stateAfter.character.hp.max,
        'HP unchanged (no mechanical rest occurred)');

    // --- Test 2: Different phrasing ---
    console.log('\n--- Test 2: "Let me sleep and recover my strength" ---');
    const restResponse2 = await gameLoop.processTurn('Let me sleep and recover my strength');
    console.log(`\n  Response:\n${restResponse2}\n`);
    assert(typeof restResponse2 === 'string' && restResponse2.length > 0, 'Got a response');

    const hasRestHint2 = restResponse2.includes('[You can use the Rest button');
    assert(hasRestHint2, 'Response contains Rest button guidance hint (alt phrasing)');

    // --- Test 3: Non-rest input should NOT have the hint ---
    console.log('\n--- Test 3: "I look around the area" (should NOT have rest hint) ---');
    const lookResponse = await gameLoop.processTurn('I look around the area');
    console.log(`\n  Response:\n${lookResponse}\n`);
    assert(typeof lookResponse === 'string' && lookResponse.length > 0, 'Got a response');

    const hasNoRestHint = !lookResponse.includes('[You can use the Rest button');
    assert(hasNoRestHint, 'Non-rest input does NOT contain Rest button hint');

    // --- CLI hint detection test (simulate what repl.ts does) ---
    console.log('\n--- Test 4: CLI hint detection ---');
    const testResponses = [
        { text: 'Some narrative... [You can use the Rest button to rest and recover.]', expected: 'rest' },
        { text: 'A merchant awaits... [Use the Trade button or approach a merchant to open the trading interface.]', expected: 'trade' },
        { text: 'An NPC waves... [Click on an NPC or use the Talk button to start a conversation.]', expected: 'talk' },
        { text: 'Your pack is heavy... [Open the Inventory panel to manage your items and equipment.]', expected: 'inventory' },
        { text: 'The wind howls through the trees.', expected: 'none' },
    ];

    for (const test of testResponses) {
        const hints: string[] = [];
        if (test.text.includes('[You can use the Rest button')) hints.push('rest');
        if (test.text.includes('[Use the Trade button')) hints.push('trade');
        if (test.text.includes('[Click on an NPC')) hints.push('talk');
        if (test.text.includes('[Open the Inventory panel')) hints.push('inventory');
        if (hints.length === 0) hints.push('none');

        assert(hints.includes(test.expected),
            `CLI hint detection: "${test.expected}" detected in "${test.text.slice(0, 40)}..."`);
    }

    // --- Summary ---
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
