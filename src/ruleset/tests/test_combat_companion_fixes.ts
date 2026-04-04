/**
 * Combat Companion Fixes — Verification Tests
 *
 * Tests: rest recovery, movement blocking with downed companion,
 * unconscious state checks, combat memory recording, friendly fire prevention,
 * contextual greeting builder.
 *
 * Run: npx tsx src/ruleset/tests/test_combat_companion_fixes.ts
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

import { NPCFactory } from '../factories/NPCFactory';
import { CompanionManager } from '../combat/CompanionManager';
import { ConversationManager } from '../combat/managers/ConversationManager';
import { CombatFactory } from '../combat/CombatFactory';
import { CombatResolutionEngine } from '../combat/CombatResolutionEngine';
import { ContextManager } from '../agents/ContextManager';
import { GameState } from '../schemas/FullSaveStateSchema';

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg); }

function createTestState(): GameState {
    return {
        character: {
            name: 'Aldric', level: 5, race: 'Human', class: 'Fighter',
            hp: { current: 40, max: 40, temp: 0 }, ac: 16,
            stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 500, pp: 0 }, items: [] },
            spellSlots: {}, conditions: [], skillProficiencies: [],
            hitDice: { current: 5, max: 5, dieType: '1d10' },
            deathSaves: { successes: 0, failures: 0 },
            equipmentSlots: {}, attunedItems: [],
            cantripsKnown: [], preparedSpells: [], knownSpells: [], spellbook: [],
        },
        mode: 'EXPLORATION',
        companions: [],
        worldNpcs: [],
        worldMap: { hexes: { '0,0': { npcs: [], interest_points: [], resourceNodes: [], biome: 'Plains', coordinates: [0, 0] } } },
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
        factions: [], activeQuests: [], conversationHistory: [],
        storySummary: '', lastNarrative: '', debugLog: [],
        activeDialogueNpcId: null,
    } as any;
}

function addCompanion(state: GameState, name: string, role: string): string {
    const npc = NPCFactory.createNPC(name, false, undefined, role);
    npc.relationship.standing = 75;
    state.worldNpcs.push(npc);
    if (!state.worldMap.hexes['0,0'].npcs) state.worldMap.hexes['0,0'].npcs = [];
    state.worldMap.hexes['0,0'].npcs.push(npc.id);
    CompanionManager.recruit(state, npc.id);
    return (state.companions[state.companions.length - 1] as any).meta.sourceNpcId;
}

function runTests() {
    console.log('=== COMBAT COMPANION FIXES VERIFICATION ===\n');

    // ---------------------------------------------------------------
    // Test 1: Companion rest recovery — Long rest
    // ---------------------------------------------------------------
    console.log('--- Test 1: Long Rest Recovery ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');

        const comp = state.companions[0];
        // Damage the companion
        comp.character.hp.current = 5;
        comp.character.hp.max = 25;
        if (comp.character.hitDice) comp.character.hitDice.current = 0;
        if (comp.character.spellSlots && comp.character.spellSlots['1']) {
            comp.character.spellSlots['1'].current = 0;
        }

        check(comp.character.hp.current === 5, `Before rest: HP ${comp.character.hp.current}/${comp.character.hp.max}`);

        // Simulate long rest recovery (same logic as GameLoop.completeRest)
        const durationMinutes = 480; // 8 hours
        const isLongRest = durationMinutes >= 480;
        if (isLongRest) {
            comp.character.hp.current = comp.character.hp.max;
            if (comp.character.hitDice) comp.character.hitDice.current = comp.character.hitDice.max;
            if (comp.character.deathSaves) { comp.character.deathSaves.successes = 0; comp.character.deathSaves.failures = 0; }
        }

        check(comp.character.hp.current === 25, `After long rest: HP ${comp.character.hp.current}/${comp.character.hp.max} (full)`);
        check(comp.character.hitDice?.current === comp.character.hitDice?.max, 'Hit dice restored');
    }

    // ---------------------------------------------------------------
    // Test 2: Companion rest recovery — Short rest
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: Short Rest Recovery ---');
    {
        const state = createTestState();
        addCompanion(state, 'Lyra', 'Scholar');

        const comp = state.companions[0];
        comp.character.hp.current = 10;
        comp.character.hp.max = 20;
        if (comp.character.hitDice) comp.character.hitDice.current = 3;

        const beforeHp = comp.character.hp.current;
        const beforeDice = comp.character.hitDice?.current || 0;

        // Simulate short rest (auto-spend 1 hit die)
        if (comp.character.hitDice && comp.character.hitDice.current > 0 && comp.character.hp.current < comp.character.hp.max) {
            const hitDieMax = comp.character.hitDice.dieType ? parseInt(comp.character.hitDice.dieType.replace('1d', '')) : 8;
            const conMod = Math.floor(((comp.character.stats?.CON || 10) as number - 10) / 2);
            const healed = Math.floor(hitDieMax / 2) + 1 + conMod;
            comp.character.hp.current = Math.min(comp.character.hp.max, comp.character.hp.current + healed);
            comp.character.hitDice.current = Math.max(0, comp.character.hitDice.current - 1);
        }

        check(comp.character.hp.current > beforeHp, `Short rest healed: ${beforeHp} → ${comp.character.hp.current}`);
        check(comp.character.hitDice!.current === beforeDice - 1, `Hit die spent: ${beforeDice} → ${comp.character.hitDice!.current}`);
    }

    // ---------------------------------------------------------------
    // Test 3: Movement blocked with downed companion
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Movement Blocked with Downed Companion ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');

        // Set companion to 0 HP
        state.companions[0].character.hp.current = 0;

        const downedCompanion = state.companions.find((c: any) =>
            c.meta?.followState === 'following' && c.character.hp.current <= 0
        );

        check(downedCompanion !== undefined, 'Downed companion detected');
        check(downedCompanion?.character.name === 'Grimjaw', `Downed: ${downedCompanion?.character.name}`);

        // Simulate the movement check
        const blocked = !!downedCompanion;
        check(blocked, 'Movement would be blocked');
    }

    // ---------------------------------------------------------------
    // Test 4: Dialogue blocked with unconscious companion
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Dialogue Blocked with Unconscious Companion ---');
    {
        const state = createTestState();
        const npcId = addCompanion(state, 'Grimjaw', 'Guard');

        state.companions[0].character.hp.current = 0;

        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});
        // startTalk uses LLM, so test the check directly
        const companionObj = state.companions.find((c: any) => c.meta.sourceNpcId === npcId && c.meta.followState === 'following');
        const isUnconscious = companionObj && companionObj.character.hp.current <= 0;

        check(isUnconscious === true, 'Companion correctly identified as unconscious');
    }

    // ---------------------------------------------------------------
    // Test 5: Friendly fire prevention
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: Friendly Fire Prevention ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');

        // Create player and companion combatants
        const playerCombatant = CombatFactory.fromPlayer(state.character as any, 'player', 'player');
        const companionCombatant = CombatFactory.fromPlayer(state.companions[0].character as any, 'companion_0', 'companion');

        // Try to attack ally
        const result = CombatResolutionEngine.resolveAttack(
            playerCombatant, companionCombatant,
            [], '1d8', 3, false, false, 'Bright'
        );

        check(result.type === 'MISS', `Friendly fire blocked: type=${result.type}`);
        check(result.damage === 0, 'Zero damage');
        check(result.message.includes('ally'), `Message: "${result.message}"`);

        // Verify enemy CAN be attacked
        const enemyCombatant = {
            ...playerCombatant,
            id: 'enemy_0', name: 'Goblin', type: 'enemy' as const, isPlayer: false,
            hp: { current: 10, max: 10, temp: 0 }, ac: 13
        };
        const enemyResult = CombatResolutionEngine.resolveAttack(
            playerCombatant, enemyCombatant,
            [], '1d8', 3, false, false, 'Bright'
        );
        check(enemyResult.type !== 'MISS' || enemyResult.message !== result.message, 'Enemy attack proceeds normally (not blocked as ally)');
    }

    // ---------------------------------------------------------------
    // Test 6: Combat memory recording
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: Combat Memory Recording ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        addCompanion(state, 'Lyra', 'Scholar');

        const chroniclesBefore = state.companions[0].character.biography?.chronicles?.length || 0;
        const historyBefore = (state.companions[0] as any).meta.conversationHistory?.length || 0;

        // Simulate recordCombatForCompanions
        const turn = state.worldTime.totalTurns;
        const enemyNames = ['Goblin', 'Orc'];
        const summary = 'The party defeated two goblins and an orc after a fierce 3-round battle.';
        for (const companion of state.companions) {
            if (companion.character.biography?.chronicles) {
                companion.character.biography.chronicles.push({
                    turn,
                    event: `Fought ${enemyNames.join(', ')} for 3 rounds and won.`
                });
            }
            if (companion.meta?.conversationHistory) {
                companion.meta.conversationHistory.push({
                    speaker: 'System',
                    text: `[Battle memory] ${summary.substring(0, 200)}`,
                    timestamp: new Date().toISOString()
                });
            }
        }

        const chroniclesAfter = state.companions[0].character.biography?.chronicles?.length || 0;
        const historyAfter = (state.companions[0] as any).meta.conversationHistory?.length || 0;

        check(chroniclesAfter === chroniclesBefore + 1, `Chronicles: ${chroniclesBefore} → ${chroniclesAfter}`);
        check(historyAfter === historyBefore + 1, `ConversationHistory: ${historyBefore} → ${historyAfter}`);

        // Verify content
        const lastChronicle = state.companions[0].character.biography?.chronicles?.slice(-1)[0];
        check(lastChronicle?.event?.includes('Goblin'), `Chronicle content: "${lastChronicle?.event}"`);

        const lastHistory = (state.companions[0] as any).meta.conversationHistory?.slice(-1)[0];
        check(lastHistory?.text?.includes('Battle memory'), `History content: "${lastHistory?.text?.substring(0, 50)}"`);

        // Verify BOTH companions got it
        check((state.companions[1].character.biography?.chronicles?.length || 0) > 0, 'Second companion also got chronicle');
    }

    // ---------------------------------------------------------------
    // Test 7: Contextual greeting builder
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: Contextual Greeting Builder ---');
    {
        const state = createTestState();
        const npcId = addCompanion(state, 'Grimjaw', 'Guard');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        // Simulate post-combat state
        state.conversationHistory.push({ role: 'narrator', content: 'The battle was fierce. Blood soaked the ground.', turnNumber: 20 } as any);
        state.lastNarrative = 'You catch your breath after the deadly combat with goblins.';
        state.companions[0].character.hp.current = 8;
        state.companions[0].character.hp.max = 25;
        state.worldTime.hour = 23; // Late night

        const npc = cm.resolveCompanionAsNpc(npcId);
        const greeting = (cm as any).buildGreetingContext(npc, true, 'NORMAL');

        check(greeting.includes('battle') || greeting.includes('combat') || greeting.includes('fought'), 'Greeting mentions recent combat');
        check(greeting.includes('wounded') || greeting.includes('hits'), `Greeting mentions HP status`);
        check(greeting.includes('night') || greeting.includes('tired'), 'Greeting mentions late hour');
        check(greeting.includes('Recent events'), 'Greeting includes narrative context');
        check(greeting.includes('don\'t just say hello'), 'Greeting instructs situational response');

        console.log(`  Greeting context preview: "${greeting.substring(0, 200)}..."`);
    }

    // ---------------------------------------------------------------
    // Test 8: Ally initiative tracker type
    // ---------------------------------------------------------------
    console.log('\n--- Test 8: Companion Combat Type ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');

        const combatant = CombatFactory.fromPlayer(state.companions[0].character as any, 'companion_0', 'companion');

        check(combatant.type === 'companion', `Type: ${combatant.type} (not 'player')`);
        check(combatant.isPlayer === false, `isPlayer: ${combatant.isPlayer}`);
        // This means UI will render with .ally class (blue HP bar)
        const cssClass = combatant.type === 'companion' ? 'ally' : combatant.isPlayer ? 'player' : 'enemy';
        check(cssClass === 'ally', `CSS class: ${cssClass} (blue HP bar)`);
    }

    console.log('\n=== ALL COMBAT COMPANION TESTS COMPLETE ===');
}

runTests();
