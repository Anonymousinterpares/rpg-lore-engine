/**
 * Live Combat Directive Verification
 *
 * Simulates actual CombatAI decisions with different directives
 * and verifies behavioral changes in targeting, action type, and spell use.
 *
 * Run: npx tsx src/ruleset/tests/test_directive_combat_live.ts
 */

if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
}

import { CombatAI, parseDirective } from '../combat/CombatAI';

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg); }

function buildCombatState(overrides?: any) {
    return {
        round: 1,
        currentTurnIndex: 0,
        combatants: [
            {
                id: 'player', name: 'Aldric', type: 'player', isPlayer: true,
                hp: { current: 15, max: 40, temp: 0 }, ac: 16,
                stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
                conditions: [], statusEffects: [],
                position: { x: 5, y: 5 },
                tactical: { reach: 5, isRanged: false },
                spellSlots: {}, preparedSpells: [], resources: {}
            },
            {
                id: 'companion_0', name: 'Grimjaw', type: 'companion', isPlayer: false,
                hp: { current: 25, max: 25, temp: 0 }, ac: 18,
                stats: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 8 },
                conditions: [], statusEffects: [],
                position: { x: 4, y: 5 },
                tactical: { reach: 5, isRanged: false },
                spellSlots: {}, preparedSpells: [], resources: {}
            },
            {
                id: 'companion_1', name: 'Lyra', type: 'companion', isPlayer: false,
                hp: { current: 15, max: 18, temp: 0 }, ac: 12,
                stats: { STR: 8, DEX: 14, CON: 10, INT: 16, WIS: 14, CHA: 12 },
                conditions: [], statusEffects: [],
                position: { x: 3, y: 5 },
                tactical: { reach: 5, isRanged: false },
                spellSlots: { '1': { current: 3, max: 3 } },
                preparedSpells: ['Cure Wounds', 'Magic Missile', 'Shield'],
                resources: {}
            },
            {
                id: 'enemy_0', name: 'Goblin', type: 'enemy', isPlayer: false,
                hp: { current: 7, max: 7, temp: 0 }, ac: 13,
                stats: { STR: 8, DEX: 14, CON: 10, INT: 8, WIS: 8, CHA: 6 },
                conditions: [], statusEffects: [],
                position: { x: 7, y: 5 },
                tactical: { reach: 5, isRanged: false },
                spellSlots: {}, preparedSpells: [], resources: {}
            },
            {
                id: 'enemy_1', name: 'Orc Warchief', type: 'enemy', isPlayer: false,
                hp: { current: 45, max: 45, temp: 0 }, ac: 16,
                stats: { STR: 18, DEX: 12, CON: 16, INT: 10, WIS: 10, CHA: 12 },
                conditions: [], statusEffects: [],
                position: { x: 8, y: 4 },
                tactical: { reach: 5, isRanged: false },
                spellSlots: {}, preparedSpells: [], resources: {}
            },
        ],
        grid: {
            width: 20, height: 20,
            features: [],
            playerStartZone: [{ x: 5, y: 5 }],
            enemyStartZone: [{ x: 8, y: 5 }],
        },
        logs: [], events: [], turnActions: [],
        ...overrides,
    } as any;
}

function runTests() {
    console.log('=== LIVE DIRECTIVE COMBAT VERIFICATION ===\n');

    // ---------------------------------------------------------------
    // Test 1: No directive — default behavior (attack nearest)
    // ---------------------------------------------------------------
    console.log('--- Test 1: No Directive (Default) ---');
    {
        const state = buildCombatState();
        const grimjaw = state.combatants[1]; // companion_0
        const lyra = state.combatants[2]; // companion_1

        const grimAction = CombatAI.decideAction(grimjaw, state);
        const lyraAction = CombatAI.decideAction(lyra, state);

        console.log(`  Grimjaw: ${grimAction.type} → ${grimAction.targetId}`);
        console.log(`  Lyra: ${lyraAction.type} → ${lyraAction.targetId}`);

        check(grimAction.targetId === 'enemy_0', 'Grimjaw targets nearest (Goblin)');
        check(lyraAction.targetId === 'enemy_0', 'Lyra targets nearest (Goblin)');
        check(grimAction.type === 'MOVE' || grimAction.type === 'ATTACK', 'Grimjaw attacks or moves');
    }

    // ---------------------------------------------------------------
    // Test 2: FOCUS directive — targets specific enemy
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: FOCUS Directive (Orc Warchief) ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_0': parseDirective('focus the orc', []),
                'companion_1': parseDirective('focus the orc', []),
            }
        });

        const grimAction = CombatAI.decideAction(state.combatants[1], state);
        const lyraAction = CombatAI.decideAction(state.combatants[2], state);

        console.log(`  Grimjaw: ${grimAction.type} → ${grimAction.targetId}`);
        console.log(`  Lyra: ${lyraAction.type} → ${lyraAction.targetId}`);

        check(grimAction.targetId === 'enemy_1', 'Grimjaw targets Orc Warchief (not nearest Goblin)');
        check(lyraAction.targetId === 'enemy_1', 'Lyra targets Orc Warchief (not nearest Goblin)');
    }

    // ---------------------------------------------------------------
    // Test 3: DEFENSIVE directive — targets enemy threatening player
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: DEFENSIVE Directive ---');
    {
        // Move Orc right next to player to make it the threat
        const state = buildCombatState({
            companionDirectives: {
                'companion_0': parseDirective('be defensive', []),
            }
        });
        state.combatants[4].position = { x: 6, y: 5 }; // Orc adjacent to player

        const grimAction = CombatAI.decideAction(state.combatants[1], state);
        console.log(`  Grimjaw: ${grimAction.type} → ${grimAction.targetId}`);

        // Should target Orc (threat to player) not Goblin (nearest to Grimjaw)
        check(grimAction.targetId === 'enemy_1', 'Grimjaw targets Orc (threatening player) over Goblin');
    }

    // ---------------------------------------------------------------
    // Test 4: DEFENSIVE + low HP — should DODGE
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: DEFENSIVE + Low HP → DODGE ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_0': parseDirective('be defensive', []),
            }
        });
        // Set Grimjaw to critical HP
        state.combatants[1].hp.current = 3;
        state.combatants[1].hp.max = 25;

        const grimAction = CombatAI.decideAction(state.combatants[1], state);
        console.log(`  Grimjaw (3/25 HP): ${grimAction.type} → ${grimAction.targetId}`);

        check(grimAction.type === 'DODGE', 'Grimjaw dodges when low HP + DEFENSIVE');
    }

    // ---------------------------------------------------------------
    // Test 5: SUPPORT directive — healer heals wounded ally
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: SUPPORT Directive (Lyra heals) ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_1': parseDirective('heal the party', []),
            }
        });
        // Player is wounded (below 50%)
        state.combatants[0].hp.current = 15;
        state.combatants[0].hp.max = 40;

        const lyraAction = CombatAI.decideAction(state.combatants[2], state);
        console.log(`  Lyra: ${lyraAction.type} → ${lyraAction.targetId} (spell: ${lyraAction.actionId || 'none'})`);

        check(lyraAction.type === 'SPELL', 'Lyra casts a spell');
        check(lyraAction.targetId === 'player', 'Lyra targets wounded player');
        check(lyraAction.actionId?.includes('Cure') === true, `Lyra uses healing spell: ${lyraAction.actionId}`);
    }

    // ---------------------------------------------------------------
    // Test 6: SUPPORT but no wounded allies — falls through to attack
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: SUPPORT but Everyone Healthy ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_1': parseDirective('heal the party', []),
            }
        });
        // Everyone at full HP
        state.combatants[0].hp.current = 40;
        state.combatants[0].hp.max = 40;

        const lyraAction = CombatAI.decideAction(state.combatants[2], state);
        console.log(`  Lyra: ${lyraAction.type} → ${lyraAction.targetId}`);

        check(lyraAction.type !== 'SPELL', 'Lyra does NOT heal when nobody is wounded');
        check(lyraAction.type === 'ATTACK' || lyraAction.type === 'MOVE', 'Lyra attacks instead');
    }

    // ---------------------------------------------------------------
    // Test 7: PROTECT directive — targets enemy near player
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: PROTECT Directive ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_0': parseDirective('protect me', []),
            }
        });
        // Goblin is close to Grimjaw but far from player
        state.combatants[3].position = { x: 3, y: 5 }; // Goblin near Grimjaw
        state.combatants[4].position = { x: 6, y: 5 }; // Orc near player

        const grimAction = CombatAI.decideAction(state.combatants[1], state);
        console.log(`  Grimjaw: ${grimAction.type} → ${grimAction.targetId}`);

        check(grimAction.targetId === 'enemy_1', 'Grimjaw targets Orc (near player) not Goblin (near self)');
    }

    // ---------------------------------------------------------------
    // Test 8: AGGRESSIVE directive — targets weakest enemy
    // ---------------------------------------------------------------
    console.log('\n--- Test 8: AGGRESSIVE Directive ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_0': parseDirective('go aggressive', []),
            }
        });
        // Orc is closer but has more HP; Goblin is farther but weaker
        state.combatants[3].hp.current = 3; // Goblin nearly dead
        state.combatants[4].position = { x: 5, y: 6 }; // Orc adjacent to Grimjaw

        const grimAction = CombatAI.decideAction(state.combatants[1], state);
        console.log(`  Grimjaw: ${grimAction.type} → ${grimAction.targetId} (Goblin HP=3, Orc HP=45)`);

        check(grimAction.targetId === 'enemy_0', 'Grimjaw targets weakest (Goblin at 3 HP)');
    }

    // ---------------------------------------------------------------
    // Test 9: Per-companion vs global — different orders
    // ---------------------------------------------------------------
    console.log('\n--- Test 9: Per-Companion Directives ---');
    {
        const state = buildCombatState({
            companionDirectives: {
                'companion_0': parseDirective('be defensive', []),
                'companion_1': parseDirective('focus the orc', []),
            }
        });
        state.combatants[1].hp.current = 5; // Grimjaw low HP for dodge

        const grimAction = CombatAI.decideAction(state.combatants[1], state);
        const lyraAction = CombatAI.decideAction(state.combatants[2], state);

        console.log(`  Grimjaw (DEFENSIVE, 5HP): ${grimAction.type} → ${grimAction.targetId}`);
        console.log(`  Lyra (FOCUS orc): ${lyraAction.type} → ${lyraAction.targetId}`);

        check(grimAction.type === 'DODGE', 'Grimjaw dodges (DEFENSIVE + low HP)');
        check(lyraAction.targetId === 'enemy_1', 'Lyra focuses Orc Warchief');
    }

    // ---------------------------------------------------------------
    // Test 10: Text directive parsing — multi-NPC
    // ---------------------------------------------------------------
    console.log('\n--- Test 10: Multi-NPC Text Parsing ---');
    {
        const d1 = parseDirective('both be defensive', []);
        check(d1.behavior === 'DEFENSIVE', `"both be defensive" → ${d1.behavior}`);

        const d2 = parseDirective('defensive', []);
        check(d2.behavior === 'DEFENSIVE', `"defensive" → ${d2.behavior}`);

        const d3 = parseDirective('stay back and play safe', []);
        check(d3.behavior === 'DEFENSIVE', `"stay back and play safe" → ${d3.behavior}`);

        const d4 = parseDirective('go offensive', []);
        check(d4.behavior === 'AGGRESSIVE', `"go offensive" → ${d4.behavior}`);
    }

    console.log('\n=== ALL DIRECTIVE COMBAT TESTS COMPLETE ===');
}

runTests();
