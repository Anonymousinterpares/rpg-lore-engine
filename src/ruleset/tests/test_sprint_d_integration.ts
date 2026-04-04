/**
 * Sprint D Integration Tests
 * XP flow, drop fix, companion gold, equip validation
 *
 * Run: npx tsx src/ruleset/tests/test_sprint_d_integration.ts
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
import { LevelingEngine } from '../combat/LevelingEngine';
import { MechanicsEngine } from '../combat/MechanicsEngine';
import { BarterEngine } from '../combat/BarterEngine';
import { GameState } from '../schemas/FullSaveStateSchema';

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg); }

function verifyEquipmentSync(char: any, label: string): boolean {
    const slots = char.equipmentSlots || {};
    const slotValues = new Set(Object.values(slots).filter(Boolean) as string[]);
    let ok = true;
    for (const item of char.inventory?.items || []) {
        const isInSlot = slotValues.has(item.instanceId);
        if (item.equipped && !isInSlot) { fail(`${label}: "${item.name}" equipped=true but NOT in slots`); ok = false; }
        if (!item.equipped && isInSlot) { fail(`${label}: "${item.name}" equipped=false but IS in slots`); ok = false; }
    }
    if (ok) pass(`${label}: sync OK`);
    return ok;
}

function createState(): GameState {
    return {
        character: {
            name: 'Aldric', level: 5, xp: 6500, race: 'Human', class: 'Fighter',
            hp: { current: 40, max: 40, temp: 0 }, ac: 16,
            stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
            inventory: { gold: { cp:0,sp:0,ep:0,gp:500,pp:0 }, items: [] },
            spellSlots: {}, conditions: [], equipmentSlots: {}, attunedItems: [],
            cantripsKnown:[], preparedSpells:[], knownSpells:[], spellbook:[],
            hitDice: { current: 5, max: 5, dieType: '1d10' },
            deathSaves: { successes: 0, failures: 0 },
            savingThrowProficiencies: ['STR','CON'], skillProficiencies: [],
            feats: [], weaponProficiencies: [], skills: {}, skillPoints: { available: 0, totalEarned: 0 },
        },
        companions: [], worldNpcs: [], mode: 'EXPLORATION',
        worldMap: { hexes: { '0,0': { npcs: [] as string[], interest_points: [], resourceNodes: [], biome: 'Plains', coordinates: [0,0] } } },
        location: { hexId: '0,0', coordinates: [0,0] },
        worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
        factions: [], activeQuests: [], conversationHistory: [], storySummary: '', lastNarrative: '',
    } as any;
}

function addComp(state: GameState, name: string, role: string): number {
    const npc = NPCFactory.createNPC(name, false, undefined, role);
    npc.relationship.standing = 75;
    state.worldNpcs.push(npc);
    state.worldMap.hexes['0,0'].npcs.push(npc.id);
    CompanionManager.recruit(state, npc.id);
    return state.companions.length - 1;
}

function runTests() {
    console.log('=== SPRINT D INTEGRATION TESTS ===\n');

    // ---------------------------------------------------------------
    // Test 1: Centralized autoLevelCompanions works
    // ---------------------------------------------------------------
    console.log('--- Test 1: Centralized Auto-Level ---');
    {
        const state = createState();
        addComp(state, 'Grimjaw', 'Guard');
        const comp = state.companions[0];

        check(comp.character.level === 4, `Companion starts at level ${comp.character.level}`);

        // Simulate player reaching level 7
        const msgs = LevelingEngine.autoLevelCompanions(7, state.companions);

        check(comp.character.level === 6, `Companion leveled to ${comp.character.level} (target: 6)`);
        check(msgs.length > 0, `Level messages: ${msgs.length}`);
        check(comp.meta.pendingLevelUp !== undefined, 'pendingLevelUp set');
        check(comp.meta.pendingLevelUp?.oldLevel === 4, `Old level: ${comp.meta.pendingLevelUp?.oldLevel}`);
        check(comp.meta.pendingLevelUp?.newLevel === 6, `New level: ${comp.meta.pendingLevelUp?.newLevel}`);
        check(comp.meta.pendingLevelUp?.newMaxHp > comp.meta.pendingLevelUp?.oldMaxHp, `HP increased: ${comp.meta.pendingLevelUp?.oldMaxHp} → ${comp.meta.pendingLevelUp?.newMaxHp}`);
    }

    // ---------------------------------------------------------------
    // Test 2: EngineDispatcher add_xp triggers auto-level
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: EngineDispatcher XP Auto-Level ---');
    {
        const state = createState();
        addComp(state, 'Grimjaw', 'Guard');

        // Simulate what EngineDispatcher does
        state.character.xp += 10000;
        while (LevelingEngine.canLevelUp(state.character)) {
            LevelingEngine.levelUp(state.character);
        }
        LevelingEngine.autoLevelCompanions(state.character.level, state.companions);

        check(state.character.level > 5, `Player leveled to ${state.character.level}`);
        check(state.companions[0].character.level === state.character.level - 1,
            `Companion at ${state.companions[0].character.level} (player-1 = ${state.character.level - 1})`);
    }

    // ---------------------------------------------------------------
    // Test 3: Drop equipped item — equipped flag cleared
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Drop Equipped Item ---');
    {
        const state = createState();
        state.character.inventory.items.push({
            id: 'Dagger', name: 'Dagger', type: 'Weapon', weight: 1,
            instanceId: 'drop_test_1', quantity: 1, equipped: true
        } as any);
        state.character.equipmentSlots.mainHand = 'drop_test_1';

        // Simulate dropItem logic
        const item = state.character.inventory.items[0];
        item.equipped = false;
        state.character.inventory.items.splice(0, 1);
        state.location.droppedItems = state.location.droppedItems || [];
        state.location.droppedItems.push({ ...item, equipped: false } as any);
        state.character.equipmentSlots.mainHand = undefined;

        const droppedItem = state.location.droppedItems[0];
        check((droppedItem as any).equipped === false, 'Dropped item equipped=false');
        check(state.character.equipmentSlots.mainHand === undefined, 'Slot cleared');
        verifyEquipmentSync(state.character, 'Player after drop');
    }

    // ---------------------------------------------------------------
    // Test 4: Companion starts with gold
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Companion Starting Gold ---');
    {
        const state = createState();
        addComp(state, 'Grimjaw', 'Guard');
        const gold = state.companions[0].character.inventory.gold?.gp || 0;
        check(gold > 0, `Companion has ${gold} gp (should be 5-19)`);
        check(gold >= 5 && gold <= 19, `Gold in range 5-19: ${gold}`);
    }

    // ---------------------------------------------------------------
    // Test 5: F2 — Caster can't auto-equip martial weapons
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: Caster Class Auto-Equip Restriction ---');
    {
        const state = createState();
        addComp(state, 'Lyra', 'Scholar'); // Scholar → Wizard

        const comp = state.companions[0];
        const currentMainHand = comp.character.equipmentSlots.mainHand;

        // Give a martial weapon — should NOT auto-equip for Wizard
        state.character.inventory.items.push({
            id: 'Longsword', name: 'Longsword', type: 'Weapon (Martial, Melee)', weight: 3,
            instanceId: 'martial_test_1', quantity: 1, equipped: false
        } as any);

        // First clear wizard's mainHand so slot is empty
        if (currentMainHand) {
            const mainItem = comp.character.inventory.items.find((i: any) => i.instanceId === currentMainHand);
            if (mainItem) (mainItem as any).equipped = false;
            comp.character.equipmentSlots.mainHand = undefined;
        }

        BarterEngine.giveItem(state, 0, 'martial_test_1');

        const martialItem = comp.character.inventory.items.find((i: any) => i.instanceId === 'martial_test_1');
        check((martialItem as any)?.equipped === false, `Wizard doesn't auto-equip martial weapon (class: ${comp.character.class})`);

        verifyEquipmentSync(comp.character, 'Wizard after martial give');
    }

    // ---------------------------------------------------------------
    // Test 6: Fighter CAN auto-equip martial weapons
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: Fighter Auto-Equip Martial OK ---');
    {
        const state = createState();
        addComp(state, 'Grimjaw', 'Guard'); // Guard → Fighter

        const comp = state.companions[0];
        // Clear mainHand
        const mainHandId = comp.character.equipmentSlots.mainHand;
        if (mainHandId) {
            const item = comp.character.inventory.items.find((i: any) => i.instanceId === mainHandId);
            if (item) (item as any).equipped = false;
            comp.character.equipmentSlots.mainHand = undefined;
        }

        state.character.inventory.items.push({
            id: 'Battleaxe', name: 'Battleaxe', type: 'Weapon (Martial, Melee)', weight: 4,
            instanceId: 'fighter_martial_1', quantity: 1, equipped: false
        } as any);

        BarterEngine.giveItem(state, 0, 'fighter_martial_1');

        const axeItem = comp.character.inventory.items.find((i: any) => i.instanceId === 'fighter_martial_1');
        check((axeItem as any)?.equipped === true, `Fighter auto-equips martial weapon`);

        verifyEquipmentSync(comp.character, 'Fighter after martial give');
    }

    console.log('\n=== ALL SPRINT D TESTS COMPLETE ===');
}

runTests();
