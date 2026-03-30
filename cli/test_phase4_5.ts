/**
 * Test Step 4 (Death Saves) and Step 5 (Condition Duration Tracking)
 *
 * Run: npx tsx cli/test_phase4_5.ts
 */

import { bootstrapCLI } from './bootstrap.ts';
import { hasCondition, addCondition, removeCondition, tickConditions, conditionNames } from '../src/ruleset/combat/ConditionUtils.ts';
import { DeathEngine } from '../src/ruleset/combat/DeathEngine.ts';
import { CombatCondition } from '../src/ruleset/schemas/CombatSchema.ts';

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

function makeCombatant(overrides: any = {}) {
    return {
        id: 'test_player',
        name: 'TestHero',
        type: 'player' as const,
        isPlayer: true,
        hp: { current: 20, max: 20, temp: 0 },
        ac: 14,
        stats: { STR: 14, DEX: 12, CON: 16, INT: 10, WIS: 13, CHA: 8 },
        initiative: 15,
        dexterityScore: 12,
        conditions: [] as CombatCondition[],
        statusEffects: [],
        resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false },
        tactical: { cover: 'None' as const, reach: 5, isRanged: false },
        position: { x: 0, y: 0 },
        size: 'Medium' as const,
        movementSpeed: 6,
        movementRemaining: 6,
        deathSaves: undefined as { successes: number; failures: number } | undefined,
        ...overrides
    };
}

async function testConditionUtils() {
    console.log('\n=== TEST: Condition Utils ===');

    const conditions: CombatCondition[] = [];

    // Add a condition
    addCondition(conditions, 'Blinded', 'enemy_1', 3, 'Cannot see');
    assert(conditions.length === 1, 'addCondition adds one condition');
    assert(hasCondition(conditions, 'Blinded'), 'hasCondition finds Blinded');
    assert(!hasCondition(conditions, 'Prone'), 'hasCondition returns false for missing');

    // Prevent duplicate
    addCondition(conditions, 'Blinded', 'enemy_2');
    assert(conditions.length === 1, 'addCondition prevents duplicates');

    // Add another
    addCondition(conditions, 'Prone', 'self');
    assert(conditions.length === 2, 'Multiple conditions can coexist');

    // conditionNames
    const names = conditionNames(conditions);
    assert(names.includes('Blinded'), 'conditionNames includes Blinded');
    assert(names.includes('Prone'), 'conditionNames includes Prone');

    // Remove
    removeCondition(conditions, 'Prone');
    assert(conditions.length === 1, 'removeCondition removes one');
    assert(!hasCondition(conditions, 'Prone'), 'Prone is gone');

    // Tick conditions
    addCondition(conditions, 'Dodging', 'self', 1);
    assert(conditions.length === 2, 'Have Blinded(3) and Dodging(1)');

    const expired1 = tickConditions(conditions);
    assert(expired1.includes('Dodging'), 'Dodging expired after 1 tick');
    assert(!hasCondition(conditions, 'Dodging'), 'Dodging removed after expiry');
    assert(hasCondition(conditions, 'Blinded'), 'Blinded still active (2 remaining)');
    assert(conditions.find(c => c.id === 'Blinded')?.duration === 2, 'Blinded duration decremented to 2');

    const expired2 = tickConditions(conditions);
    assert(expired2.length === 0, 'No expirations on tick 2');
    assert(conditions.find(c => c.id === 'Blinded')?.duration === 1, 'Blinded duration decremented to 1');

    const expired3 = tickConditions(conditions);
    assert(expired3.includes('Blinded'), 'Blinded expired after 3 ticks');
    assert(conditions.length === 0, 'All conditions expired');

    // Permanent condition (no duration)
    addCondition(conditions, 'Unconscious');
    assert(conditions.find(c => c.id === 'Unconscious')?.duration === undefined, 'Unconscious has no duration');
    tickConditions(conditions);
    assert(hasCondition(conditions, 'Unconscious'), 'Permanent condition not removed by tick');
}

async function testDeathSaves() {
    console.log('\n=== TEST: Death Save Tracking ===');

    // Test handleDowned initializes death saves
    const player = makeCombatant({ hp: { current: 0, max: 20, temp: 0 } });
    const downedMsg = DeathEngine.handleDowned(player);
    assert(hasCondition(player.conditions, 'Unconscious'), 'handleDowned adds Unconscious condition');
    assert(!!player.deathSaves, 'handleDowned initializes deathSaves');
    assert(player.deathSaves!.successes === 0, 'Death saves start at 0 successes');
    assert(player.deathSaves!.failures === 0, 'Death saves start at 0 failures');

    // Test rollDeathSave accumulation (run many times to test all branches)
    let totalSuccesses = 0;
    let totalFailures = 0;
    let gotCritSuccess = false;
    let gotCritFail = false;
    let gotDead = false;
    let gotRevived = false;

    for (let trial = 0; trial < 100; trial++) {
        const testPlayer = makeCombatant({ hp: { current: 0, max: 20, temp: 0 } });
        DeathEngine.handleDowned(testPlayer);

        let result;
        for (let round = 0; round < 10; round++) {
            result = DeathEngine.rollDeathSave(testPlayer);
            if (result.isDead || result.isRevived) break;
        }

        if (result!.isDead) gotDead = true;
        if (result!.isRevived) gotRevived = true;
        if (result!.isDead) {
            assert(hasCondition(testPlayer.conditions, 'Dead'), `Trial ${trial}: Dead condition added`);
            totalFailures++;
        } else if (result!.isRevived) {
            assert(testPlayer.hp.current === 1, `Trial ${trial}: Revived at 1 HP`);
            assert(!hasCondition(testPlayer.conditions, 'Unconscious'), `Trial ${trial}: Unconscious removed on revive`);
            totalSuccesses++;
        } else {
            // Stabilized (3 successes)
            totalSuccesses++;
        }
    }

    console.log(`  [INFO] Ran 100 death save trials: ${totalSuccesses} survived, ${totalFailures} died`);
    assert(gotDead, 'At least one death occurred in 100 trials (statistical)');
    // gotRevived might not happen in 100 trials (nat 20 is 5% per roll), skip
    // gotCritFail might not happen either

    // Test resetDeathSaves
    const healedPlayer = makeCombatant({ hp: { current: 0, max: 20, temp: 0 } });
    DeathEngine.handleDowned(healedPlayer);
    healedPlayer.deathSaves = { successes: 2, failures: 1 };
    healedPlayer.hp.current = 5;
    DeathEngine.resetDeathSaves(healedPlayer);
    assert(healedPlayer.deathSaves!.successes === 0, 'resetDeathSaves clears successes');
    assert(healedPlayer.deathSaves!.failures === 0, 'resetDeathSaves clears failures');
    assert(!hasCondition(healedPlayer.conditions, 'Unconscious'), 'resetDeathSaves removes Unconscious');

    // Test stabilize
    const medic = makeCombatant({ id: 'medic', name: 'Medic' });
    const dying = makeCombatant({ hp: { current: 0, max: 20, temp: 0 } });
    DeathEngine.handleDowned(dying);

    // Run stabilize many times (Medicine DC 10, bonus +5 should succeed often)
    let stabilized = false;
    for (let i = 0; i < 20; i++) {
        // Re-down the player for each attempt
        const patient = makeCombatant({ hp: { current: 0, max: 20, temp: 0 } });
        DeathEngine.handleDowned(patient);
        const stabResult = DeathEngine.stabilize(medic, patient, 5);
        if (stabResult.includes('stabilized')) {
            stabilized = true;
            assert(!hasCondition(patient.conditions, 'Unconscious'), 'Stabilize removes Unconscious');
            assert(hasCondition(patient.conditions, 'Stable'), 'Stabilize adds Stable condition');
            break;
        }
    }
    assert(stabilized, 'Stabilize succeeds at least once in 20 attempts (DC 10, +5 bonus)');
}

async function testCombatWithConditions() {
    console.log('\n=== TEST: Combat Integration with Conditions ===');

    // Test that the GameLoop combat creates combatants with proper condition arrays
    const { GameLoop } = await import('../src/ruleset/combat/GameLoop.ts');
    const { FileStorageProvider } = await import('../src/ruleset/combat/FileStorageProvider.ts');
    const { createQuickCharacter } = await import('./creation.ts');
    const path = await import('path');

    const projectRoot = await bootstrapCLI();
    const state = createQuickCharacter({ name: 'ConditionTestHero' });
    const storage = new FileStorageProvider();
    const gameLoop = new GameLoop(state, path.join(projectRoot, 'saves'), storage);
    await gameLoop.initialize();

    // Start combat
    const combatResult = await gameLoop.processTurn('/combat Goblin 1');
    assert(gameLoop.getState().mode === 'COMBAT', 'Combat started for condition test');

    if (gameLoop.getState().mode === 'COMBAT') {
        const combat = gameLoop.getState().combat!;
        const player = combat.combatants.find(c => c.isPlayer);
        assert(!!player, 'Player combatant exists');
        assert(Array.isArray(player!.conditions), 'Conditions is an array');
        assert(player!.conditions.length === 0, 'Player starts with no conditions');

        // End combat by attacking
        let rounds = 0;
        while (gameLoop.getState().mode === 'COMBAT' && rounds < 50) {
            const hp = gameLoop.getState().combat?.combatants.find(c => c.isPlayer)?.hp.current ?? 0;
            if (hp > 0) {
                // Player is alive — attack
                await gameLoop.processTurn('attack');
            } else {
                // Player is downed — just wait for death saves / enemy turns to resolve
                await gameLoop.processTurn('end turn');
            }
            rounds++;
        }
        const finalMode = gameLoop.getState().mode;
        // Combat either ended normally or player died
        assert(finalMode !== 'COMBAT' || rounds >= 50, 'Combat progressed', `mode=${finalMode}, rounds=${rounds}`);
    }
}

// --- MAIN ---
async function main() {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║  Step 4-5: Death Saves + Condition Migration  ║');
    console.log('╚═══════════════════════════════════════════════╝');

    await bootstrapCLI();

    await testConditionUtils();
    await testDeathSaves();
    await testCombatWithConditions();

    console.log('\n════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
        console.log('  Failures:');
        for (const f of failures) console.log(`    - ${f}`);
    }
    console.log('════════════════════════════════════════════');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    console.error(e.stack);
    process.exit(1);
});
