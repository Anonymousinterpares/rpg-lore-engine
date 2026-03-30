/**
 * Test all newly wired CLI commands
 * Run: npx tsx cli/test_new_commands.ts
 */
import { bootstrapCLI } from './bootstrap.ts';
import { GameLoop } from '../src/ruleset/combat/GameLoop.ts';
import { FileStorageProvider } from '../src/ruleset/combat/FileStorageProvider.ts';
import { createQuickCharacter } from './creation.ts';
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

async function cmd(input: string): Promise<string> {
    try { return (await gameLoop.processTurn(input)) || ''; }
    catch (e: any) { return `[ERROR] ${e.message}`; }
}

async function testLeveling() {
    console.log('\n=== TEST: Leveling ===');

    // Can't level up at start (not enough XP)
    const r1 = await cmd('/levelup');
    assert(r1.includes('Not enough XP'), '/levelup fails without XP', r1.slice(0, 80));

    // Add XP
    const r2 = await cmd('/addxp 300');
    assert(r2.includes('300') && r2.includes('XP'), '/addxp 300 works', r2.slice(0, 80));
    assert(gameLoop.getState().character.xp >= 300, 'XP added to character');

    // Now level up
    const r3 = await cmd('/levelup');
    assert(r3.includes('Level 2'), '/levelup succeeds', r3.slice(0, 80));
    assert(gameLoop.getState().character.level === 2, 'Character is now level 2');

    // Can't level again without more XP
    const r4 = await cmd('/levelup');
    assert(r4.includes('Not enough'), '/levelup blocked at level 2 without XP');
}

async function testWeather() {
    console.log('\n=== TEST: Weather ===');
    const r = await cmd('/weather');
    assert(r.includes('Weather'), '/weather shows current weather', r.slice(0, 80));
    assert(!r.includes('[ERROR]'), '/weather does not error');
}

async function testFactions() {
    console.log('\n=== TEST: Factions ===');
    const r = await cmd('/factions');
    // May have factions or may not, but shouldn't error
    assert(!r.includes('[ERROR]'), '/factions does not error', r.slice(0, 80));
    assert(r.includes('Faction') || r.includes('No factions'), '/factions shows data or empty message');
}

async function testSkillCheck() {
    console.log('\n=== TEST: Skill Checks ===');

    // Missing args
    const r1 = await cmd('/check');
    assert(r1.includes('Usage'), '/check without args shows usage');

    // Valid check
    const r2 = await cmd('/check DEX Stealth 10');
    assert(!r2.includes('[ERROR]'), '/check DEX Stealth 10 works', r2.slice(0, 80));
    assert(r2.includes('Rolled') || r2.includes('Success') || r2.includes('Fail') || r2.includes('check'), 'Skill check produces result');
}

async function testExport() {
    console.log('\n=== TEST: Export ===');

    const sheet = await cmd('/export sheet');
    assert(sheet.includes('#') || sheet.includes('Level'), '/export sheet produces markdown', sheet.slice(0, 80));

    const chronicle = await cmd('/export chronicle');
    assert(chronicle.includes('Chronicle') || chronicle.includes('#'), '/export chronicle produces output', chronicle.slice(0, 80));
}

async function testPrepareSpells() {
    console.log('\n=== TEST: Spell Preparation ===');

    // Fighter can't prepare spells
    const r1 = await cmd('/prepare Fireball');
    assert(!r1.includes('[ERROR]'), '/prepare does not crash for non-caster', r1.slice(0, 80));
}

async function testGather() {
    console.log('\n=== TEST: Gathering ===');

    // No resources at starting hex
    const r1 = await cmd('/gather');
    assert(r1.includes('No resources') || r1.includes('Available'), '/gather shows available or none', r1.slice(0, 80));
}

async function testCraft() {
    console.log('\n=== TEST: Crafting ===');

    const r1 = await cmd('/craft');
    assert(r1.includes('Usage'), '/craft without args shows usage');

    const r2 = await cmd('/craft nonexistent_recipe');
    assert(r2.includes('not found') || r2.includes('Missing'), '/craft invalid recipe handled', r2.slice(0, 80));
}

async function testMulticlass() {
    console.log('\n=== TEST: Multiclass ===');

    const r1 = await cmd('/multiclass');
    assert(r1.includes('Usage'), '/multiclass without args shows usage');

    const r2 = await cmd('/multiclass Wizard');
    assert(!r2.includes('[ERROR]'), '/multiclass check does not crash', r2.slice(0, 80));
}

async function testStabilize() {
    console.log('\n=== TEST: Stabilize (outside combat) ===');
    const r1 = await cmd('/stabilize ally');
    assert(r1.includes('Not in combat'), '/stabilize outside combat handled');
}

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   New Commands Integration Test            ║');
    console.log('╚════════════════════════════════════════════╝');

    projectRoot = await bootstrapCLI();
    const state = createQuickCharacter({ name: 'CommandTestHero' });
    const storage = new FileStorageProvider();
    gameLoop = new GameLoop(state, path.join(projectRoot, 'saves'), storage);
    await gameLoop.initialize();

    await testLeveling();
    await testWeather();
    await testFactions();
    await testSkillCheck();
    await testExport();
    await testPrepareSpells();
    await testGather();
    await testCraft();
    await testMulticlass();
    await testStabilize();

    console.log('\n════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
        console.log('  Failures:');
        for (const f of failures) console.log(`    - ${f}`);
    }
    console.log('════════════════════════════════════════════');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e.message, e.stack?.slice(0, 300)); process.exit(1); });
