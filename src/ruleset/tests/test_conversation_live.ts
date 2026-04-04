/**
 * Live LLM Conversation Scenario Tests
 *
 * 3 scenarios testing real LLM dialogue with enriched context:
 * 1. Private talk with A, ask about B — verify A knows B exists
 * 2. Normal talk with A, add B mid-conversation, address B by name
 * 3. Group talk with 3 companions, personality-driven routing
 *
 * Requires: OPENROUTER_API_KEY in .env
 * Run: npx tsx src/ruleset/tests/test_conversation_live.ts
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

import { ConversationManager } from '../combat/managers/ConversationManager';
import { NPCFactory } from '../factories/NPCFactory';
import { CompanionManager } from '../combat/CompanionManager';
import { ContextManager } from '../agents/ContextManager';
import { HexMapManager } from '../combat/HexMapManager';
import { GameState } from '../schemas/FullSaveStateSchema';

function createTestState(): GameState {
    return {
        character: {
            name: 'Aldric', level: 5, race: 'Human', class: 'Fighter',
            hp: { current: 40, max: 40, temp: 0 }, ac: 16,
            stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 500, pp: 0 }, items: [] },
            spellSlots: {}, conditions: [], skillProficiencies: [],
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
    const hex = state.worldMap.hexes['0,0'];
    if (!hex.npcs) hex.npcs = [];
    hex.npcs.push(npc.id);
    CompanionManager.recruit(state, npc.id);
    return (state.companions[state.companions.length - 1] as any).meta.sourceNpcId;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runScenarios() {
    console.log('=== LIVE LLM CONVERSATION SCENARIO TESTS ===\n');

    // ---------------------------------------------------------------
    // Scenario 1: Private talk with A, ask about B
    // ---------------------------------------------------------------
    console.log('=' .repeat(70));
    console.log('SCENARIO 1: Private talk with Guard, ask about Scholar');
    console.log('=' .repeat(70));
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw Ironhelm', 'Guard');
        const scholarId = addCompanion(state, 'Lyra Moonwhisper', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        console.log(`\nParty: Grimjaw (Guard), Lyra (Scholar)`);
        console.log(`Grimjaw traits: ${(state.companions[0] as any).meta.originalTraits.join(', ')}`);
        console.log(`Lyra traits: ${(state.companions[1] as any).meta.originalTraits.join(', ')}`);

        // Start private talk with Guard
        console.log('\n[Player starts PRIVATE talk with Grimjaw]');
        const greeting = await cm.startTalk(guardId, 'PRIVATE');
        console.log(`>> ${greeting}\n`);
        await delay(500);

        // Ask about Lyra
        console.log('[Player]: "What do you think about Lyra? Can we trust her?"');
        const response1 = await cm.processDialogueInput('What do you think about Lyra? Can we trust her?');
        console.log(`>> ${response1}\n`);
        await delay(500);

        // Follow up
        console.log('[Player]: "Has she said anything suspicious to you?"');
        const response2 = await cm.processDialogueInput('Has she said anything suspicious to you?');
        console.log(`>> ${response2}\n`);
        await delay(500);

        // Check eavesdrop log
        console.log('[Debug Log]:');
        state.debugLog.forEach(log => console.log(`  ${log}`));

        // End talk
        const endMsg = await cm.endTalk();
        console.log(`\n[${endMsg}]`);
        console.log(`[Summary]: ${(state as any).conversationState?.lastConversationSummary || 'none'}`);

        // VERIFY: Does Grimjaw's response mention Lyra by name?
        const mentionsLyra = response1.toLowerCase().includes('lyra');
        console.log(`\n[CHECK] Grimjaw mentions Lyra by name: ${mentionsLyra ? 'YES ✅' : 'NO ❌ (context gap)'}`);
    }

    await delay(1000);

    // ---------------------------------------------------------------
    // Scenario 2: Normal talk with A, add B, address B by name
    // ---------------------------------------------------------------
    console.log('\n' + '=' .repeat(70));
    console.log('SCENARIO 2: Normal talk with Guard, add Scholar, address Scholar');
    console.log('=' .repeat(70));
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw Ironhelm', 'Guard');
        const scholarId = addCompanion(state, 'Lyra Moonwhisper', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        console.log(`\nParty: Grimjaw (Guard), Lyra (Scholar)`);

        // Start normal talk with Guard
        console.log('\n[Player starts NORMAL talk with Grimjaw]');
        const greeting = await cm.startTalk(guardId, 'NORMAL');
        console.log(`>> ${greeting}\n`);
        await delay(500);

        // Talk to Guard about the dungeon
        console.log('[Player]: "Do you know anything about the dungeon to the east?"');
        const r1 = await cm.processDialogueInput('Do you know anything about the dungeon to the east?');
        console.log(`>> ${r1}\n`);
        await delay(500);

        // Check speech bubbles (Lyra might comment)
        const bubbles = cm.getActiveSpeechBubbles();
        if (bubbles.length > 0) {
            console.log('[Speech Bubble]:');
            bubbles.forEach(b => console.log(`  ${b.npcName}: "${b.text}"`));
        }

        // Add Lyra to conversation
        console.log('\n[Player adds Lyra to conversation]');
        const addMsg = await cm.addToConversation(scholarId);
        console.log(`>> ${addMsg}\n`);
        await delay(500);

        // Address Lyra by name
        console.log('[Player]: "Lyra, what can you tell us about this dungeon? Any lore?"');
        const r2 = await cm.processDialogueInput('Lyra, what can you tell us about this dungeon? Any lore?');
        console.log(`>> ${r2}\n`);

        // VERIFY: Did Lyra respond (not Grimjaw)?
        const lyraResponded = r2.toLowerCase().includes('lyra');
        console.log(`[CHECK] Response is from Lyra: ${lyraResponded ? 'YES ✅' : 'UNCLEAR ⚠️'}`);

        // Check conversation mode
        const convMode = (state as any).conversationState?.activeConversation?.mode;
        console.log(`[CHECK] Conversation mode: ${convMode}`);
        console.log(`[CHECK] Participants: ${(state as any).conversationState?.activeConversation?.participants?.length}`);

        await cm.endTalk();
    }

    await delay(1000);

    // ---------------------------------------------------------------
    // Scenario 3: Group talk with 3 companions
    // ---------------------------------------------------------------
    console.log('\n' + '=' .repeat(70));
    console.log('SCENARIO 3: Group talk with Guard, Scholar, and Bandit');
    console.log('=' .repeat(70));
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw Ironhelm', 'Guard');
        const scholarId = addCompanion(state, 'Lyra Moonwhisper', 'Scholar');
        const banditId = addCompanion(state, 'Rotgut the Vile', 'Bandit');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        console.log(`\nParty: Grimjaw (Guard), Lyra (Scholar), Rotgut (Bandit)`);
        console.log(`Grimjaw traits: ${(state.companions[0] as any).meta.originalTraits.join(', ')}`);
        console.log(`Lyra traits: ${(state.companions[1] as any).meta.originalTraits.join(', ')}`);
        console.log(`Rotgut traits: ${(state.companions[2] as any).meta.originalTraits.join(', ')}`);

        // Start group talk
        console.log('\n[Player starts GROUP talk]');
        const greeting = await cm.startGroupTalk();
        console.log(`>> ${greeting}\n`);
        await delay(500);

        // Ask about danger — should resonate with Guard (fight/danger keywords)
        console.log('[Player]: "I sense danger ahead. Should we prepare for a fight?"');
        const r1 = await cm.processDialogueInput('I sense danger ahead. Should we prepare for a fight?');
        console.log(`>> ${r1}`);

        // Check speech bubbles
        const bubbles1 = cm.getActiveSpeechBubbles();
        if (bubbles1.length > 0) {
            console.log('[Speech Bubble]:');
            bubbles1.forEach(b => console.log(`  ${b.npcName}: "${b.text}"`));
        }
        console.log('');
        await delay(500);

        // Ask about lore — should resonate with Scholar
        console.log('[Player]: "Does anyone know the history of these ruins? Any ancient secrets?"');
        const r2 = await cm.processDialogueInput('Does anyone know the history of these ruins? Any ancient secrets?');
        console.log(`>> ${r2}`);

        const bubbles2 = cm.getActiveSpeechBubbles();
        if (bubbles2.length > 0) {
            console.log('[Speech Bubble]:');
            bubbles2.forEach(b => console.log(`  ${b.npcName}: "${b.text}"`));
        }
        console.log('');
        await delay(500);

        // Ask about treasure — should resonate with Bandit/Greed
        console.log('[Player]: "There might be gold and treasure in there. Worth the risk?"');
        const r3 = await cm.processDialogueInput('There might be gold and treasure in there. Worth the risk?');
        console.log(`>> ${r3}`);

        const bubbles3 = cm.getActiveSpeechBubbles();
        if (bubbles3.length > 0) {
            console.log('[Speech Bubble]:');
            bubbles3.forEach(b => console.log(`  ${b.npcName}: "${b.text}"`));
        }

        // Summary
        console.log('\n[Ending group talk]');
        await cm.endTalk();
        console.log(`[Summary]: ${(state as any).conversationState?.lastConversationSummary || 'none'}`);

        // Conversation history check
        const totalExchanges = (state.companions as any[]).reduce((sum, c) => sum + (c.meta.conversationHistory?.length || 0), 0);
        console.log(`\n[CHECK] Total conversation history entries across all companions: ${totalExchanges}`);
    }

    console.log('\n=== ALL LIVE SCENARIOS COMPLETE ===');
}

runScenarios().catch(err => {
    console.error('Scenario test failed:', err);
    process.exit(1);
});
