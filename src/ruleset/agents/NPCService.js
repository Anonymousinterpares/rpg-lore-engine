import { AgentManager } from './AgentManager';
import { LLMClient } from '../combat/LLMClient';
import { LLM_PROVIDERS } from '../data/StaticData';
export class NPCService {
    /**
     * Generates personality-driven chatter or reactions from party companions.
     */
    static async generateChatter(state, context) {
        // Companions logic placeholder - check if any companions exist
        // This would be expanded as the companion system is implemented.
        const companions = state.character.biography?.chronicles?.filter(c => c.event.includes('Joined party'));
        if (!companions || companions.length === 0)
            return null;
        const profile = AgentManager.getAgentProfile('NPC_CONTROLLER');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig)
            return null;
        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig)
            return null;
        const systemPrompt = `You are the NPC Controller.
${profile.basePrompt}

## SCENE CONTEXT
- Location: ${context.location.name}
- Activity: ${context.mode}
- Player Status: ${context.player.hpStatus}

## TASK
Provide a short, personality-driven comment from one of the companions based on the current situation.
Keep it under 2 sentences.
`;
        try {
            return await LLMClient.generateCompletion(providerConfig, modelConfig, {
                systemPrompt,
                userMessage: "What does the party say?",
                temperature: profile.temperature,
                maxTokens: profile.maxTokens
            });
        }
        catch (e) {
            console.error('[NPCService] Chatter generation failed:', e);
            return null;
        }
    }
}
