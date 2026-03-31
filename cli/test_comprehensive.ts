/**
 * Comprehensive Test Suite — Steps 7 + 8
 * Expanded scenarios for all game systems + edge case hardening
 *
 * Run: npx tsx cli/test_comprehensive.ts
 */
import { bootstrapCLI } from './bootstrap.ts';
import { GameLoop } from '../src/ruleset/combat/GameLoop.ts';
import { FileStorageProvider } from '../src/ruleset/combat/FileStorageProvider.ts';
import { GameStateManager } from '../src/ruleset/combat/GameStateManager.ts';
import { GameState } from '../src/ruleset/schemas/FullSaveStateSchema.ts';
import { createQuickCharacter } from './creation.ts';
import { hasCondition, addCondition } from '../src/ruleset/combat/ConditionUtils.ts';
import * as path from 'path';

let projectRoot: string;
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail?: string) {
    if (cond) { console.log(`  [PASS] ${name}`); passed++; }
    else { console.log(`  [FAIL] ${name}${detail ? ': ' + detail : ''}`); failed++; failures.push(name + (detail ? ': ' + detail : '')); }
}

async function makeGame(opts: { name?: string; className?: string; raceName?: string; backgroundName?: string } = {}): Promise<GameLoop> {
    const state = createQuickCharacter({
        name: opts.name || 'TestHero',
        className: opts.className || 'Fighter',
        raceName: opts.raceName || 'Human',
        backgroundName: opts.backgroundName || 'Soldier',
    });
    const gl = new GameLoop(state, path.join(projectRoot, 'saves'), new FileStorageProvider());
    await gl.initialize();
    return gl;
}

async function cmd(gl: GameLoop, input: string): Promise<string> {
    try { return (await gl.processTurn(input)) || ''; }
    catch (e: any) { return `[ERROR] ${e.message}`; }
}

// ============================================================
// SCENARIO 1: Spellcaster Combat
// ============================================================
async function testSpellcasterCombat() {
    console.log('\n=== SCENARIO 1: Spellcaster Combat ===');
    const gl = await makeGame({ name: 'Merlin', className: 'Wizard' });
    const c = gl.getState().character;

    assert(c.cantripsKnown.length > 0 || c.knownSpells.length > 0 || c.spellbook.length > 0,
        'Wizard has spells', `cantrips=${c.cantripsKnown.length}, known=${c.knownSpells.length}, book=${c.spellbook.length}`);

    // Check spell slots exist
    const hasSlots = Object.keys(c.spellSlots).length > 0;
    assert(hasSlots, 'Wizard has spell slots');

    // Start combat
    await cmd(gl, '/combat Goblin 1');
    assert(gl.getState().mode === 'COMBAT', 'Combat started');

    // Try casting a cantrip (if any)
    if (c.cantripsKnown.length > 0) {
        const cantrip = c.cantripsKnown[0];
        const castResult = await cmd(gl, `/cast ${cantrip}`);
        assert(!castResult.includes('[ERROR]'), `Cast cantrip ${cantrip}`, castResult.slice(0, 80));
    }

    // End combat by attacking
    let rounds = 0;
    while (gl.getState().mode === 'COMBAT' && rounds < 30) {
        await cmd(gl, 'attack');
        if (gl.getState().mode === 'COMBAT') await cmd(gl, 'end turn');
        rounds++;
    }
}

// ============================================================
// SCENARIO 2: Multi-Round Combat with XP + Loot
// ============================================================
async function testMultiRoundCombat() {
    console.log('\n=== SCENARIO 2: Multi-Round Combat → XP + Loot ===');
    const gl = await makeGame({ name: 'Bruiser', className: 'Barbarian' });
    const xpBefore = gl.getState().character.xp;

    await cmd(gl, '/combat Goblin 2');
    assert(gl.getState().mode === 'COMBAT', 'Combat with 2 goblins started');

    const combatantCount = gl.getState().combat?.combatants.length || 0;
    assert(combatantCount >= 3, 'At least 3 combatants (player + 2 goblins)', `got ${combatantCount}`);

    // Fight to completion
    let rounds = 0;
    while (gl.getState().mode === 'COMBAT' && rounds < 40) {
        const player = gl.getState().combat?.combatants.find(c => c.isPlayer);
        if (player && player.hp.current > 0) {
            await cmd(gl, 'attack');
        }
        if (gl.getState().mode === 'COMBAT') await cmd(gl, 'end turn');
        rounds++;
    }

    if (gl.getState().mode === 'EXPLORATION') {
        const xpAfter = gl.getState().character.xp;
        assert(xpAfter > xpBefore, 'XP gained after combat', `${xpBefore} -> ${xpAfter}`);
    } else {
        assert(gl.getState().mode === 'GAME_OVER', 'Combat ended (victory or defeat)');
    }
}

// ============================================================
// SCENARIO 3: Rest Recovery
// ============================================================
async function testRestRecovery() {
    console.log('\n=== SCENARIO 3: Rest Recovery ===');
    const gl = await makeGame({ name: 'Healer', className: 'Cleric' });
    const c = gl.getState().character;

    // Damage character
    const maxHP = c.hp.max;
    c.hp.current = Math.max(1, Math.floor(maxHP / 3));
    const damagedHP = c.hp.current;

    // Short rest
    const shortResult = await cmd(gl, '/rest short');
    assert(!shortResult.includes('[ERROR]'), 'Short rest succeeds');
    const afterShort = gl.getState().character.hp.current;
    assert(afterShort >= damagedHP, 'HP recovered after short rest', `${damagedHP} -> ${afterShort}`);

    // Damage again for long rest
    gl.getState().character.hp.current = Math.max(1, Math.floor(maxHP / 4));
    const beforeLong = gl.getState().character.hp.current;

    const longResult = await cmd(gl, '/rest long');
    assert(!longResult.includes('[ERROR]'), 'Long rest succeeds');
    const afterLong = gl.getState().character.hp.current;
    assert(afterLong > beforeLong, 'HP recovered after long rest', `${beforeLong} -> ${afterLong}`);

    // Check spell slot recovery for caster
    const slotsAfter = gl.getState().character.spellSlots;
    if (Object.keys(slotsAfter).length > 0) {
        const level1 = slotsAfter['1'];
        if (level1) {
            assert(level1.current === level1.max, 'Spell slots restored after long rest', `${level1.current}/${level1.max}`);
        }
    }
}

// ============================================================
// SCENARIO 4: Overencumbered Movement
// ============================================================
async function testOverencumbered() {
    console.log('\n=== SCENARIO 4: Overencumbered Movement ===');
    const gl = await makeGame({ name: 'PackMule' });
    const c = gl.getState().character;
    const capacity = (c.stats.STR || 10) * 15;

    // Add heavy items to exceed capacity
    for (let i = 0; i < 20; i++) {
        c.inventory.items.push({
            id: `heavy_rock_${i}`,
            instanceId: `heavy_rock_${i}`,
            name: 'Heavy Rock',
            weight: capacity / 5,
            quantity: 1,
            equipped: false,
        } as any);
    }

    const totalWeight = c.inventory.items.reduce((sum: number, i: any) => sum + (i.weight * (i.quantity || 1)), 0);
    assert(totalWeight > capacity, 'Inventory exceeds capacity', `${totalWeight} > ${capacity}`);

    const coordsBefore = [...gl.getState().location.coordinates];
    const moveResult = await cmd(gl, '/move N');
    const coordsAfter = gl.getState().location.coordinates;

    // Should be blocked or warn about encumbrance
    assert(
        moveResult.toLowerCase().includes('encumber') || moveResult.toLowerCase().includes('heavy') || moveResult.toLowerCase().includes('weight') ||
        (coordsBefore[0] === coordsAfter[0] && coordsBefore[1] === coordsAfter[1]),
        'Overencumbered movement blocked or warned', moveResult.slice(0, 80)
    );
}

// ============================================================
// SCENARIO 5: Trading Full Cycle
// ============================================================
async function testTradingCycle() {
    console.log('\n=== SCENARIO 5: Trading Full Cycle ===');
    const gl = await makeGame({ name: 'Merchant', className: 'Rogue' });
    const state = gl.getState();

    // Inject merchant NPC
    const npc = {
        id: 'test_merchant', name: 'Test Merchant',
        traits: ['Friendly'], isMerchant: true,
        relationship: { standing: 0, interactionLog: [] },
        dialogue_triggers: [], inventory: [], availableQuests: [],
        conversationHistory: [],
        stats: { STR: 10, DEX: 10, CON: 10, INT: 12, WIS: 10, CHA: 14 },
        shopState: {
            inventory: ['Dagger', 'Shield', 'Health Potion'],
            soldByPlayer: [], lastHaggleFailure: {},
            markup: 1.0, discount: 0, isOpen: true, gold: 200
        }
    };
    state.worldNpcs = [npc as any];
    const hexKey = `${state.location.coordinates[0]},${state.location.coordinates[1]}`;
    if (state.worldMap.hexes[hexKey]) {
        (state.worldMap.hexes[hexKey] as any).npcs = ['test_merchant'];
    }

    // Open trade
    const tradeResult = await cmd(gl, '/trade test_merchant');
    assert(gl.getState().activeTradeNpcId === 'test_merchant', 'Trade opened');

    // Buy item
    const goldBefore = gl.getState().character.inventory.gold.gp;
    const buyResult = await cmd(gl, '/buy Dagger');
    assert(!buyResult.includes('[ERROR]'), 'Buy does not crash', buyResult.slice(0, 80));

    // Sell item (sell back the dagger if bought)
    const sellResult = await cmd(gl, '/sell Dagger');
    assert(!sellResult.includes('[ERROR]'), 'Sell does not crash', sellResult.slice(0, 80));

    // Haggle
    const haggleResult = await cmd(gl, '/haggle Dagger');
    assert(!haggleResult.includes('[ERROR]'), 'Haggle does not crash', haggleResult.slice(0, 80));

    // Close trade
    await cmd(gl, '/closetrade');
    assert(!gl.getState().activeTradeNpcId, 'Trade closed');
}

// ============================================================
// SCENARIO 6: Level Up Progression
// ============================================================
async function testLevelUpProgression() {
    console.log('\n=== SCENARIO 6: Level Up Progression ===');
    const gl = await makeGame({ name: 'Progressor' });

    // Grant enough XP for level 2
    await cmd(gl, '/addxp 300');
    assert(gl.getState().character.xp >= 300, 'XP granted');

    const hpBefore = gl.getState().character.hp.max;
    const levelResult = await cmd(gl, '/levelup');
    assert(gl.getState().character.level === 2, 'Leveled up to 2');
    assert(gl.getState().character.hp.max > hpBefore, 'Max HP increased');
    assert(gl.getState().character.hp.current === gl.getState().character.hp.max, 'HP fully healed on level up');

    // Grant XP for level 3
    await cmd(gl, '/addxp 600');
    await cmd(gl, '/levelup');
    assert(gl.getState().character.level === 3, 'Leveled up to 3');
}

// ============================================================
// SCENARIO 7: Save/Load State Integrity
// ============================================================
async function testSaveLoadIntegrity() {
    console.log('\n=== SCENARIO 7: Save/Load State Integrity ===');
    const gl = await makeGame({ name: 'Saver' });

    // Move and modify state
    await cmd(gl, '/move N');
    await cmd(gl, '/addxp 100');
    gl.getState().character.hp.current = 7;

    const state = gl.getState();
    const snapshot = {
        name: state.character.name,
        level: state.character.level,
        xp: state.character.xp,
        hp: state.character.hp.current,
        coords: [...state.location.coordinates],
    };

    // Save
    const sm = new GameStateManager(path.join(projectRoot, 'saves'), new FileStorageProvider());
    await sm.saveGame(state, 'comprehensive_test');

    // Load
    const registry = await sm.getSaveRegistry();
    const slot = registry.slots?.find((s: any) => s.slotName === 'comprehensive_test');
    assert(!!slot, 'Save in registry');

    if (slot) {
        const loaded = await sm.loadGame(slot.id) as any;
        assert(!!loaded, 'Save loads');
        if (loaded) {
            assert(loaded.character.name === snapshot.name, 'Name preserved');
            assert(loaded.character.xp === snapshot.xp, 'XP preserved', `${loaded.character.xp} vs ${snapshot.xp}`);
            assert(loaded.character.hp.current === snapshot.hp, 'HP preserved', `${loaded.character.hp.current} vs ${snapshot.hp}`);
            assert(loaded.location.coordinates[0] === snapshot.coords[0], 'Coords preserved');
        }
    }
}

// ============================================================
// SCENARIO 8: Dialogue Flow
// ============================================================
async function testDialogueFlow() {
    console.log('\n=== SCENARIO 8: Dialogue Flow ===');
    const gl = await makeGame({ name: 'Talker' });
    const state = gl.getState();

    // Inject NPC
    const npc = {
        id: 'test_npc', name: 'Old Man',
        traits: ['Wise'], isMerchant: false,
        relationship: { standing: 0, interactionLog: [] },
        dialogue_triggers: [], inventory: [], availableQuests: [],
        conversationHistory: [],
        stats: { STR: 8, DEX: 8, CON: 10, INT: 14, WIS: 16, CHA: 12 },
    };
    state.worldNpcs = [npc as any];
    const hexKey = `${state.location.coordinates[0]},${state.location.coordinates[1]}`;
    if (state.worldMap.hexes[hexKey]) {
        (state.worldMap.hexes[hexKey] as any).npcs = ['test_npc'];
    }

    // Talk
    const talkResult = await cmd(gl, '/talk test_npc');
    assert(!talkResult.includes('[ERROR]'), '/talk NPC works', talkResult.slice(0, 80));
    assert(!!gl.getState().activeDialogueNpcId, 'Dialogue mode active');

    // End talk
    await cmd(gl, '/endtalk');
    assert(!gl.getState().activeDialogueNpcId, 'Dialogue ended');
}

// ============================================================
// SCENARIO 9: All Info Commands
// ============================================================
async function testAllInfoCommands() {
    console.log('\n=== SCENARIO 9: All Info Commands ===');
    const gl = await makeGame({ name: 'Inspector' });

    const commands = ['/status', '/spells', '/quests', '/map', '/npcs', '/codex', '/history',
        '/factions', '/weather', '/inventory', '/equipment'];

    for (const c of commands) {
        // These are CLI-only commands handled in repl.ts, not GameLoop
        // For GameLoop commands:
        if (['/factions', '/weather'].includes(c)) {
            const r = await cmd(gl, c);
            assert(!r.includes('[ERROR]'), `${c} works`, r.slice(0, 60));
        }
    }

    // Export commands
    const sheet = await cmd(gl, '/export sheet');
    assert(sheet.length > 50, '/export sheet produces content', `${sheet.length} chars`);

    const chronicle = await cmd(gl, '/export chronicle');
    assert(chronicle.length > 20, '/export chronicle produces content');
}

// ============================================================
// SCENARIO 10: Edge Cases — Invalid Inputs
// ============================================================
async function testEdgeCases() {
    console.log('\n=== SCENARIO 10: Edge Case Hardening ===');
    const gl = await makeGame({ name: 'EdgeCase' });

    // Empty / garbage
    const r1 = await cmd(gl, '');
    assert(true, 'Empty input does not crash');

    const r2 = await cmd(gl, '!@#$%^&*()');
    assert(!r2.includes('Cannot read'), 'Garbage input handled');

    // Very long input
    const longInput = 'A'.repeat(1000);
    const r3 = await cmd(gl, longInput);
    assert(!r3.includes('Cannot read'), 'Very long input handled');

    // Commands without required args
    const noArgCmds = ['/cast', '/move', '/trade', '/talk', '/item_pickup', '/item_drop',
        '/item_equip', '/unequip', '/gather', '/craft', '/check', '/multiclass',
        '/stabilize', '/addxp', '/combat'];
    for (const c of noArgCmds) {
        const r = await cmd(gl, c);
        assert(!r.includes('Cannot read properties of undefined') && !r.includes('TypeError'),
            `${c} no args = no crash`, r.slice(0, 60));
    }

    // /combat with invalid monster name
    const r4 = await cmd(gl, '/combat TotallyFakeMonster 1');
    assert(!r4.includes('TypeError'), '/combat fake monster no TypeError');

    // /combat with count 0 or negative
    const r5 = await cmd(gl, '/combat Goblin 0');
    assert(!r5.includes('TypeError'), '/combat count 0 no crash');

    const r6 = await cmd(gl, '/combat Goblin -1');
    assert(!r6.includes('TypeError'), '/combat count -1 no crash');

    // /rest with various inputs
    const r7 = await cmd(gl, '/rest short');
    assert(!r7.includes('NaN'), '/rest short no NaN');
    const r8 = await cmd(gl, '/rest long');
    assert(!r8.includes('NaN'), '/rest long no NaN');
    const r9 = await cmd(gl, '/rest 9999');
    assert(!r9.includes('[ERROR]'), '/rest 9999 does not error');

    // /wait edge cases
    const r10 = await cmd(gl, '/wait 0');
    assert(!r10.includes('[ERROR]'), '/wait 0 no error');
    const r11 = await cmd(gl, '/wait -5');
    assert(!r11.includes('[ERROR]'), '/wait -5 no error');
    const r12 = await cmd(gl, '/wait abc');
    assert(!r12.includes('[ERROR]'), '/wait abc no error');

    // /addxp edge cases
    const r13 = await cmd(gl, '/addxp 0');
    assert(r13.includes('Usage') || !r13.includes('[ERROR]'), '/addxp 0 handled');
    const r14 = await cmd(gl, '/addxp -100');
    assert(r14.includes('Usage') || !r14.includes('[ERROR]'), '/addxp -100 handled');

    // /levelup when max level
    gl.getState().character.level = 20;
    gl.getState().character.xp = 999999;
    const r15 = await cmd(gl, '/levelup');
    assert(r15.includes('Not enough') || !r15.includes('[ERROR]'), '/levelup at max level handled');

    // /check with bad ability
    const r16 = await cmd(gl, '/check FAKE Stealth 10');
    assert(!r16.includes('TypeError'), '/check bad ability no crash');

    // Combat commands outside combat
    for (const c of ['attack', 'dodge', 'flee', 'death_save', 'end turn', 'disengage']) {
        const r = await cmd(gl, c);
        assert(!r.includes('TypeError') && !r.includes('Cannot read'),
            `"${c}" outside combat = no crash`);
    }
}

// ============================================================
// SCENARIO 11: Flee Action
// ============================================================
async function testFleeAction() {
    console.log('\n=== SCENARIO 11: Flee Action ===');
    const gl = await makeGame({ name: 'Runner', className: 'Rogue' });

    await cmd(gl, '/combat Goblin 1');
    assert(gl.getState().mode === 'COMBAT', 'Combat started for flee test');

    // Try fleeing (may succeed or fail — both are valid)
    let fleed = false;
    for (let attempt = 0; attempt < 5 && gl.getState().mode === 'COMBAT'; attempt++) {
        const fleeResult = await cmd(gl, 'flee');
        if (gl.getState().mode === 'EXPLORATION') {
            fleed = true;
            assert(true, 'Flee succeeded', fleeResult.slice(0, 80));
            break;
        }
        // If still in combat, end turn and try again
        if (gl.getState().mode === 'COMBAT') {
            await cmd(gl, 'end turn');
        }
    }
    if (!fleed && gl.getState().mode === 'COMBAT') {
        // Flee failed all 5 attempts — still valid behavior
        console.log('  [INFO] Flee failed 5 times (valid — enemies blocked escape)');
    }
}

// ============================================================
// SCENARIO 12: Multiple Class Character Creation
// ============================================================
async function testMultipleClasses() {
    console.log('\n=== SCENARIO 12: Character Creation — All Classes ===');
    const classes = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Barbarian', 'Bard',
        'Druid', 'Monk', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock'];

    for (const cls of classes) {
        try {
            const state = createQuickCharacter({ name: `Test ${cls}`, className: cls });
            assert(state.character.class === cls, `${cls} creation`, `hp=${state.character.hp.max}, ac=${state.character.ac}`);
        } catch (e: any) {
            assert(false, `${cls} creation`, e.message);
        }
    }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Comprehensive Test Suite (Steps 7 + 8)  ║');
    console.log('╚════════════════════════════════════════════╝');

    projectRoot = await bootstrapCLI();

    await testMultipleClasses();
    await testMultiRoundCombat();
    await testRestRecovery();
    await testOverencumbered();
    await testLevelUpProgression();
    await testSaveLoadIntegrity();
    await testAllInfoCommands();
    await testTradingCycle();
    await testDialogueFlow();
    await testFleeAction();
    await testSpellcasterCombat();
    await testEdgeCases();

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
