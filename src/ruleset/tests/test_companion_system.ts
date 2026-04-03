/**
 * Companion System Integration Test
 *
 * Tests the full companion lifecycle:
 * 1. NPC creation with traits
 * 2. Standing requirement enforcement
 * 3. Gold cost calculation
 * 4. Recruitment (WorldNPC → Companion conversion)
 * 5. Party management (wait, follow, dismiss)
 * 6. Combat integration (companion enters combat correctly)
 * 7. Schema validation
 *
 * Run: npx tsx src/ruleset/tests/test_companion_system.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
    const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) process.env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
    }
} catch { }

if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
}

if (process.env.OPENROUTER_API_KEY) {
    localStorage.setItem('rpg_llm_api_keys', JSON.stringify({ openrouter: process.env.OPENROUTER_API_KEY }));
}

import { NPCFactory } from '../factories/NPCFactory';
import { CompanionManager, RecruitResult } from '../combat/CompanionManager';
import { calculateRecruitmentCost, MAX_PARTY_SIZE } from '../schemas/CompanionSchema';
import { GameState } from '../schemas/FullSaveStateSchema';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { CombatFactory } from '../combat/CombatFactory';

// Minimal game state for testing
function createTestState(): GameState {
    return {
        character: {
            name: 'Aldric',
            level: 5,
            race: 'Human',
            class: 'Fighter',
            hp: { current: 40, max: 40, temp: 0 },
            ac: 16,
            stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 200, pp: 0 }, items: [] },
            spellSlots: {},
            conditions: [],
        },
        mode: 'EXPLORATION',
        companions: [],
        worldNpcs: [],
        worldMap: { hexes: { '0,0': { npcs: [], interest_points: [], resourceNodes: [], biome: 'Plains', coordinates: [0, 0] } } },
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
        factions: [{ id: 'lords_alliance', name: 'Lords Alliance', standing: 30 }],
        activeQuests: [],
        conversationHistory: [],
        storySummary: '',
        lastNarrative: '',
    } as any;
}

function createTestNpc(name: string, role: string, standing: number, factionId?: string): WorldNPC {
    const npc = NPCFactory.createNPC(name, role === 'Merchant', factionId, role);
    npc.relationship.standing = standing;
    return npc;
}

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }
function check(condition: boolean, msg: string) { condition ? pass(msg) : fail(msg); }

function runTests() {
    console.log('=== COMPANION SYSTEM INTEGRATION TEST ===\n');

    // ---------------------------------------------------------------
    // Test 1: Standing threshold enforcement
    // ---------------------------------------------------------------
    console.log('--- Test 1: Standing Threshold ---');
    {
        const state = createTestState();
        const npc = createTestNpc('Unfriendly Guard', 'Guard', 5);
        state.worldNpcs.push(npc);
        state.worldMap.hexes['0,0'].npcs = [npc.id];

        const result = CompanionManager.recruit(state, npc.id);
        check(!result.success, `Standing 5 rejected: "${result.message}"`);
        check(state.companions.length === 0, 'Party still empty');
    }

    // ---------------------------------------------------------------
    // Test 2: Successful recruitment
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: Successful Recruitment ---');
    {
        const state = createTestState();
        const npc = createTestNpc('Grimjaw Ironhelm', 'Guard', 20);
        state.worldNpcs.push(npc);
        state.worldMap.hexes['0,0'].npcs = [npc.id];

        const result = CompanionManager.recruit(state, npc.id);
        check(result.success, `Recruitment succeeded: "${result.message}"`);
        check(state.companions.length === 1, 'Companion added to party');
        check(state.worldNpcs.length === 0, 'NPC removed from worldNpcs');
        check(state.worldMap.hexes['0,0'].npcs.length === 0, 'NPC removed from hex');

        const comp = state.companions[0];
        check(comp.meta.sourceNpcId === npc.id, 'Source NPC ID preserved');
        check(comp.meta.followState === 'following', 'Follow state set to following');
        check(comp.character.class === 'Fighter', `Class assigned: ${comp.character.class}`);
        check(comp.character.level === 4, `Level set to player-1: ${comp.character.level}`);
        check(comp.character.hp.max > 0, `HP calculated: ${comp.character.hp.current}/${comp.character.hp.max}`);

        console.log(`  Gold cost: ${result.goldCost}gp (player had 200gp, now ${state.character.inventory.gold.gp}gp)`);
    }

    // ---------------------------------------------------------------
    // Test 3: Gold cost calculation
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Gold Cost Calculation ---');
    {
        check(calculateRecruitmentCost('Guard', 20, 4, false) > 0, 'Guard costs gold');
        const scholarCost = calculateRecruitmentCost('Scholar', 20, 4, false);
        check(scholarCost < calculateRecruitmentCost('Guard', 20, 4, false), `Scholar cheaper than Guard (${scholarCost}gp vs Guard)`);
        check(calculateRecruitmentCost('Merchant', 20, 4, false) > 50, 'Merchant is expensive (leaving shop)');
        check(calculateRecruitmentCost('Guard', 75, 4, false) === 0, 'Standing 75+ = free (true loyalty)');

        const baseCost = calculateRecruitmentCost('Guard', 20, 4, false);
        const factionCost = calculateRecruitmentCost('Guard', 20, 4, true);
        check(factionCost < baseCost, `Faction discount: ${baseCost}gp → ${factionCost}gp`);
    }

    // ---------------------------------------------------------------
    // Test 4: Party size limit
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Party Size Limit ---');
    {
        const state = createTestState();
        state.character.inventory.gold.gp = 1000;

        for (let i = 0; i < MAX_PARTY_SIZE; i++) {
            const npc = createTestNpc(`Companion ${i + 1}`, 'Scholar', 50);
            state.worldNpcs.push(npc);
            state.worldMap.hexes['0,0'].npcs.push(npc.id);
            CompanionManager.recruit(state, npc.id);
        }

        check(state.companions.length === MAX_PARTY_SIZE, `Party full at ${MAX_PARTY_SIZE}`);

        const extraNpc = createTestNpc('Extra Guy', 'Scholar', 50);
        state.worldNpcs.push(extraNpc);
        const result = CompanionManager.recruit(state, extraNpc.id);
        check(!result.success, `Rejected when full: "${result.message}"`);
    }

    // ---------------------------------------------------------------
    // Test 5: Wait / Follow / Dismiss
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: Wait / Follow / Dismiss ---');
    {
        const state = createTestState();
        const npc = createTestNpc('Lyra Moonwhisper', 'Scholar', 30);
        state.worldNpcs.push(npc);
        CompanionManager.recruit(state, npc.id);

        // Wait
        const waitMsg = CompanionManager.setWait(state, 0);
        check(state.companions[0].meta.followState === 'waiting', `Wait: ${waitMsg}`);
        check(state.companions[0].meta.waitHexId === '0,0', 'Wait hex recorded');

        // Follow (same hex)
        const followMsg = CompanionManager.setFollow(state, 0);
        check(state.companions[0].meta.followState === 'following', `Follow: ${followMsg}`);

        // Dismiss
        const dismissMsg = CompanionManager.dismiss(state, 0);
        check(state.companions.length === 0, `Dismissed: ${dismissMsg}`);
        check(state.worldNpcs.length === 1, 'NPC restored to world');
        check(state.worldMap.hexes['0,0'].npcs.length === 1, 'NPC placed in hex');
    }

    // ---------------------------------------------------------------
    // Test 6: CombatFactory type fix
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: CombatFactory Companion Type ---');
    {
        const state = createTestState();
        const npc = createTestNpc('Test Fighter', 'Guard', 30);
        state.worldNpcs.push(npc);
        CompanionManager.recruit(state, npc.id);

        const comp = state.companions[0];
        const combatant = CombatFactory.fromPlayer(comp.character as any, 'companion_0', 'companion');

        check(combatant.type === 'companion', `Combat type: ${combatant.type}`);
        check(combatant.isPlayer === false, `isPlayer: ${combatant.isPlayer}`);
        check(combatant.name === 'Test Fighter', `Name: ${combatant.name}`);
        check(combatant.hp.max > 0, `HP: ${combatant.hp.current}/${combatant.hp.max}`);
    }

    // ---------------------------------------------------------------
    // Test 7: Find companion by name
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: Find by Name ---');
    {
        const state = createTestState();
        const npc1 = createTestNpc('Grimjaw Ironhelm', 'Guard', 30);
        const npc2 = createTestNpc('Lyra Moonwhisper', 'Scholar', 30);
        state.worldNpcs.push(npc1, npc2);
        CompanionManager.recruit(state, npc1.id);
        CompanionManager.recruit(state, npc2.id);

        check(CompanionManager.findCompanionIndex(state, 'grimjaw') === 0, 'Found by partial name (case-insensitive)');
        check(CompanionManager.findCompanionIndex(state, 'lyra') === 1, 'Found second companion');
        check(CompanionManager.findCompanionIndex(state, 'nonexistent') === -1, 'Not found returns -1');
    }

    // ---------------------------------------------------------------
    // Test 8: Trait and stat preservation
    // ---------------------------------------------------------------
    console.log('\n--- Test 8: Trait & Stat Preservation ---');
    {
        const state = createTestState();
        const npc = NPCFactory.createNPC('Old Mossbeard', false, 'emerald_enclave', 'Hermit');
        npc.relationship.standing = 30;
        state.worldNpcs.push(npc);

        const originalTraitCount = npc.traits.length;
        CompanionManager.recruit(state, npc.id);

        const comp = state.companions[0];
        check(comp.meta.originalTraits.length === originalTraitCount, `Traits preserved: ${comp.meta.originalTraits.join(', ')}`);
        check(comp.meta.originalRole === 'Hermit', `Role preserved: ${comp.meta.originalRole}`);
        check(comp.meta.originalFactionId === 'emerald_enclave', `Faction preserved: ${comp.meta.originalFactionId}`);
        check(comp.character.class === 'Cleric', `Hermit → Cleric: ${comp.character.class}`);

        // Stats should reflect hermit modifiers
        const wis = comp.character.stats.WIS as number;
        check(wis > 10, `WIS stat elevated for Hermit: ${wis}`);
    }

    console.log('\n=== ALL TESTS COMPLETE ===');
}

runTests();
