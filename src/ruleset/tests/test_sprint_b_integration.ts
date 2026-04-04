/**
 * Sprint B Integration Test — Two-handed, auto-equip, re-evaluation
 *
 * Run: npx tsx src/ruleset/tests/test_sprint_b_integration.ts
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
import { EquipmentEngine } from '../combat/EquipmentEngine';
import { DataManager } from '../data/DataManager';
import { InventoryEngine } from '../combat/InventoryEngine';
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
    for (const [slot, id] of Object.entries(slots)) {
        if (id && !char.inventory?.items?.some((i: any) => i.instanceId === id)) {
            fail(`${label}: slots.${slot} → orphaned ref "${id}"`); ok = false;
        }
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
    console.log('=== SPRINT B INTEGRATION TESTS ===\n');

    // ---------------------------------------------------------------
    // Test 1: tryAutoEquip respects two-handed — shortbow blocks shield
    // ---------------------------------------------------------------
    console.log('--- Test 1: Two-Handed Blocks Shield Auto-Equip ---');
    {
        const state = createState();
        const idx = addComp(state, 'Archer', 'Hunter');
        const comp = state.companions[idx].character;

        // Ensure mainHand shortbow has Two-Handed property (may be missing if DataManager not loaded)
        const mainItem = comp.inventory.items.find((i: any) => i.instanceId === comp.equipmentSlots.mainHand);
        if (mainItem && !(mainItem as any).properties?.length) {
            (mainItem as any).properties = ['Ammunition', 'Two-Handed'];
        }
        console.log(`  MainHand: ${(mainItem as any)?.name} (props: ${(mainItem as any)?.properties?.join(', ') || 'none'})`);

        // Give a shield — should NOT auto-equip because shortbow is two-handed
        state.character.inventory.items.push({
            id: 'Round Shield', name: 'Round Shield', type: 'Shield', weight: 6,
            instanceId: 'test_shield_1', quantity: 1, equipped: false
        } as any);

        const result = BarterEngine.giveItem(state, idx, 'test_shield_1');
        check(result.success, `Give shield: ${result.message}`);

        const shieldInComp = comp.inventory.items.find((i: any) => i.instanceId === 'test_shield_1');
        check((shieldInComp as any)?.equipped === false, 'Shield NOT auto-equipped (shortbow is two-handed)');
        check(comp.equipmentSlots.offHand === undefined, 'offHand still empty');

        verifyEquipmentSync(comp, 'Companion after shield give');
    }

    // ---------------------------------------------------------------
    // Test 2: Re-evaluate — remove mainHand, backup weapon promoted
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: Re-Evaluate After Removing Weapon ---');
    {
        const state = createState();
        const idx = addComp(state, 'Grimjaw', 'Guard');
        const comp = state.companions[idx].character;

        // Guard has longsword equipped + round shield
        console.log(`  MainHand: ${comp.equipmentSlots.mainHand ? 'equipped' : 'empty'}`);

        // Give a backup dagger (not equipped since mainHand occupied)
        state.character.inventory.items.push({
            id: 'Dagger', name: 'Dagger', type: 'Weapon', weight: 1,
            instanceId: 'test_dagger_1', quantity: 1, equipped: false
        } as any);
        BarterEngine.giveItem(state, idx, 'test_dagger_1');

        const daggerBefore = comp.inventory.items.find((i: any) => i.instanceId === 'test_dagger_1');
        check((daggerBefore as any)?.equipped === false, 'Dagger NOT auto-equipped (mainHand occupied)');

        // Take the longsword
        const mainHandId = comp.equipmentSlots.mainHand;
        const takeResult = BarterEngine.takeItem(state, idx, mainHandId);
        check(takeResult.success, `Take longsword: ${takeResult.message}`);

        // Dagger should now be promoted to mainHand via reEvaluateEquipment
        const daggerAfter = comp.inventory.items.find((i: any) => i.instanceId === 'test_dagger_1');
        check((daggerAfter as any)?.equipped === true, 'Dagger auto-promoted to mainHand after longsword removed');
        check(comp.equipmentSlots.mainHand === 'test_dagger_1', 'mainHand now has dagger');

        verifyEquipmentSync(comp, 'Companion after re-evaluate');
    }

    // ---------------------------------------------------------------
    // Test 3: Player does NOT get auto-equip on take
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Player Never Auto-Equips ---');
    {
        const state = createState();
        const idx = addComp(state, 'Grimjaw', 'Guard');

        // Player has nothing equipped
        check(state.character.equipmentSlots.mainHand === undefined, 'Player mainHand empty');

        // Take weapon from companion
        const mainHandId = state.companions[idx].character.equipmentSlots.mainHand;
        BarterEngine.takeItem(state, idx, mainHandId);

        // Player should have the weapon but NOT equipped
        const takenItem = state.character.inventory.items.find((i: any) => i.instanceId === mainHandId);
        check(takenItem !== undefined, 'Player has weapon');
        check((takenItem as any)?.equipped === false, 'Weapon NOT auto-equipped for player');
        check(state.character.equipmentSlots.mainHand === undefined, 'Player mainHand still empty');

        verifyEquipmentSync(state.character, 'Player after take');
    }

    // ---------------------------------------------------------------
    // Test 4: EquipmentEngine two-handed equip clears offHand
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: EquipmentEngine Two-Handed Clears OffHand ---');
    {
        const state = createState();
        // Player has shield in offHand
        state.character.inventory.items.push(
            { id: 'Round Shield', name: 'Round Shield', type: 'Shield', weight: 6, instanceId: 'shield_1', quantity: 1, equipped: true } as any,
            { id: 'Shortbow', name: 'Shortbow', type: 'Weapon', weight: 2, instanceId: 'bow_1', quantity: 1, equipped: false, properties: ['Two-Handed', 'Ranged'] } as any,
        );
        state.character.equipmentSlots.offHand = 'shield_1';

        // Equip shortbow (two-handed) to mainHand via EquipmentEngine
        const bowItem = state.character.inventory.items.find((i: any) => i.instanceId === 'bow_1')!;
        EquipmentEngine.equipItem(state.character as any, 'mainHand', bowItem as any);

        check(state.character.equipmentSlots.offHand === undefined, 'offHand auto-cleared (bow is two-handed)');
        const shieldItem = state.character.inventory.items.find((i: any) => i.instanceId === 'shield_1');
        check((shieldItem as any)?.equipped === false, 'Shield unequipped');

        verifyEquipmentSync(state.character, 'Player after two-handed equip');
    }

    // ---------------------------------------------------------------
    // Test 5: InventoryEngine.toggleEquip syncs slots
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: InventoryEngine.toggleEquip Syncs Slots ---');
    {
        // InventoryEngine imported at top
        const state = createState();
        state.character.inventory.items.push({
            id: 'Dagger', name: 'Dagger', type: 'Weapon', weight: 1,
            instanceId: 'toggle_dagger_1', quantity: 1, equipped: false
        } as any);

        // Toggle ON
        InventoryEngine.toggleEquip(state.character, 'toggle_dagger_1');
        check(state.character.inventory.items[0].equipped === true, 'Equipped after toggle ON');
        check(state.character.equipmentSlots.mainHand === 'toggle_dagger_1', 'Slot set on toggle ON');

        // Toggle OFF
        InventoryEngine.toggleEquip(state.character, 'toggle_dagger_1');
        check(state.character.inventory.items[0].equipped === false, 'Unequipped after toggle OFF');
        check(state.character.equipmentSlots.mainHand === undefined, 'Slot cleared on toggle OFF');

        verifyEquipmentSync(state.character, 'Player after toggleEquip');
    }

    console.log('\n=== ALL SPRINT B TESTS COMPLETE ===');
}

runTests();
