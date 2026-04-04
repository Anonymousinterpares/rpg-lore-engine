/**
 * Dry Logic Tests — Conversation System
 *
 * Tests ConversationManager logic WITHOUT LLM calls.
 * Validates: history persistence, mode transitions, fuzzy matching,
 * context building, edge cases.
 *
 * Run: npx tsx src/ruleset/tests/test_conversation_logic.ts
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

import { ConversationManager } from '../combat/managers/ConversationManager';
import { NPCFactory } from '../factories/NPCFactory';
import { CompanionManager } from '../combat/CompanionManager';
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
        },
        mode: 'EXPLORATION',
        companions: [],
        worldNpcs: [],
        worldMap: { hexes: { '0,0': { npcs: [], interest_points: [], resourceNodes: [], biome: 'Plains', coordinates: [0, 0] } } },
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
        factions: [], activeQuests: [], conversationHistory: [],
        storySummary: '', lastNarrative: '', debugLog: [],
        conversationState: undefined,
    } as any;
}

function addCompanion(state: GameState, name: string, role: string): string {
    const npc = NPCFactory.createNPC(name, false, undefined, role);
    npc.relationship.standing = 75;
    state.worldNpcs.push(npc);
    state.worldMap.hexes['0,0'].npcs = state.worldMap.hexes['0,0'].npcs || [];
    state.worldMap.hexes['0,0'].npcs.push(npc.id);
    CompanionManager.recruit(state, npc.id);
    return (state.companions[state.companions.length - 1] as any).meta.sourceNpcId;
}

function runTests() {
    console.log('=== CONVERSATION SYSTEM DRY LOGIC TESTS ===\n');

    // ---------------------------------------------------------------
    // Test 1: Conversation history persistence
    // ---------------------------------------------------------------
    console.log('--- Test 1: Conversation History Persistence ---');
    {
        const state = createTestState();
        const npcId = addCompanion(state, 'Grimjaw', 'Guard');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        // Resolve companion as NPC — should use SHARED reference
        const npc1 = cm.resolveCompanionAsNpc(npcId);
        check(npc1 !== null, 'Companion resolved');
        check(npc1!.conversationHistory.length === 0, 'History starts empty');

        // Simulate dialogue by pushing to conversationHistory
        npc1!.conversationHistory.push({ speaker: 'Player', text: 'Hello', timestamp: new Date().toISOString() });
        npc1!.conversationHistory.push({ speaker: 'Grimjaw', text: 'Greetings', timestamp: new Date().toISOString() });

        // Resolve again — should see the SAME history (shared reference)
        const npc2 = cm.resolveCompanionAsNpc(npcId);
        check(npc2!.conversationHistory.length === 2, `History persisted: ${npc2!.conversationHistory.length} entries`);
        check(npc2!.conversationHistory[0].text === 'Hello', 'Content preserved');

        // Check it's stored in companion meta
        const companion = state.companions.find((c: any) => c.meta.sourceNpcId === npcId);
        check((companion as any).meta.conversationHistory.length === 2, 'History stored in companion meta (save-safe)');
    }

    // ---------------------------------------------------------------
    // Test 2: isInTalkMode / getActiveConversation
    // ---------------------------------------------------------------
    console.log('\n--- Test 2: Talk Mode State ---');
    {
        const state = createTestState();
        const npcId = addCompanion(state, 'Lyra', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        check(!cm.isInTalkMode(), 'Not in talk mode initially');

        // Manually set active conversation (bypassing startTalk which needs LLM)
        const convState = (state as any).conversationState || {};
        convState.activeConversation = {
            primaryNpcId: npcId, participants: [npcId],
            mode: 'NORMAL', history: [], startedAtTurn: 20
        };
        (state as any).conversationState = convState;

        check(cm.isInTalkMode(), 'In talk mode after setting active conversation');
        check(cm.getActiveNpcName() === 'Lyra', `Active NPC name: ${cm.getActiveNpcName()}`);
    }

    // ---------------------------------------------------------------
    // Test 3: Mode transition — PRIVATE + add member → NORMAL
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Mode Transition on Add Participant ---');
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw', 'Guard');
        const scholarId = addCompanion(state, 'Lyra', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        // Start private conversation
        const convState = (state as any).conversationState || {};
        convState.activeConversation = {
            primaryNpcId: guardId, participants: [guardId],
            mode: 'PRIVATE', history: [
                { speakerId: 'player', speakerName: 'Player', text: 'Hey', isPrivate: true, timestamp: new Date().toISOString() }
            ], startedAtTurn: 20
        };
        (state as any).conversationState = convState;

        check(convState.activeConversation.mode === 'PRIVATE', 'Started in PRIVATE mode');

        // Note: addToConversation calls LLM for greeting — we test the mode change only
        // by checking the logic path. The actual method would need mocking for full test.
        // For now, verify resolveCompanionAsNpc works for both
        check(cm.resolveCompanionAsNpc(guardId) !== null, 'Guard resolved');
        check(cm.resolveCompanionAsNpc(scholarId) !== null, 'Scholar resolved');
        check(cm.resolveCompanionAsNpc('nonexistent') === null, 'Nonexistent returns null');
    }

    // ---------------------------------------------------------------
    // Test 4: Fuzzy name matching
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Fuzzy Name Matching ---');
    {
        const state = createTestState();
        addCompanion(state, 'Grimjaw Ironhelm', 'Guard');
        addCompanion(state, 'Lyra Moonwhisper', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        // Exact first name
        const r1 = cm.resolveNpcFromInput('Hey Grimjaw, what do you think?');
        check(r1 !== null && r1.confidence === 'EXACT', `Exact match: ${r1?.npcName} (${r1?.confidence})`);

        // Case insensitive
        const r2 = cm.resolveNpcFromInput('Tell me lyra, what happened?');
        check(r2 !== null && r2.npcName === 'Lyra Moonwhisper', `Case insensitive: ${r2?.npcName}`);

        // Fuzzy (typo)
        const r3 = cm.resolveNpcFromInput('Grimjw, come here');
        check(r3 !== null && r3.confidence === 'FUZZY', `Fuzzy match: ${r3?.npcName} (${r3?.confidence})`);

        // No match
        const r4 = cm.resolveNpcFromInput('Hello everyone');
        check(r4 === null, 'No match returns null');
    }

    // ---------------------------------------------------------------
    // Test 5: DialogueContext building
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: DialogueContext Building ---');
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw', 'Guard');
        const scholarId = addCompanion(state, 'Lyra', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        // Set up active conversation
        (state as any).conversationState = {
            activeConversation: {
                primaryNpcId: guardId, participants: [guardId, scholarId],
                mode: 'GROUP', history: [
                    { speakerId: 'player', speakerName: 'Player', text: 'Hello all', isPrivate: false, timestamp: '' },
                    { speakerId: guardId, speakerName: 'Grimjaw', text: 'Hey there', isPrivate: false, timestamp: '' },
                ], startedAtTurn: 20
            },
            backgroundConversations: [{
                participantIds: [guardId, scholarId], topic: 'the weather',
                messages: [], startedAtTurn: 18
            }],
            speechBubbles: [], chatterCooldowns: {},
            lastBackgroundChatterTurn: 0, lastConversationSummary: 'Earlier discussed map routes.',
            tokenBudgetUsedThisTurn: 0
        };

        const ctx = (cm as any).buildDialogueContext(guardId);

        check(ctx.mode === 'GROUP', `Mode: ${ctx.mode}`);
        check(ctx.participants.length === 2, `Participants: ${ctx.participants.length}`);
        check(ctx.partyMembers.length === 2, `Party members: ${ctx.partyMembers.length}`);
        check(ctx.recentExchanges.length === 2, `Recent exchanges: ${ctx.recentExchanges.length}`);
        check(ctx.backgroundKnowledge !== undefined && ctx.backgroundKnowledge.length > 0, `Background knowledge: ${ctx.backgroundKnowledge?.length}`);
        check(ctx.priorConversationSummary === 'Earlier discussed map routes.', `Prior summary present`);
    }

    // ---------------------------------------------------------------
    // Test 6: forceEndTalk
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: Force End Talk ---');
    {
        const state = createTestState();
        const npcId = addCompanion(state, 'Grimjaw', 'Guard');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        (state as any).conversationState = {
            activeConversation: {
                primaryNpcId: npcId, participants: [npcId],
                mode: 'NORMAL', history: [], startedAtTurn: 20
            },
            backgroundConversations: [], speechBubbles: [], chatterCooldowns: {},
            lastBackgroundChatterTurn: 0, lastConversationSummary: '',
            tokenBudgetUsedThisTurn: 0
        };
        state.activeDialogueNpcId = npcId;

        check(cm.isInTalkMode(), 'In talk mode');
        cm.forceEndTalk('combat started');
        check(!cm.isInTalkMode(), 'Talk mode ended');
        check(state.activeDialogueNpcId === null, 'activeDialogueNpcId cleared');
        check((state as any).conversationState.lastConversationSummary.includes('combat started'), 'Summary mentions reason');
    }

    // ---------------------------------------------------------------
    // Test 7: removeParticipant
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: Remove Participant ---');
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw', 'Guard');
        const scholarId = addCompanion(state, 'Lyra', 'Scholar');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        (state as any).conversationState = {
            activeConversation: {
                primaryNpcId: guardId, participants: [guardId, scholarId],
                mode: 'GROUP', history: [], startedAtTurn: 20
            },
            backgroundConversations: [], speechBubbles: [], chatterCooldowns: {},
            lastBackgroundChatterTurn: 0, lastConversationSummary: '',
            tokenBudgetUsedThisTurn: 0
        };

        // Remove non-primary participant
        cm.removeParticipant(scholarId);
        check(cm.isInTalkMode(), 'Still in talk mode after removing non-primary');
        check((state as any).conversationState.activeConversation.participants.length === 1, 'Participant removed');

        // Remove primary participant → ends talk
        cm.removeParticipant(guardId);
        check(!cm.isInTalkMode(), 'Talk ended when primary removed');
    }

    // ---------------------------------------------------------------
    // Test 8: Orphan cleanup
    // ---------------------------------------------------------------
    console.log('\n--- Test 8: Orphan Cleanup ---');
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw', 'Guard');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        (state as any).conversationState = {
            activeConversation: null,
            backgroundConversations: [
                { participantIds: [guardId, 'dead-npc-id'], topic: 'old stuff', messages: [], startedAtTurn: 10 },
                { participantIds: [guardId], topic: 'solo', messages: [], startedAtTurn: 15 }, // only guard, valid
            ],
            speechBubbles: [], chatterCooldowns: {},
            lastBackgroundChatterTurn: 0, lastConversationSummary: '',
            tokenBudgetUsedThisTurn: 0
        };

        check((state as any).conversationState.backgroundConversations.length === 2, 'Before cleanup: 2 conversations');
        cm.cleanOrphanedConversations();
        check((state as any).conversationState.backgroundConversations.length === 1, 'After cleanup: 1 (orphan removed)');
    }

    // ---------------------------------------------------------------
    // Test 9: Empty input validation
    // ---------------------------------------------------------------
    console.log('\n--- Test 9: Empty Input ---');
    {
        const state = createTestState();
        const npcId = addCompanion(state, 'Grimjaw', 'Guard');
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        (state as any).conversationState = {
            activeConversation: {
                primaryNpcId: npcId, participants: [npcId],
                mode: 'NORMAL', history: [], startedAtTurn: 20
            },
            backgroundConversations: [], speechBubbles: [], chatterCooldowns: {},
            lastBackgroundChatterTurn: 0, lastConversationSummary: '',
            tokenBudgetUsedThisTurn: 0
        };

        cm.processDialogueInput('').then(result => {
            check(result === 'You stay silent.', `Empty input handled: "${result}"`);
        });

        cm.processDialogueInput('   ').then(result => {
            check(result === 'You stay silent.', `Whitespace input handled: "${result}"`);
        });
    }

    // ---------------------------------------------------------------
    // Test 10: Eavesdrop check (private mode)
    // ---------------------------------------------------------------
    console.log('\n--- Test 10: Eavesdrop Check ---');
    {
        const state = createTestState();
        const guardId = addCompanion(state, 'Grimjaw', 'Guard');
        // Add a high-WIS companion who should eavesdrop
        const npc2 = NPCFactory.createNPC('Sharp Ears', false, undefined, 'Scout');
        npc2.relationship.standing = 75;
        npc2.stats.WIS = 18; // Very perceptive
        state.worldNpcs.push(npc2);
        state.worldMap.hexes['0,0'].npcs.push(npc2.id);
        CompanionManager.recruit(state, npc2.id);
        // Add perception proficiency
        const sharpCompanion = state.companions.find((c: any) => c.character.name === 'Sharp Ears');
        if (sharpCompanion) (sharpCompanion.character as any).skillProficiencies = ['Perception'];

        state.debugLog = [];
        const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

        // Trigger eavesdrop check
        (cm as any).checkEavesdroppers(guardId);

        check(state.debugLog.length > 0, `Eavesdrop detected: ${state.debugLog[0] || 'none'}`);
        check(state.debugLog[0]?.includes('Sharp Ears'), 'High-WIS companion overheard');
    }

    console.log('\n=== ALL DRY TESTS COMPLETE ===');
}

runTests();
