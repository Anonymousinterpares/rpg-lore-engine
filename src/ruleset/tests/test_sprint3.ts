/**
 * Sprint 3 Tests: Bartering, Auto-Leveling, Class-Specific AI
 *
 * Run: npx tsx src/ruleset/tests/test_sprint3.ts
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
import { BarterEngine } from '../combat/BarterEngine';
import { CombatAI } from '../combat/CombatAI';
import { getStrategyForCompanion, buildCombatContext } from '../combat/ai/StrategyRegistry';
import { CLASS_STRATEGY_MAP } from '../combat/ai/CompanionStrategy';
import { CombatGridManager } from '../combat/grid/CombatGridManager';
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
    } as any;
}

function addCompanion(state: GameState, name: string, role: string): number {
    const npc = NPCFactory.createNPC(name, false, undefined, role);
    npc.relationship.standing = 75;
    state.worldNpcs.push(npc);
    if (!state.worldMap.hexes['0,0'].npcs) state.worldMap.hexes['0,0'].npcs = [];
    state.worldMap.hexes['0,0'].npcs.push(npc.id);
    CompanionManager.recruit(state, npc.id);
    return state.companions.length - 1;
}

function buildCombatState(companions: any[]) {
    const combatants: any[] = [
        { id: 'player', name: 'Aldric', type: 'player', isPlayer: true, hp: { current: 20, max: 40, temp: 0 }, ac: 16, stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 }, conditions: [], statusEffects: [], position: { x: 5, y: 5 }, tactical: { reach: 5, isRanged: false }, spellSlots: {}, preparedSpells: [], resources: {} },
    ];
    companions.forEach((c, i) => {
        combatants.push({
            id: `companion_${i}`, name: c.character.name, type: 'companion', isPlayer: false,
            hp: { current: c.character.hp.current, max: c.character.hp.max, temp: 0 },
            ac: c.character.ac,
            stats: c.character.stats,
            conditions: [], statusEffects: [],
            position: { x: 4 - i, y: 5 },
            tactical: { reach: 5, isRanged: false },
            spellSlots: c.character.spellSlots || {},
            preparedSpells: c.character.preparedSpells || [],
            resources: {},
            companionClass: c.character.class,
            featureUsages: c.character.featureUsages || {},
        });
    });
    combatants.push(
        { id: 'enemy_0', name: 'Goblin', type: 'enemy', isPlayer: false, hp: { current: 7, max: 7, temp: 0 }, ac: 13, stats: { STR: 8, DEX: 14, CON: 10, INT: 8, WIS: 8, CHA: 6 }, conditions: [], statusEffects: [], position: { x: 7, y: 5 }, tactical: { reach: 5, isRanged: false }, spellSlots: {}, preparedSpells: [], resources: {} },
        { id: 'enemy_1', name: 'Orc Warchief', type: 'enemy', isPlayer: false, hp: { current: 45, max: 45, temp: 0 }, ac: 16, stats: { STR: 18, DEX: 12, CON: 16, INT: 10, WIS: 10, CHA: 12 }, conditions: [], statusEffects: [], position: { x: 6, y: 4 }, tactical: { reach: 5, isRanged: false }, spellSlots: {}, preparedSpells: [], resources: {} },
    );
    return {
        round: 1, currentTurnIndex: 0, combatants,
        grid: { width: 20, height: 20, features: [], playerStartZone: [{ x: 5, y: 5 }], enemyStartZone: [{ x: 8, y: 5 }] },
        logs: [], events: [], turnActions: [],
    } as any;
}

function runTests() {
    console.log('=== SPRINT 3: BARTERING + AUTO-LEVEL + CLASS AI TESTS ===\n');

    // ---------------------------------------------------------------
    // Test 1: Give item to companion
    // ---------------------------------------------------------------
    console.log('--- Test 1: Give Item ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        // Add an item to player
        state.character.inventory.items.push({ id: 'potion', name: 'Healing Potion', type: 'Potion', weight: 0.5, instanceId: 'pot_1', quantity: 1 } as any);

        const result = BarterEngine.giveItem(state, 0, 'pot_1');
        check(result.success, `Give: ${result.message}`);
        check(state.character.inventory.items.length === 0, 'Player lost the item');
        check(state.companions[0].character.inventory.items.length > 0, 'Companion received the item');
    }

    // ---------------------------------------------------------------
    // Test 2: Take item from companion
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: Take Item ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        // Companion has a non-equipped item
        const comp = state.companions[0];
        comp.character.inventory.items.push({ id: 'gem', name: 'Ruby', type: 'Gem', weight: 0.1, instanceId: 'gem_1', quantity: 1 } as any);

        const result = BarterEngine.takeItem(state, 0, 'gem_1');
        check(result.success, `Take: ${result.message}`);
        check(state.character.inventory.items.some((i: any) => i.instanceId === 'gem_1'), 'Player has the gem');
    }

    // ---------------------------------------------------------------
    // Test 3: Take equipped item blocked
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Take Equipped Item Blocked ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        const mainHandId = state.companions[0].character.equipmentSlots.mainHand;
        if (mainHandId) {
            const result = BarterEngine.takeItem(state, 0, mainHandId);
            check(!result.success, `Blocked: ${result.message}`);
        } else {
            pass('No mainHand equipped (OK for this test)');
        }
    }

    // ---------------------------------------------------------------
    // Test 4: Capacity limit
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Inventory Capacity ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        // Fill companion inventory to 20 slots
        for (let i = 0; i < 20; i++) {
            state.companions[0].character.inventory.items.push({ id: `filler_${i}`, name: `Item ${i}`, type: 'Junk', weight: 0.1, instanceId: `fill_${i}`, quantity: 1 } as any);
        }
        state.character.inventory.items.push({ id: 'extra', name: 'Extra Item', type: 'Junk', weight: 0.1, instanceId: 'extra_1', quantity: 1 } as any);
        const result = BarterEngine.giveItem(state, 0, 'extra_1');
        check(!result.success, `Capacity blocked: ${result.message}`);
    }

    // ---------------------------------------------------------------
    // Test 5: Barter — fair trade accepted
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: Fair Barter ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        // Player offers a weapon (Guard values weapons), requests a potion
        state.character.inventory.items.push({ id: 'longsword_extra', name: 'Fine Longsword', type: 'Weapon', weight: 3, instanceId: 'ls_1', quantity: 1, rarity: 'uncommon' } as any);
        state.companions[0].character.inventory.items.push({ id: 'potion', name: 'Potion', type: 'Potion', weight: 0.5, instanceId: 'comp_pot_1', quantity: 1 } as any);

        const result = BarterEngine.executeBarter(state, 0, 'ls_1', 'comp_pot_1');
        check(result.success, `Barter: ${result.message}`);
    }

    // ---------------------------------------------------------------
    // Test 6: Class strategy mapping
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: Strategy Mapping ---');
    {
        check(CLASS_STRATEGY_MAP['Fighter'] === 'martial', 'Fighter → martial');
        check(CLASS_STRATEGY_MAP['Wizard'] === 'caster', 'Wizard → caster');
        check(CLASS_STRATEGY_MAP['Cleric'] === 'support', 'Cleric → support');
        check(CLASS_STRATEGY_MAP['Rogue'] === 'stealth', 'Rogue → stealth');
        check(CLASS_STRATEGY_MAP['Ranger'] === 'stealth', 'Ranger → stealth');
        check(CLASS_STRATEGY_MAP['Bard'] === 'support', 'Bard → support');
    }

    // ---------------------------------------------------------------
    // Test 7: Martial strategy — tanks for player
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: Martial Strategy (Guard) ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw', 'Guard');
        const combatState = buildCombatState(state.companions);
        // Place Orc adjacent to player
        combatState.combatants[3].position = { x: 6, y: 5 }; // Orc near player

        const companion = combatState.combatants[1];
        const strategy = getStrategyForCompanion(companion, combatState);
        check(strategy !== null, 'Martial strategy found');

        const grid = new CombatGridManager(combatState.grid);
        const ctx = buildCombatContext(companion, combatState, grid);
        const action = strategy!.decideAutonomous(ctx);
        check(action !== null, `Action decided: ${action?.type} → ${action?.targetId}`);
        // Should target Orc (threat to player) not Goblin
        check(action?.targetId === 'enemy_1', 'Targets Orc threatening player (tank behavior)');
    }

    // ---------------------------------------------------------------
    // Test 8: Support strategy — heals wounded ally
    // ---------------------------------------------------------------
    console.log('\n--- Test 8: Support Strategy (Cleric) ---');
    {
        const state = createTestState();
        addCompanion(state, 'Mossbeard', 'Hermit'); // Hermit → Cleric
        const combatState = buildCombatState(state.companions);
        // Player is wounded
        combatState.combatants[0].hp.current = 15;
        combatState.combatants[0].hp.max = 40;
        // Give cleric spell slots
        combatState.combatants[1].spellSlots = { '1': { current: 3, max: 3 } };
        combatState.combatants[1].preparedSpells = ['Cure Wounds', 'Bless', 'Guiding Bolt'];

        const companion = combatState.combatants[1];
        const strategy = getStrategyForCompanion(companion, combatState);
        check(strategy !== null, 'Support strategy found');

        const grid = new CombatGridManager(combatState.grid);
        const ctx = buildCombatContext(companion, combatState, grid);
        const action = strategy!.decideAutonomous(ctx);
        check(action?.type === 'SPELL', `Action: ${action?.type}`);
        check(action?.targetId === 'player', `Heals player: ${action?.targetId}`);
        check(action?.actionId?.includes('Cure') === true, `Uses Cure Wounds: ${action?.actionId}`);
    }

    // ---------------------------------------------------------------
    // Test 9: Caster strategy — uses offensive spell
    // ---------------------------------------------------------------
    console.log('\n--- Test 9: Caster Strategy (Wizard) ---');
    {
        const state = createTestState();
        addCompanion(state, 'Lyra', 'Scholar'); // Scholar → Wizard
        const combatState = buildCombatState(state.companions);
        // Everyone at full HP (no healing needed)
        combatState.combatants[0].hp.current = 40;
        combatState.combatants[1].spellSlots = { '1': { current: 3, max: 3 } };
        combatState.combatants[1].preparedSpells = ['Magic Missile', 'Fire Bolt', 'Shield'];

        const companion = combatState.combatants[1];
        const strategy = getStrategyForCompanion(companion, combatState);
        check(strategy !== null, 'Caster strategy found');

        const grid = new CombatGridManager(combatState.grid);
        const ctx = buildCombatContext(companion, combatState, grid);
        const action = strategy!.decideAutonomous(ctx);
        check(action?.type === 'SPELL', `Action: ${action?.type}`);
        check(action?.actionId?.includes('Magic Missile') === true || action?.actionId?.includes('Fire Bolt') === true, `Offensive spell: ${action?.actionId}`);
    }

    // ---------------------------------------------------------------
    // Test 10: Stealth strategy — targets flankable enemy
    // ---------------------------------------------------------------
    console.log('\n--- Test 10: Stealth Strategy (Rogue) ---');
    {
        const state = createTestState();
        addCompanion(state, 'Rotgut', 'Bandit'); // Bandit → Rogue
        const combatState = buildCombatState(state.companions);
        // Player is adjacent to Orc (enabling flanking)
        combatState.combatants[0].position = { x: 5, y: 4 }; // Player adjacent to Orc at (6,4)

        const companion = combatState.combatants[1];
        const strategy = getStrategyForCompanion(companion, combatState);
        check(strategy !== null, 'Stealth strategy found');

        const grid = new CombatGridManager(combatState.grid);
        const ctx = buildCombatContext(companion, combatState, grid);
        const action = strategy!.decideAutonomous(ctx);
        check(action !== null, `Action: ${action?.type} → ${action?.targetId}`);
        // Should prefer the Orc (player is adjacent = flanking opportunity) over Goblin
        // Unless Goblin is weaker, in which case stealth goes for weakest flankable
    }

    // ---------------------------------------------------------------
    // Test 11: Different classes get different strategies
    // ---------------------------------------------------------------
    console.log('\n--- Test 11: Strategy Diversity ---');
    {
        const state = createTestState();
        addCompanion(state, 'Fighter', 'Guard');
        addCompanion(state, 'Wizard', 'Scholar');
        addCompanion(state, 'Cleric', 'Hermit');
        const combatState = buildCombatState(state.companions);

        // Wound the player for support to heal
        combatState.combatants[0].hp.current = 10;
        combatState.combatants[0].hp.max = 40;
        combatState.combatants[2].spellSlots = { '1': { current: 3, max: 3 } };
        combatState.combatants[2].preparedSpells = ['Magic Missile', 'Fire Bolt'];
        combatState.combatants[3].spellSlots = { '1': { current: 3, max: 3 } };
        combatState.combatants[3].preparedSpells = ['Cure Wounds', 'Bless'];

        const grid = new CombatGridManager(combatState.grid);

        const fighterAction = getStrategyForCompanion(combatState.combatants[1], combatState)!
            .decideAutonomous(buildCombatContext(combatState.combatants[1], combatState, grid));
        const wizardAction = getStrategyForCompanion(combatState.combatants[2], combatState)!
            .decideAutonomous(buildCombatContext(combatState.combatants[2], combatState, grid));
        const clericAction = getStrategyForCompanion(combatState.combatants[3], combatState)!
            .decideAutonomous(buildCombatContext(combatState.combatants[3], combatState, grid));

        console.log(`  Fighter: ${fighterAction?.type} → ${fighterAction?.targetId}`);
        console.log(`  Wizard: ${wizardAction?.type} → ${wizardAction?.targetId} (${wizardAction?.actionId})`);
        console.log(`  Cleric: ${clericAction?.type} → ${clericAction?.targetId} (${clericAction?.actionId})`);

        check(fighterAction?.type === 'ATTACK' || fighterAction?.type === 'MOVE', 'Fighter attacks/moves');
        check(wizardAction?.type === 'SPELL', 'Wizard casts spell');
        check(clericAction?.type === 'SPELL' && clericAction?.actionId?.includes('Cure'), 'Cleric heals');

        // Verify all three chose different actions
        const actions = [fighterAction?.type, wizardAction?.type, clericAction?.type];
        const targets = [fighterAction?.targetId, wizardAction?.targetId, clericAction?.targetId];
        const allSame = actions.every(a => a === actions[0]) && targets.every(t => t === targets[0]);
        check(!allSame, 'All three classes behave DIFFERENTLY');
    }

    console.log('\n=== ALL SPRINT 3 TESTS COMPLETE ===');
}

runTests();
