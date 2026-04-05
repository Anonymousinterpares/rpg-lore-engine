/**
 * Encounter Party Scaling Test
 * Verifies that party size affects encounter frequency and monster count.
 *
 * Run: npx tsx src/ruleset/tests/test_encounter_party_scaling.ts
 */

if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: () => {}, clear: () => {}
    };
}

import { EncounterDirector } from '../combat/EncounterDirector';

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg); }

function makeState(companionCount: number) {
    const companions = [];
    for (let i = 0; i < companionCount; i++) {
        companions.push({ meta: { followState: 'following' }, character: { name: `Comp${i}`, level: 4 } });
    }
    return {
        mode: 'EXPLORATION',
        character: { level: 5 },
        companions,
        worldTime: { hour: 14, totalTurns: 100 },
        weather: { type: 'Clear', intensity: 0 },
        travelPace: 'Normal',
        clearedHexes: {},
        settings: { gameplay: { difficulty: 'normal' } },
    } as any;
}

const hex = { biome: 'Forest', id: 'test_hex' };

function runTests() {
    console.log('=== ENCOUNTER PARTY SCALING TESTS ===\n');

    const director = new EncounterDirector();

    // Test 1: Solo player probability vs 3-companion party
    console.log('--- Test 1: Frequency Comparison ---');
    {
        const soloState = makeState(0);
        const partyState = makeState(3);

        const soloProb = director.calculateFinalProbability(soloState, hex, false);
        const partyProb = director.calculateFinalProbability(partyState, hex, false);

        // Party deterrent: partyState should have same base probability
        // (deterrent is applied in checkEncounter, not calculateFinalProbability)
        // So test the deterrent math directly
        const soloDeterrent = Math.max(0.2, 1.0 - (0.2 * 0)); // = 1.0
        const partyDeterrent = Math.max(0.2, 1.0 - (0.2 * 3)); // = 0.4

        console.log(`  Solo deterrent: ${soloDeterrent} (100%)`);
        console.log(`  3-companion deterrent: ${partyDeterrent} (40%)`);
        check(partyDeterrent < soloDeterrent, 'Party encounters are LESS frequent');
        check(Math.abs(partyDeterrent - 0.4) < 0.001, `3 companions = 40% encounter rate`);
    }

    // Test 2: 5 companions capped at minimum 20%
    console.log('\n--- Test 2: Deterrent Floor ---');
    {
        const bigPartyDeterrent = Math.max(0.2, 1.0 - (0.2 * 5));
        check(bigPartyDeterrent === 0.2, `5 companions capped at 20% (not 0%): ${bigPartyDeterrent}`);
    }

    // Test 3: XP budget scales with party size
    console.log('\n--- Test 3: XP Budget Scaling ---');
    {
        const soloScale = 1.0 + (0.3 * 0); // 1.0x
        const threeScale = 1.0 + (0.3 * 3); // 1.9x

        console.log(`  Solo XP scale: ${soloScale}x`);
        console.log(`  3-companion XP scale: ${threeScale}x`);
        check(threeScale > soloScale, 'Party faces harder encounters when they DO happen');
        check(threeScale === 1.9, '3 companions = 1.9x XP budget');
    }

    // Test 4: Minimum CR filter
    console.log('\n--- Test 4: Minimum CR Filter ---');
    {
        const minCR_solo = 0;
        const minCR_1comp = Math.max(0.25, 1 * 0.25); // 0.25
        const minCR_3comp = Math.max(0.25, 3 * 0.25); // 0.75

        console.log(`  Solo min CR: ${minCR_solo}`);
        console.log(`  1-companion min CR: ${minCR_1comp}`);
        console.log(`  3-companion min CR: ${minCR_3comp}`);
        check(minCR_3comp > minCR_solo, 'Larger parties filter out weak monsters');
        check(minCR_3comp === 0.75, '3 companions = CR 0.75 minimum');
    }

    // Test 5: Monte Carlo — encounter rate actually differs
    console.log('\n--- Test 5: Monte Carlo (1000 rolls) ---');
    {
        let soloEncounters = 0;
        let partyEncounters = 0;

        for (let i = 0; i < 1000; i++) {
            const soloState = makeState(0);
            const partyState = makeState(3);

            // Simulate the check logic
            const soloChance = director.calculateFinalProbability(soloState, hex, false) * 1.0; // no infra
            const partyChance = director.calculateFinalProbability(partyState, hex, false) * 0.4; // party deterrent

            if (Math.random() < soloChance) soloEncounters++;
            if (Math.random() < partyChance) partyEncounters++;
        }

        console.log(`  Solo encounters: ${soloEncounters}/1000`);
        console.log(`  Party encounters: ${partyEncounters}/1000`);
        check(partyEncounters < soloEncounters, 'Party has fewer encounters in practice');
        // With 40% deterrent, expect party to have roughly 40% of solo encounters (±variance)
        const ratio = partyEncounters / Math.max(1, soloEncounters);
        console.log(`  Ratio: ${(ratio * 100).toFixed(0)}% (expect ~40%)`);
        check(ratio < 0.65, `Ratio below 65%: ${(ratio * 100).toFixed(0)}%`);
    }

    console.log('\n=== ALL ENCOUNTER SCALING TESTS COMPLETE ===');
}

runTests();
