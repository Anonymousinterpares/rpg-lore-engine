import { GameState } from '../../schemas/FullSaveStateSchema';
import { WorldNPC } from '../../schemas/WorldEnrichmentSchema';
import { NPCService, DialogueContext } from '../../agents/NPCService';
import { LLMClient } from '../LLMClient';
import { AgentManager } from '../../agents/AgentManager';
import { LLM_PROVIDERS } from '../../data/StaticData';
import { ContextManager } from '../../agents/ContextManager';
import { HexMapManager } from '../HexMapManager';
import { EventBusManager } from './EventBusManager';
import {
    TalkMode, ActiveConversation, ConversationMessage, SpeechBubble,
    ConversationState, CHATTER_COOLDOWN_TURNS, BACKGROUND_CONVO_CHANCE,
    PUBLIC_COMMENT_CHANCE_NORMAL, PUBLIC_COMMENT_CHANCE_GROUP,
    MAX_TURN_TOKEN_BUDGET, SPEECH_BUBBLE_DURATION_MS, MAX_BACKGROUND_CONVERSATIONS,
    CHATTER_TRAIT_MODIFIERS, TRAIT_TOPIC_KEYWORDS
} from '../../schemas/ConversationSchema';

/**
 * ConversationManager — Orchestrates all dialogue and party conversation systems.
 *
 * Extracted from GameLoop to reduce its size and centralize conversation logic.
 * Follows the existing manager pattern: constructor(state, deps, emitStateUpdate).
 */
export class ConversationManager {

    constructor(
        private state: GameState,
        private contextManager: ContextManager,
        private hexMapManager: HexMapManager,
        private emitStateUpdate: () => Promise<void>
    ) {}

    // ---------------------------------------------------------------
    // State Access Helpers
    // ---------------------------------------------------------------

    private getConvState(): ConversationState {
        if (!this.state.conversationState) {
            (this.state as any).conversationState = {
                activeConversation: null,
                backgroundConversations: [],
                speechBubbles: [],
                chatterCooldowns: {},
                lastBackgroundChatterTurn: 0,
                lastConversationSummary: '',
                tokenBudgetUsedThisTurn: 0
            };
        }
        return this.state.conversationState!;
    }

    public isInTalkMode(): boolean {
        return this.getConvState().activeConversation !== null;
    }

    public getActiveNpcName(): string | null {
        const conv = this.getConvState().activeConversation;
        if (!conv) return null;
        const npc = this.resolveCompanionAsNpc(conv.primaryNpcId);
        return npc?.name || null;
    }

    public getActiveConversation(): ActiveConversation | null {
        return this.getConvState().activeConversation;
    }

    public getActiveSpeechBubbles(): SpeechBubble[] {
        const now = Date.now();
        const convState = this.getConvState();
        convState.speechBubbles = convState.speechBubbles.filter(b => b.expiresAt > now);
        return convState.speechBubbles;
    }

    // ---------------------------------------------------------------
    // NPC Resolution (shared utility — replaces duplicated code in GameLoop)
    // ---------------------------------------------------------------

    /**
     * Builds a WorldNPC-like object from companion data.
     * Uses the companion's PERSISTENT conversationHistory from CompanionMeta
     * so that dialogue history survives across talk sessions and saves.
     */
    public resolveCompanionAsNpc(npcIdOrName: string): WorldNPC | null {
        // Check companions first
        const companion = this.state.companions.find((c: any) =>
            c.meta.sourceNpcId === npcIdOrName ||
            c.character.name.toLowerCase() === npcIdOrName.toLowerCase() ||
            c.character.name.toLowerCase().includes(npcIdOrName.toLowerCase())
        );

        if (companion) {
            // Use the persistent conversationHistory from meta — this is a REFERENCE,
            // so NPCService.generateDialogue() mutations will persist automatically.
            const meta = companion.meta;
            if (!meta.conversationHistory) meta.conversationHistory = [];

            return {
                id: meta.sourceNpcId,
                name: companion.character.name,
                traits: meta.originalTraits || [],
                relationship: { standing: 30, interactionLog: [], lastInteraction: undefined },
                conversationHistory: meta.conversationHistory, // SHARED REFERENCE — persists!
                isMerchant: false,
                dialogue_triggers: [],
                inventory: [],
                availableQuests: [],
                stats: companion.character.stats,
                role: meta.originalRole,
                factionId: meta.originalFactionId,
            } as any;
        }

        // Then check world NPCs
        return this.state.worldNpcs.find(n =>
            n.id === npcIdOrName ||
            n.name.toLowerCase() === npcIdOrName.toLowerCase() ||
            n.name.toLowerCase().includes(npcIdOrName.toLowerCase())
        ) || null;
    }

    /**
     * Fuzzy name matching with Levenshtein distance and substring check.
     * Returns the best-matching companion/NPC ID and confidence level.
     */
    public resolveNpcFromInput(input: string): { npcId: string; npcName: string; confidence: 'EXACT' | 'FUZZY' | 'INFERRED' } | null {
        // Strip punctuation from words for matching
        const words = input.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z'-]/g, ''));
        const allNpcs = this.getDialogueParticipantNpcs();

        // Pass 1: exact name match (full name or first name)
        for (const npc of allNpcs) {
            const nameLower = npc.name.toLowerCase();
            const firstName = nameLower.split(' ')[0];
            if (words.includes(firstName) || input.toLowerCase().includes(nameLower)) {
                return { npcId: npc.id, npcName: npc.name, confidence: 'EXACT' };
            }
        }

        // Pass 2: fuzzy match (Levenshtein ≤ 2)
        for (const word of words) {
            if (word.length < 3) continue;
            for (const npc of allNpcs) {
                const firstName = npc.name.split(' ')[0].toLowerCase();
                if (this.levenshtein(word, firstName) <= 2) {
                    return { npcId: npc.id, npcName: npc.name, confidence: 'FUZZY' };
                }
            }
        }

        return null;
    }

    /**
     * Returns all NPCs currently eligible for dialogue (following companions + NPCs in hex).
     */
    private getDialogueParticipantNpcs(): { id: string; name: string; traits: string[] }[] {
        const npcs: { id: string; name: string; traits: string[] }[] = [];

        // Following companions
        for (const c of this.state.companions) {
            if ((c as any).meta?.followState === 'following') {
                npcs.push({
                    id: (c as any).meta.sourceNpcId,
                    name: c.character.name,
                    traits: (c as any).meta.originalTraits || []
                });
            }
        }

        // NPCs in current hex
        const hex = this.hexMapManager?.getHex(this.state.location.hexId);
        if (hex?.npcs) {
            for (const npcId of hex.npcs) {
                const npc = this.state.worldNpcs.find(n => n.id === npcId);
                if (npc) npcs.push({ id: npc.id, name: npc.name, traits: npc.traits || [] });
            }
        }

        return npcs;
    }

    /**
     * Builds enriched DialogueContext for NPCService.generateDialogue().
     * Provides party awareness, mode, participants, background knowledge, and recent exchanges.
     */
    private buildDialogueContext(forNpcId: string): DialogueContext {
        const conv = this.getConvState().activeConversation;
        const convState = this.getConvState();

        // Party roster (all following companions)
        const partyMembers = this.state.companions
            .filter((c: any) => c.meta?.followState === 'following')
            .map((c: any) => ({
                name: c.character.name,
                role: c.meta.originalRole || 'Adventurer'
            }));

        // Participants in current conversation
        const participants = (conv?.participants || []).map(id => {
            const npc = this.resolveCompanionAsNpc(id);
            return npc ? {
                name: npc.name,
                role: npc.role || 'Adventurer',
                traits: (npc.traits || []).slice(0, 4).join(', ')
            } : null;
        }).filter(Boolean) as { name: string; role?: string; traits?: string }[];

        // Recent exchanges from conversation history (last 5)
        const recentExchanges = (conv?.history || []).slice(-5).map(m => ({
            speaker: m.speakerName,
            text: m.text
        }));

        // Background knowledge: private NPC-NPC conversations this NPC participated in
        const backgroundKnowledge: string[] = [];
        for (const bgConv of convState.backgroundConversations) {
            if (bgConv.participantIds.includes(forNpcId)) {
                const otherIds = bgConv.participantIds.filter(id => id !== forNpcId);
                const otherNames = otherIds.map(id => this.resolveCompanionAsNpc(id)?.name || 'someone');
                backgroundKnowledge.push(
                    `Discussed "${bgConv.topic}" with ${otherNames.join(', ')}`
                );
            }
        }

        return {
            mode: (conv?.mode as 'PRIVATE' | 'NORMAL' | 'GROUP') || undefined,
            participants,
            partyMembers,
            recentExchanges,
            backgroundKnowledge: backgroundKnowledge.length > 0 ? backgroundKnowledge : undefined,
            priorConversationSummary: convState.lastConversationSummary || undefined
        };
    }

    // ---------------------------------------------------------------
    // Talk Mode Lifecycle
    // ---------------------------------------------------------------

    /**
     * Enters talk mode with an NPC.
     * Pauses narrator. Generates greeting via NPCService.
     */
    public async startTalk(npcIdOrName: string, mode: 'PRIVATE' | 'NORMAL'): Promise<string> {
        const npc = this.resolveCompanionAsNpc(npcIdOrName);
        if (!npc) return `You don't see anyone named "${npcIdOrName}" to talk to.`;

        // Check if NPC is accessible (companion following, or world NPC in hex)
        const isCompanion = this.state.companions.some((c: any) => c.meta.sourceNpcId === npc.id && c.meta.followState === 'following');
        if (!isCompanion) {
            const hex = this.hexMapManager.getHex(this.state.location.hexId);
            if (!hex?.npcs?.includes(npc.id)) {
                return `${npc.name} is not nearby.`;
            }
        }

        const convState = this.getConvState();

        // Set up active conversation
        convState.activeConversation = {
            primaryNpcId: npc.id,
            participants: [npc.id],
            mode: mode as TalkMode,
            history: [],
            startedAtTurn: this.state.worldTime.totalTurns
        };

        // Maintain backward compatibility
        this.state.activeDialogueNpcId = npc.id;

        // Eavesdrop check for private mode
        if (mode === 'PRIVATE' && isCompanion) {
            this.checkEavesdroppers(npc.id);
        }

        // Generate greeting
        try {
            const contextHint = isCompanion
                ? `[GREETING / START CONVERSATION — this is your traveling companion, the player wants to chat${mode === 'PRIVATE' ? ' privately' : ''}]`
                : `[GREETING / START CONVERSATION]`;

            const dialogueCtx = this.buildDialogueContext(npc.id);
            const greeting = await NPCService.generateDialogue(this.state, npc, contextHint, dialogueCtx);

            if (greeting) {
                this.addToConversationHistory(npc.id, npc.name, greeting, mode === 'PRIVATE');
                this.addToConversationHistory('player', 'Player', contextHint, mode === 'PRIVATE');
            }

            const formatted = greeting ? `**${npc.name}:** ${greeting}` : `${npc.name} looks at you expectantly.`;
            this.state.lastNarrative = formatted;

            const turn = this.state.worldTime.totalTurns;
            this.state.conversationHistory.push({ role: 'narrator', content: formatted, turnNumber: turn });

            await this.emitStateUpdate();
            return formatted;
        } catch (e) {
            convState.activeConversation = null;
            this.state.activeDialogueNpcId = null;
            return `${npc.name} seems distracted.`;
        }
    }

    /**
     * Exits talk mode. Generates conversation summary for narrator context.
     */
    /**
     * Synchronous force-end for non-interactive scenarios (combat start, companion dismissed).
     * Skips LLM summary — generates a mechanical one instead.
     */
    public forceEndTalk(reason: string = 'interrupted'): void {
        const convState = this.getConvState();
        const conv = convState.activeConversation;
        if (conv) {
            const npcName = this.resolveCompanionAsNpc(conv.primaryNpcId)?.name || 'someone';
            convState.lastConversationSummary = `Conversation with ${npcName} was ${reason} (${conv.history.length} exchanges).`;
        }
        convState.activeConversation = null;
        this.state.activeDialogueNpcId = null;
    }

    /**
     * Removes a participant from the active conversation.
     * If the primary NPC is removed, ends the conversation.
     * If last participant is removed, ends the conversation.
     */
    public removeParticipant(npcId: string): void {
        const conv = this.getConvState().activeConversation;
        if (!conv) return;

        conv.participants = conv.participants.filter(id => id !== npcId);

        if (conv.primaryNpcId === npcId || conv.participants.length === 0) {
            this.forceEndTalk('ended — participant left');
        }
    }

    /**
     * Cleans up orphaned background conversations referencing NPCs no longer in party.
     */
    public cleanOrphanedConversations(): void {
        const convState = this.getConvState();
        const companionIds = new Set(this.state.companions.map((c: any) => c.meta?.sourceNpcId));

        convState.backgroundConversations = convState.backgroundConversations.filter(bg =>
            bg.participantIds.every(id => companionIds.has(id))
        );
    }

    public async endTalk(): Promise<string> {
        const convState = this.getConvState();
        const conv = convState.activeConversation;

        if (!conv) {
            this.state.activeDialogueNpcId = null;
            return "You end the conversation.";
        }

        // Generate conversation summary if there was meaningful exchange
        if (conv.history.length > 2) {
            try {
                const summary = await this.generateConversationSummary(conv);
                convState.lastConversationSummary = summary;
            } catch (e) {
                console.warn('[ConversationManager] Summary generation failed:', e);
                convState.lastConversationSummary = `Brief conversation with ${this.resolveCompanionAsNpc(conv.primaryNpcId)?.name || 'someone'}.`;
            }
        }

        convState.activeConversation = null;
        this.state.activeDialogueNpcId = null;
        await this.emitStateUpdate();

        return "You end the conversation.";
    }

    /**
     * Processes player input during active talk mode.
     * Routes to the correct NPC, handles name-addressing and group discussions.
     */
    public async processDialogueInput(input: string): Promise<string> {
        const convState = this.getConvState();
        const conv = convState.activeConversation;
        if (!conv) return "You're not in a conversation.";

        // Empty input validation
        if (!input || !input.trim()) return "You stay silent.";

        // Check for exit commands
        const lower = input.trim().toLowerCase();
        if (lower === '/endtalk' || lower === 'goodbye' || lower === 'leave' || lower === 'end talk') {
            return await this.endTalk();
        }

        // Check for slash commands — exit talk mode and let GameLoop handle
        if (input.trim().startsWith('/')) {
            await this.endTalk();
            return '__PASSTHROUGH__'; // Signal to GameLoop to re-process as command
        }

        // Determine who responds
        let responderId = conv.primaryNpcId;

        if (conv.mode === 'GROUP' || conv.participants.length > 1) {
            // Try name-based addressing first
            const nameMatch = this.resolveNpcFromInput(input);
            if (nameMatch && conv.participants.includes(nameMatch.npcId)) {
                responderId = nameMatch.npcId;
            } else if (conv.mode === 'GROUP') {
                // Personality resonance: who is most likely to respond?
                responderId = this.pickResponderByResonance(input, conv.participants);
            }
        }

        const responderNpc = this.resolveCompanionAsNpc(responderId);
        if (!responderNpc) {
            return "The person you're talking to is no longer here.";
        }

        // Add player message to conversation history
        this.addToConversationHistory('player', 'Player', input, conv.mode === 'PRIVATE');

        // Generate response
        try {
            const dialogueCtx = this.buildDialogueContext(responderId);
            const response = await NPCService.generateDialogue(this.state, responderNpc, input, dialogueCtx);

            if (response) {
                this.addToConversationHistory(responderId, responderNpc.name, response, conv.mode === 'PRIVATE');

                // Relationship delta evaluation
                try {
                    const delta = await NPCService.evaluateRelationshipDelta(responderNpc, input, response);
                    if (delta && delta.delta !== 0) {
                        this.applyRelationshipDelta(responderId, delta.delta, delta.reason);
                    }
                } catch { /* non-critical */ }

                // Commentary from other participants (NORMAL/GROUP mode)
                if (conv.mode !== 'PRIVATE' && conv.participants.length > 1) {
                    await this.maybeGenerateCommentary(conv, responderId, response);
                }
            }

            const formatted = response ? `**${responderNpc.name}:** ${response}` : `${responderNpc.name} stays silent.`;
            this.state.lastNarrative = formatted;

            const turn = this.state.worldTime.totalTurns;
            this.state.conversationHistory.push({ role: 'player', content: input, turnNumber: turn });
            this.state.conversationHistory.push({ role: 'narrator', content: formatted, turnNumber: turn });

            this.contextManager.addEvent('player', input);
            this.contextManager.addEvent('narrator', formatted);

            await this.emitStateUpdate();
            return formatted;
        } catch (e: any) {
            console.error('[ConversationManager] Dialogue failed:', e);
            return `${responderNpc.name} seems unable to respond.`;
        }
    }

    // ---------------------------------------------------------------
    // Group Conversations
    // ---------------------------------------------------------------

    /**
     * Adds a companion to the active conversation.
     */
    public async addToConversation(npcIdOrName: string): Promise<string> {
        const conv = this.getConvState().activeConversation;
        if (!conv) return "No active conversation to join.";

        const npc = this.resolveCompanionAsNpc(npcIdOrName);
        if (!npc) return `No companion named "${npcIdOrName}" found.`;

        if (conv.participants.includes(npc.id)) {
            return `${npc.name} is already in this conversation.`;
        }

        // Mode transition: PRIVATE + add member → NORMAL with notification
        const wasPrivate = conv.mode === 'PRIVATE';
        if (wasPrivate) {
            conv.mode = 'NORMAL';
            const primaryNpc = this.resolveCompanionAsNpc(conv.primaryNpcId);
            const modeNotice = `[The conversation is no longer private — ${npc.name} has joined.]`;
            this.addToConversationHistory('system', 'System', modeNotice, false);
        }

        conv.participants.push(npc.id);

        // Generate a contextual join greeting from the new participant
        try {
            const conversationSoFar = conv.history.slice(-3).map(m => `${m.speakerName}: ${m.text}`).join('\n');
            const joinContext = `[You are joining an ongoing conversation. Here's what was just discussed:\n${conversationSoFar}\n\nSay something brief to join the discussion.]`;
            const dialogueCtx = this.buildDialogueContext(npc.id);
            const joinGreeting = await NPCService.generateDialogue(this.state, npc, joinContext, dialogueCtx);

            if (joinGreeting) {
                this.addToConversationHistory(npc.id, npc.name, joinGreeting, false);

                const formatted = `*${npc.name} joins the conversation.*\n**${npc.name}:** ${joinGreeting}`;
                this.state.lastNarrative = formatted;
                this.state.conversationHistory.push({
                    role: 'narrator', content: formatted,
                    turnNumber: this.state.worldTime.totalTurns
                });
            }
        } catch (e) {
            console.warn('[ConversationManager] Join greeting failed:', e);
        }

        await this.emitStateUpdate();
        const modeNote = wasPrivate ? ' The conversation is now open.' : '';
        return `${npc.name} joins the conversation.${modeNote}`;
    }

    /**
     * Starts a group discussion with ALL following companions.
     */
    public async startGroupTalk(): Promise<string> {
        const followingCompanions = this.state.companions.filter((c: any) => c.meta?.followState === 'following');
        if (followingCompanions.length === 0) return "You have no companions to talk to.";

        const firstCompanion = followingCompanions[0];
        const npcId = (firstCompanion as any).meta.sourceNpcId;

        // Start with first companion, then add all others
        const result = await this.startTalk(npcId, 'NORMAL');

        const conv = this.getConvState().activeConversation;
        if (conv) {
            conv.mode = 'GROUP';
            for (const c of followingCompanions.slice(1)) {
                const cId = (c as any).meta.sourceNpcId;
                if (!conv.participants.includes(cId)) {
                    conv.participants.push(cId);
                }
            }
        }

        await this.emitStateUpdate();
        return result;
    }

    // ---------------------------------------------------------------
    // Background Chatter System
    // ---------------------------------------------------------------

    /**
     * Called at end of each exploration turn. Handles:
     * - Speech bubble generation from companions
     * - Background inter-party private conversations
     */
    public async tickBackgroundChatter(turnNumber: number): Promise<SpeechBubble[]> {
        if (this.isInTalkMode()) return []; // Don't chatter during active talk

        const convState = this.getConvState();
        const followingCompanions = this.state.companions.filter((c: any) => c.meta?.followState === 'following');
        if (followingCompanions.length === 0) return [];

        // Reset per-turn token budget
        convState.tokenBudgetUsedThisTurn = 0;

        const newBubbles: SpeechBubble[] = [];

        // --- Public speech bubble (ambient comment) ---
        const eligibleForChatter = followingCompanions.filter((c: any) => {
            const npcId = c.meta.sourceNpcId;
            const lastChatter = convState.chatterCooldowns[npcId] || 0;
            return (turnNumber - lastChatter) >= CHATTER_COOLDOWN_TURNS;
        });

        if (eligibleForChatter.length > 0) {
            // Pick one companion weighted by personality
            const weighted = eligibleForChatter.map((c: any) => {
                let weight = 1.0;
                for (const trait of (c.meta.originalTraits || [])) {
                    weight *= (CHATTER_TRAIT_MODIFIERS[trait] || 1.0);
                }
                return { companion: c, weight };
            });

            const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
            const chatterRoll = Math.random() * totalWeight;
            let cumulative = 0;
            let chosen: any = null;
            for (const { companion, weight } of weighted) {
                cumulative += weight;
                if (chatterRoll <= cumulative) { chosen = companion; break; }
            }

            // Base chance of chatter this turn: 25%
            if (chosen && Math.random() < 0.25) {
                const npcForChatter = this.resolveCompanionAsNpc(chosen.meta.sourceNpcId);
                if (npcForChatter && convState.tokenBudgetUsedThisTurn + 150 <= MAX_TURN_TOKEN_BUDGET) {
                    try {
                        const chatter = await NPCService.generateChatter(this.state, {
                            location: { name: this.hexMapManager.getHex(this.state.location.hexId)?.name || 'Unknown' },
                            mode: this.state.mode,
                            player: { hpStatus: `${this.state.character.hp.current}/${this.state.character.hp.max}` }
                        }, npcForChatter);

                        if (chatter) {
                            const bubble: SpeechBubble = {
                                npcId: chosen.meta.sourceNpcId,
                                npcName: chosen.character.name,
                                text: chatter,
                                expiresAt: Date.now() + SPEECH_BUBBLE_DURATION_MS,
                                isInterParty: false
                            };
                            convState.speechBubbles.push(bubble);
                            newBubbles.push(bubble);
                            convState.chatterCooldowns[chosen.meta.sourceNpcId] = turnNumber;
                            convState.tokenBudgetUsedThisTurn += 150;
                        }
                    } catch (e) {
                        console.warn('[ConversationManager] Chatter generation failed:', e);
                    }
                }
            }
        }

        // --- Background inter-party private conversation ---
        if (followingCompanions.length >= 2 &&
            Math.random() < BACKGROUND_CONVO_CHANCE &&
            convState.backgroundConversations.length < MAX_BACKGROUND_CONVERSATIONS &&
            convState.tokenBudgetUsedThisTurn + 200 <= MAX_TURN_TOKEN_BUDGET &&
            (turnNumber - convState.lastBackgroundChatterTurn) >= CHATTER_COOLDOWN_TURNS
        ) {
            try {
                await this.generateBackgroundConversation(followingCompanions, turnNumber);
                convState.lastBackgroundChatterTurn = turnNumber;
                convState.tokenBudgetUsedThisTurn += 200;
            } catch (e) {
                console.warn('[ConversationManager] Background conversation failed:', e);
            }
        }

        // Expire old speech bubbles
        const now = Date.now();
        convState.speechBubbles = convState.speechBubbles.filter(b => b.expiresAt > now);

        return newBubbles;
    }

    // ---------------------------------------------------------------
    // Private Helpers
    // ---------------------------------------------------------------

    private addToConversationHistory(speakerId: string, speakerName: string, text: string, isPrivate: boolean): void {
        const conv = this.getConvState().activeConversation;
        if (!conv) return;
        conv.history.push({
            speakerId, speakerName, text, isPrivate,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Picks the best responder from participants based on personality-topic overlap.
     */
    private pickResponderByResonance(input: string, participantIds: string[]): string {
        const words = input.toLowerCase().split(/\s+/);
        let bestId = participantIds[0];
        let bestScore = -1;

        for (const id of participantIds) {
            const npc = this.resolveCompanionAsNpc(id);
            if (!npc) continue;
            let score = 0;
            for (const trait of (npc.traits || [])) {
                const keywords = TRAIT_TOPIC_KEYWORDS[trait] || [];
                for (const word of words) {
                    if (keywords.includes(word)) score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestId = id;
            }
        }

        return bestId;
    }

    /**
     * After primary NPC responds, other participants may comment.
     */
    private async maybeGenerateCommentary(
        conv: ActiveConversation,
        responderId: string,
        responseText: string
    ): Promise<void> {
        const otherParticipants = conv.participants.filter(id => id !== responderId);
        if (otherParticipants.length === 0) return;

        const convState = this.getConvState();
        const chance = conv.mode === 'GROUP' ? PUBLIC_COMMENT_CHANCE_GROUP : PUBLIC_COMMENT_CHANCE_NORMAL;

        for (const otherId of otherParticipants) {
            if (Math.random() > chance) continue;
            if (convState.tokenBudgetUsedThisTurn + 150 > MAX_TURN_TOKEN_BUDGET) break;

            const otherNpc = this.resolveCompanionAsNpc(otherId);
            if (!otherNpc) continue;

            try {
                // Use generateDialogue with full context instead of generic chatter
                const responderNpc = this.resolveCompanionAsNpc(responderId);
                const contextPrompt = `[You are listening to a conversation. ${responderNpc?.name || 'Someone'} just said: "${responseText.substring(0, 200)}". React briefly (1 sentence max) if your personality drives you to, or stay silent.]`;
                const dialogueCtx = this.buildDialogueContext(otherId);
                const comment = await NPCService.generateDialogue(this.state, otherNpc, contextPrompt, dialogueCtx);

                if (comment) {
                    const bubble: SpeechBubble = {
                        npcId: otherId,
                        npcName: otherNpc.name,
                        text: comment,
                        expiresAt: Date.now() + SPEECH_BUBBLE_DURATION_MS,
                        isInterParty: false
                    };
                    convState.speechBubbles.push(bubble);
                    convState.tokenBudgetUsedThisTurn += 150;

                    this.addToConversationHistory(otherId, otherNpc.name, comment, false);
                }
            } catch { /* non-critical */ }
            break; // Max 1 commentary per exchange
        }
    }

    /**
     * Passive perception check for eavesdropping on private conversations.
     * Result logged to debugLog only — player never sees.
     */
    private checkEavesdroppers(privateTalkNpcId: string): void {
        const DC = 12;
        for (const companion of this.state.companions) {
            const cId = (companion as any).meta?.sourceNpcId;
            if (cId === privateTalkNpcId) continue; // Can't eavesdrop on your own conversation
            if ((companion as any).meta?.followState !== 'following') continue;

            const wis = (companion.character.stats?.WIS || 10) as number;
            const wisMod = Math.floor((wis - 10) / 2);
            const passivePerception = 10 + wisMod;
            const hasPerceptionProf = (companion.character.skillProficiencies || []).includes('Perception');
            const profBonus = hasPerceptionProf ? Math.ceil(companion.character.level / 4) + 1 : 0;
            const effectivePerception = passivePerception + profBonus;

            if (effectivePerception >= DC) {
                this.state.debugLog = this.state.debugLog || [];
                this.state.debugLog.push(
                    `[Perception] ${companion.character.name} (passive ${effectivePerception}) overheard the private conversation with ${this.resolveCompanionAsNpc(privateTalkNpcId)?.name || 'unknown'}`
                );
            }
        }
    }

    /**
     * Generates a background NPC-NPC conversation (private, not shown to player).
     */
    private async generateBackgroundConversation(companions: any[], turnNumber: number): Promise<void> {
        if (companions.length < 2) return;

        // Pick two random companions
        const shuffled = [...companions].sort(() => Math.random() - 0.5);
        const npc1 = this.resolveCompanionAsNpc(shuffled[0].meta.sourceNpcId);
        const npc2 = this.resolveCompanionAsNpc(shuffled[1].meta.sourceNpcId);
        if (!npc1 || !npc2) return;

        const profile = AgentManager.getAgentProfile('NPC_CONTROLLER');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);
        if (!providerConfig || !modelConfig) return;

        const systemPrompt = `Generate a brief private exchange (2-3 lines) between two traveling companions.
${npc1.name} traits: ${npc1.traits.join(', ')}
${npc2.name} traits: ${npc2.traits.join(', ')}
They are traveling together. Generate a short, natural conversation based on their personalities.
Format: One line per speaker, e.g. "${npc1.name}: text\n${npc2.name}: text"
Keep it under 50 words total.`;

        try {
            const response = await LLMClient.generateCompletion(providerConfig, modelConfig, {
                systemPrompt,
                userMessage: 'Generate the private exchange.',
                temperature: 0.9,
                maxTokens: 200,
                responseFormat: 'text'
            });

            if (response) {
                const lines = response.split('\n').filter(l => l.trim());
                const messages: ConversationMessage[] = lines.map(line => {
                    const colonIdx = line.indexOf(':');
                    const speaker = colonIdx > 0 ? line.substring(0, colonIdx).trim() : npc1.name;
                    const text = colonIdx > 0 ? line.substring(colonIdx + 1).trim() : line.trim();
                    const speakerId = speaker.toLowerCase().includes(npc1.name.split(' ')[0].toLowerCase())
                        ? npc1.id : npc2.id;
                    return { speakerId, speakerName: speaker, text, isPrivate: true, timestamp: new Date().toISOString() };
                });

                // Derive topic from first line
                const topic = messages[0]?.text.substring(0, 40) || 'small talk';

                this.getConvState().backgroundConversations.push({
                    participantIds: [npc1.id, npc2.id],
                    topic,
                    messages,
                    startedAtTurn: turnNumber
                });

                console.log(`[ConversationManager] Background conversation: ${npc1.name} ↔ ${npc2.name} about "${topic}"`);
            }
        } catch (e) {
            console.warn('[ConversationManager] Background conversation LLM call failed:', e);
        }
    }

    /**
     * Generates a summary of the active conversation for narrator context.
     */
    private async generateConversationSummary(conv: ActiveConversation): Promise<string> {
        const profile = AgentManager.getAgentProfile('DIRECTOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);
        if (!providerConfig || !modelConfig) {
            return this.mechanicalSummary(conv);
        }

        const historyText = conv.history
            .map(m => `${m.speakerName}: ${m.text}`)
            .join('\n');

        try {
            const summary = await LLMClient.generateCompletion(providerConfig, modelConfig, {
                systemPrompt: `Summarize this conversation in 1-2 sentences. Focus on key topics discussed, any agreements made, and emotional tone. Be concise.`,
                userMessage: historyText,
                temperature: 0.3,
                maxTokens: 200,
                responseFormat: 'text'
            });
            return summary || this.mechanicalSummary(conv);
        } catch {
            return this.mechanicalSummary(conv);
        }
    }

    private mechanicalSummary(conv: ActiveConversation): string {
        const npcName = this.resolveCompanionAsNpc(conv.primaryNpcId)?.name || 'someone';
        return `Had a ${conv.mode.toLowerCase()} conversation with ${npcName} (${conv.history.length} exchanges).`;
    }

    /**
     * Applies a relationship delta to an NPC (companion or world NPC).
     */
    private applyRelationshipDelta(npcId: string, delta: number, reason: string): void {
        // Check companions
        const companion = this.state.companions.find((c: any) => c.meta?.sourceNpcId === npcId);
        if (companion) {
            // Companions don't have a relationship field directly, but we track via world NPC restoration
            // For now, log it
            console.log(`[ConversationManager] Companion relationship delta: ${companion.character.name} ${delta > 0 ? '+' : ''}${delta} (${reason})`);
            return;
        }

        // Check world NPCs
        const npc = this.state.worldNpcs.find(n => n.id === npcId);
        if (npc) {
            npc.relationship.standing = Math.max(-100, Math.min(100, npc.relationship.standing + delta));
            npc.relationship.interactionLog = npc.relationship.interactionLog || [];
            npc.relationship.interactionLog.push({
                event: reason,
                delta,
                timestamp: new Date().toISOString()
            });
            npc.relationship.lastInteraction = new Date().toISOString();
        }
    }

    /**
     * Simple Levenshtein distance for fuzzy name matching.
     */
    private levenshtein(a: string, b: string): number {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }
}
