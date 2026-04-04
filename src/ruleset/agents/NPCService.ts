import { GameState } from '../schemas/FullSaveStateSchema';
import { AgentManager } from './AgentManager';
import { LLMClient } from '../combat/LLMClient';
import { LLM_PROVIDERS } from '../data/StaticData';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { EventBusManager } from '../combat/managers/EventBusManager';
import { toStructuredTraits, formatTraitsForPrompt } from '../data/TraitRegistry';

/**
 * Optional enriched context for dialogue — provides party awareness,
 * conversation mode, participant info, and background knowledge.
 */
export interface DialogueContext {
    mode?: 'PRIVATE' | 'NORMAL' | 'GROUP';
    participants?: { name: string; role?: string; traits?: string }[];
    partyMembers?: { name: string; role?: string }[];
    recentExchanges?: { speaker: string; text: string }[];
    backgroundKnowledge?: string[];
    priorConversationSummary?: string;
    /** Self-awareness: the NPC's own stats, equipment, spells, gold, etc. */
    selfAwareness?: {
        class: string;
        level: number;
        hp: { current: number; max: number };
        ac: number;
        gold: number;
        equippedWeapon?: string;
        equippedArmor?: string;
        equippedShield?: string;
        preparedSpells?: string[];
        cantrips?: string[];
        conditions?: string[];
        locationName?: string;
        locationBiome?: string;
    };
}

export class NPCService {
    /**
     * Generates personality-driven chatter or reactions from party companions or nearby NPCs.
     */
    public static async generateChatter(state: GameState, context: any, npc?: WorldNPC): Promise<string | null> {
        let targetNPC = npc;

        // If no specific NPC provided, pick a random following companion
        if (!targetNPC && state.companions && state.companions.length > 0) {
            const followingCompanions = state.companions.filter((c: any) => c.meta?.followState === 'following');
            if (followingCompanions.length > 0) {
                const picked = followingCompanions[Math.floor(Math.random() * followingCompanions.length)];
                // Create a temporary WorldNPC-like object from companion data for the chatter system
                targetNPC = {
                    id: picked.meta.sourceNpcId,
                    name: picked.character.name,
                    traits: picked.meta.originalTraits || [],
                    relationship: { standing: 30, interactionLog: [] },
                    conversationHistory: [],
                    isMerchant: false,
                    dialogue_triggers: [],
                    inventory: [],
                    availableQuests: [],
                    stats: picked.character.stats,
                    role: picked.meta.originalRole,
                    factionId: picked.meta.originalFactionId,
                } as any;
            }
        }

        if (!targetNPC) return null;

        const profile = AgentManager.getAgentProfile('NPC_CONTROLLER');

        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig) return null;

        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) return null;

        const structuredTraits = formatTraitsForPrompt(toStructuredTraits(targetNPC.traits));
        const memory = targetNPC.conversationHistory.slice(-3).map(c => `${c.speaker}: ${c.text}`).join('\n');

        const systemPrompt = `You are the NPC Controller for ${targetNPC.name}.
## CHARACTER TRAITS
${structuredTraits}

## SCENE CONTEXT
- Location: ${context.location.name}
- Activity: ${context.mode}
- Player Status: ${context.player.hpStatus}

## RECENT MEMORY
${memory || 'No recent interactions.'}

## TASK
Provide a short, personality-driven comment from ${targetNPC.name} based on the situation and their traits.
Keep it under 2 sentences. Do not use generic fantasy tropes unless they fit the specific traits.
`;

        try {
            return await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: "What does the NPC say?",
                    temperature: profile.temperature,
                    maxTokens: profile.maxTokens
                }
            );
        } catch (e) {
            console.error(`[NPCService] Chatter generation failed for ${targetNPC.name}:`, e);
            return null;
        }
    }

    /**
     * Generates a direct dialogue response from an NPC.
     */
    public static async generateDialogue(
        state: GameState,
        npc: WorldNPC,
        playerInput: string,
        dialogueCtx?: DialogueContext
    ): Promise<string | null> {
        const profile = AgentManager.getAgentProfile('NPC_CONTROLLER');

        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig) return null;

        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) return null;

        const structuredTraits = formatTraitsForPrompt(toStructuredTraits(npc.traits));
        const memory = npc.conversationHistory.slice(-5).map(c => `${c.speaker}: ${c.text}`).join('\n');

        let systemPrompt = `You are responding as ${npc.name} in a D&D RPG.
## CHARACTER TRAITS
${structuredTraits}
RELATIONSHIP STANDING: ${npc.relationship.standing} (-100 to 100)

## CONVERSATION HISTORY
${memory || 'No previous conversation.'}
`;

        // Enriched context: conversation mode
        if (dialogueCtx?.mode) {
            const modeDesc = dialogueCtx.mode === 'PRIVATE'
                ? 'This is a PRIVATE conversation. Other party members cannot hear what is being said.'
                : dialogueCtx.mode === 'GROUP'
                    ? 'This is a GROUP discussion. All listed participants can hear and respond.'
                    : 'This is an open conversation. Other party members can hear.';
            systemPrompt += `\n## CONVERSATION MODE\n${modeDesc}\n`;
        }

        // Enriched context: other participants in this conversation
        if (dialogueCtx?.participants && dialogueCtx.participants.length > 0) {
            const others = dialogueCtx.participants.filter(p => p.name !== npc.name);
            if (others.length > 0) {
                systemPrompt += `\n## OTHER PARTICIPANTS\n${others.map(p => `- ${p.name}${p.role ? ` (${p.role})` : ''}${p.traits ? ` — ${p.traits}` : ''}`).join('\n')}\n`;
            }
        }

        // Enriched context: full party roster (companions not in conversation)
        if (dialogueCtx?.partyMembers && dialogueCtx.partyMembers.length > 0) {
            const notInConvo = dialogueCtx.partyMembers.filter(
                p => p.name !== npc.name && !dialogueCtx.participants?.some(pp => pp.name === p.name)
            );
            if (notInConvo.length > 0) {
                systemPrompt += `\n## OTHER PARTY MEMBERS (not in this conversation)\n${notInConvo.map(p => `- ${p.name}${p.role ? ` (${p.role})` : ''}`).join('\n')}\nYou know these companions and can reference them if asked.\n`;
            }
        }

        // Enriched context: recent exchanges from all participants
        if (dialogueCtx?.recentExchanges && dialogueCtx.recentExchanges.length > 0) {
            systemPrompt += `\n## RECENT EXCHANGE (what was just said)\n${dialogueCtx.recentExchanges.map(e => `${e.speaker}: ${e.text}`).join('\n')}\n`;
        }

        // Enriched context: SELF-AWARENESS — the NPC's own stats, gear, spells, location
        if (dialogueCtx?.selfAwareness) {
            const sa = dialogueCtx.selfAwareness;
            let selfLines = `You are a Level ${sa.level} ${sa.class}. HP: ${sa.hp.current}/${sa.hp.max}. AC: ${sa.ac}.`;
            if (sa.gold > 0) selfLines += ` Gold: ${sa.gold} gp.`;
            if (sa.equippedWeapon) selfLines += `\nWielding: ${sa.equippedWeapon}.`;
            if (sa.equippedArmor) selfLines += ` Wearing: ${sa.equippedArmor}.`;
            if (sa.equippedShield) selfLines += ` Carrying: ${sa.equippedShield}.`;
            if (sa.preparedSpells && sa.preparedSpells.length > 0) selfLines += `\nSpells: ${sa.preparedSpells.join(', ')}.`;
            if (sa.cantrips && sa.cantrips.length > 0) selfLines += ` Cantrips: ${sa.cantrips.join(', ')}.`;
            if (sa.conditions && sa.conditions.length > 0) selfLines += `\nConditions: ${sa.conditions.join(', ')}.`;
            if (sa.locationName) selfLines += `\nLocation: ${sa.locationName}${sa.locationBiome ? ` (${sa.locationBiome})` : ''}.`;
            systemPrompt += `\n## YOUR STATUS (what you know about yourself)\n${selfLines}\nReference your equipment, spells, or status naturally when relevant — e.g., mention your weapon by name, offer to cast a spell you know, or comment on your wounds.\n`;
        }

        // Enriched context: background knowledge (private NPC-NPC conversations this NPC had)
        if (dialogueCtx?.backgroundKnowledge && dialogueCtx.backgroundKnowledge.length > 0) {
            systemPrompt += `\n## PRIVATE KNOWLEDGE\nYou privately discussed the following (the player does not know about these):\n${dialogueCtx.backgroundKnowledge.map(k => `- ${k}`).join('\n')}\nYou may subtly reference this knowledge but should NOT reveal it was a private discussion.\n`;
        }

        // Enriched context: summary from a prior conversation session
        if (dialogueCtx?.priorConversationSummary) {
            systemPrompt += `\n## PRIOR CONVERSATION\nEarlier, you and the player discussed: ${dialogueCtx.priorConversationSummary}\n`;
        }

        systemPrompt += `
## TASK
Respond to the player's message in character.
- Your personality must be strictly driven by your TRAITS.
- Your tone should reflect your RELATIONSHIP STANDING.
- Keep the response concise (1-3 sentences).
- If you are a merchant (${npc.isMerchant}), you may mention your shop if appropriate.
`;

        try {
            const response = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: playerInput,
                    temperature: 0.8,
                    maxTokens: profile.maxTokens, // Use configured value, not hardcoded
                    responseFormat: 'text' // Explicit: we want free-text dialogue, not JSON
                }
            );

            if (response) {
                // Persistent memory update
                npc.conversationHistory.push({
                    speaker: 'Player',
                    text: playerInput,
                    timestamp: new Date().toISOString()
                });
                npc.conversationHistory.push({
                    speaker: npc.name,
                    text: response,
                    timestamp: new Date().toISOString()
                });

                // Cap conversation history to prevent save bloat (30 entries = 15 exchanges)
                const MAX_CONVERSATION_HISTORY = 30;
                if (npc.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
                    npc.conversationHistory = npc.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
                }
            }

            EventBusManager.publish('NPC_INTERACTION', { npcId: npc.id, nodeTopic: playerInput.substring(0, 50) });

            return response;
        } catch (e) {
            console.error(`[NPCService] Dialogue generation failed for ${npc.name}:`, e);
            return "The individual seems unable to respond right now.";
        }
    }

    /**
     * Evaluates how a dialogue exchange affected the NPC's relationship with the player.
     * Called as a fallback when the narrator didn't emit set_npc_disposition.
     * Returns a small delta (-5 to +5) and a brief reason.
     */
    public static async evaluateRelationshipDelta(
        npc: WorldNPC,
        playerInput: string,
        npcResponse: string
    ): Promise<{ delta: number; reason: string } | null> {
        const profile = AgentManager.getAgentProfile('DIRECTOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);
        if (!providerConfig || !modelConfig) return null;

        const systemPrompt = `You evaluate how a dialogue exchange affects an NPC's feelings toward the player.
NPC: ${npc.name} (current standing: ${npc.relationship.standing})
NPC traits: ${npc.traits.join(', ')}

Return ONLY valid JSON: { "delta": <number -5 to 5>, "reason": "<brief reason>" }
- delta 0 = neutral exchange, no change
- delta +1 to +5 = player was kind, helpful, respectful, shared interests
- delta -1 to -5 = player was rude, threatening, dismissive, insulting
- Consider the NPC's personality when judging (e.g., a "Suspicious" NPC is harder to impress)`;

        try {
            const response = await LLMClient.generateCompletion(
                providerConfig, modelConfig,
                {
                    systemPrompt,
                    userMessage: `Player said: "${playerInput}"\nNPC responded: "${npcResponse}"`,
                    temperature: 0.1,
                    maxTokens: 1000, // Thinking models need headroom for reasoning + JSON output
                    responseFormat: 'json'
                }
            );

            const parsed = JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
            const delta = Math.max(-5, Math.min(5, parsed.delta || 0));
            if (delta === 0) return null; // No change, no need to update

            return { delta, reason: parsed.reason || 'Dialogue exchange' };
        } catch (e) {
            console.warn('[NPCService] Relationship delta evaluation failed (non-critical):', e);
            return null;
        }
    }
}
