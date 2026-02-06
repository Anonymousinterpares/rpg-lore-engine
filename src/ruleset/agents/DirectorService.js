import { AgentManager } from './AgentManager';
import { LLMClient } from '../combat/LLMClient';
import { DirectorDirectiveSchema } from './ICPSchemas';
import { LLM_PROVIDERS } from '../data/StaticData';
export class DirectorService {
    /**
     * The Director analyzes the game state and provides "directives"
     * which are injected into the Narrator's context to guide the story.
     */
    static async evaluatePacing(state) {
        // Only run every few turns to save tokens, or if something significant changed
        if (state.conversationHistory.length % 5 !== 0)
            return null;
        const profile = AgentManager.getAgentProfile('DIRECTOR');
        // Resolve provider and model configs
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig)
            return null;
        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig)
            return null;
        const systemPrompt = `You are the Game Director.
${profile.basePrompt}

## PACING METRICS
- Current Mode: ${state.mode}
- Total Turns: ${state.worldTime.totalTurns}
- HP Status: ${state.character.hp.current}/${state.character.hp.max}
- Active Quests: ${state.activeQuests.length}

## TASK
Analyze the current flow. 
- If the player is cruising too easily, suggest a complication.
- If the player is struggling, suggest a helpful discovery.
- If the story is stalling, suggest a pacing event (e.g., a distant sound, a sudden change in weather).

Output MUST be valid JSON matching DirectorDirectiveSchema.
`;
        try {
            const rawResponse = await LLMClient.generateCompletion(providerConfig, modelConfig, {
                systemPrompt,
                userMessage: "Evaluate current pacing.",
                temperature: profile.temperature,
                maxTokens: profile.maxTokens,
                responseFormat: 'json'
            });
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            const cleanJson = jsonMatch ? jsonMatch[0] : rawResponse;
            return DirectorDirectiveSchema.parse(JSON.parse(cleanJson));
        }
        catch (e) {
            console.error('[DirectorService] Pacing evaluation failed:', e);
            return null;
        }
    }
}
