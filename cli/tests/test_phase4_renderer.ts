/**
 * Phase 4 Test: Verify all renderers produce correct output
 *
 * Run: npx tsx cli/tests/test_phase4_renderer.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { renderCharacter, renderCharacterCompact } from '../renderer/CharacterRenderer';
import { renderLocation } from '../renderer/LocationRenderer';
import { renderInventory } from '../renderer/InventoryRenderer';
import { renderQuests } from '../renderer/QuestRenderer';
import { renderMap } from '../renderer/MapRenderer';
import { renderCompact, renderFull } from '../renderer/StateRenderer';
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

function assertContains(text: string, search: string, label: string) {
    assert(text.includes(search), `${label} contains "${search}"`);
}

async function main() {
    console.log('=== Phase 4: Renderer Test ===\n');
    const root = await bootstrapCLI();

    // Create a Wizard (caster with spells) for thorough testing
    const state = createQuickCharacter({
        name: 'Elindra',
        className: 'Wizard',
        backgroundName: 'Sage',
        abilities: { STR: 8, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 10 }
    });

    // Initialize GameLoop and process a move to generate state
    const storage = new FileStorageProvider();
    const savesDir = path.join(root, 'saves', 'cli_test_phase4');
    const gameLoop = new GameLoop(state, savesDir, storage);
    await gameLoop.initialize();
    await gameLoop.processTurn('/move N');
    const currentState = gameLoop.getState();

    // --- CharacterRenderer ---
    console.log('\n--- CharacterRenderer ---');
    const charOutput = renderCharacter(currentState);
    console.log(charOutput);
    assert(charOutput.length > 0, 'CharacterRenderer produces output');
    assertContains(charOutput, 'Elindra', 'Character name');
    assertContains(charOutput, 'Wizard', 'Class name');
    assertContains(charOutput, 'HP:', 'HP display');
    assertContains(charOutput, 'AC:', 'AC display');
    assertContains(charOutput, 'STR:', 'STR ability');
    assertContains(charOutput, 'DEX:', 'DEX ability');
    assertContains(charOutput, 'CON:', 'CON ability');
    assertContains(charOutput, 'Spellbook:', 'Wizard spellbook');
    assertContains(charOutput, 'Cantrips:', 'Wizard cantrips');
    assertContains(charOutput, 'Skills:', 'Skills list');

    const compactChar = renderCharacterCompact(currentState);
    assert(compactChar.length > 0 && compactChar.length < 100, `Compact char is short: ${compactChar.length} chars`);

    // --- LocationRenderer ---
    console.log('\n--- LocationRenderer ---');
    const locOutput = renderLocation(currentState);
    console.log(locOutput);
    assert(locOutput.length > 0, 'LocationRenderer produces output');
    assertContains(locOutput, 'Location:', 'Location label');
    assertContains(locOutput, 'Time:', 'Time display');
    assertContains(locOutput, 'Weather:', 'Weather display');
    assertContains(locOutput, 'Pace:', 'Pace display');

    // --- InventoryRenderer ---
    console.log('\n--- InventoryRenderer ---');
    const invOutput = renderInventory(currentState);
    console.log(invOutput);
    assert(invOutput.length > 0, 'InventoryRenderer produces output');
    assertContains(invOutput, 'Gold:', 'Gold display');
    assertContains(invOutput, 'Weight:', 'Weight display');
    assertContains(invOutput, 'Inventory', 'Inventory label');

    // --- QuestRenderer ---
    console.log('\n--- QuestRenderer ---');
    const questOutput = renderQuests(currentState);
    console.log(questOutput);
    assert(questOutput.length > 0, 'QuestRenderer produces output');
    assertContains(questOutput, 'The First Step', 'Tutorial quest title');
    assertContains(questOutput, '[', 'Objective checkbox');

    // --- MapRenderer ---
    console.log('\n--- MapRenderer ---');
    const mapOutput = renderMap(currentState);
    console.log(mapOutput);
    assert(mapOutput.length > 0, 'MapRenderer produces output');
    assertContains(mapOutput, '@@', 'Player marker');
    assertContains(mapOutput, 'Map', 'Map label');
    // Should have at least some biome abbreviations or ?? markers
    assert(mapOutput.includes('??') || mapOutput.includes('Pl') || mapOutput.includes('Fo'), 'Map shows hex data');

    // --- StateRenderer.renderCompact ---
    console.log('\n--- StateRenderer compact ---');
    const compactOutput = renderCompact(currentState);
    console.log(`  ${compactOutput}`);
    assert(compactOutput.length > 0, 'Compact output non-empty');
    assert(compactOutput.length < 200, `Compact output under 200 chars: ${compactOutput.length}`);
    assertContains(compactOutput, 'Elindra', 'Compact has name');
    assertContains(compactOutput, 'HP:', 'Compact has HP');

    // --- StateRenderer.renderFull ---
    console.log('\n--- StateRenderer full ---');
    const fullOutput = renderFull(currentState);
    assert(fullOutput.length > 0, 'Full output non-empty');
    assert(fullOutput.includes('Elindra') && fullOutput.includes('Location:'), 'Full output has char + location');

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
