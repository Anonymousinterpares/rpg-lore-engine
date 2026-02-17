import { GameState } from '../schemas/FullSaveStateSchema';
import { AgentManager } from './AgentManager';
import { LLMClient } from '../combat/LLMClient';
import { LLM_PROVIDERS } from '../data/StaticData';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';

export class NPCService {
    /**
     * Generates personality-driven chatter or reactions from party companions or nearby NPCs.
     */
    public static async generateChatter(state: GameState, context: any, npc?: WorldNPC): Promise<string | null> {
        let targetNPC = npc;

        // If no specific NPC provided, look for party companions
        if (!targetNPC) {
            const companions = state.character.biography?.chronicles?.filter(c => c.event.includes('Joined party'));
            if (companions && companions.length > 0) {
                // Pick a random/first companion for now
                const companionName = companions[0].event.split(' ')[0]; // Very naive extraction
                // Note: Real companion implementation would have a WorldNPC object in state.companions
                // For now, if we don't have a real object, we return null to avoid crash
                return null;
            }
        }

        if (!targetNPC) return null;

        const profile = AgentManager.getAgentProfile('NPC_CONTROLLER');

        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig) return null;

        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) return null;

        const traits = targetNPC.traits.join(', ');
        const memory = targetNPC.conversationHistory.slice(-3).map(c => `${c.speaker}: ${c.text}`).join('\n');

        const systemPrompt = `You are the NPC Controller for ${targetNPC.name}.
PERSONALITY TRAITS: ${traits}

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
    public static async generateDialogue(state: GameState, npc: WorldNPC, playerInput: string): Promise<string | null> {
        const profile = AgentManager.getAgentProfile('NPC_CONTROLLER');

        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig) return null;

        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) return null;

        const traits = npc.traits.join(', ');
        const memory = npc.conversationHistory.slice(-5).map(c => `${c.speaker}: ${c.text}`).join('\n');

        const systemPrompt = `You are responding as ${npc.name} in a D&D RPG.
PERSONALITY TRAITS: ${traits}
RELATIONSHIP STANDING: ${npc.relationship.standing} (-100 to 100)

## CONVERSATION HISTORY
${memory || 'No previous conversation.'}

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
            }

            return response;
        } catch (e) {
            console.error(`[NPCService] Dialogue generation failed for ${npc.name}:`, e);
            return "The individual seems unable to respond right now.";
        }
    }
}
