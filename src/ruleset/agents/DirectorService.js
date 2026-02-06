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
        if (!providerConfig) {
            console.warn('[DirectorService] Provider not found:', profile.providerId);
            return null;
        }
        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) {
            console.warn('[DirectorService] Model not found:', profile.modelId);
            return null;
        }
        const systemPrompt = `You are the Game Director.
${profile.basePrompt || ''}

## PACING METRICS
- Current Mode: ${state.mode}
- Total Turns: ${state.worldTime.totalTurns}
- HP Status: ${state.character.hp.current}/${state.character.hp.max}
- Active Quests: ${state.activeQuests.length}

## TASK
Analyze the current flow. 
- If the player is cruising too easily, suggest a complication.
- If the player is struggling, suggest a helpful discovery.
- If the story is stalling, suggest a pacing event.

## OUTPUT FORMAT (STRICT JSON)
You MUST respond with ONLY valid JSON in this exact format:
{
  "type": "PACING_EVENT",
  "directive": "Introduce a distant rumble of thunder to set an ominous tone."
}

Valid "type" values: "XP_GAIN", "ITEM_EVAL", "PACING_EVENT", "SURPRISE_CHECK"
`;
        try {
            console.log('[DirectorService] Evaluating pacing...');
            const rawResponse = await LLMClient.generateCompletion(providerConfig, modelConfig, {
                systemPrompt,
                userMessage: "Evaluate current pacing.",
                temperature: profile.temperature,
                maxTokens: profile.maxTokens,
                responseFormat: 'json'
            });
            console.log('[DirectorService] Raw response:', rawResponse.substring(0, 200));
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('[DirectorService] No JSON found in response');
                return null;
            }
            const cleanJson = jsonMatch[0];
            const parsed = JSON.parse(cleanJson);
            // Validate with Zod, but don't crash if it fails
            const result = DirectorDirectiveSchema.safeParse(parsed);
            if (!result.success) {
                console.warn('[DirectorService] Response did not match schema:', result.error.errors);
                return null;
            }
            console.log('[DirectorService] Directive:', result.data);
            return result.data;
        }
        catch (e) {
            console.error('[DirectorService] Pacing evaluation failed:', e);
            return null;
        }
    }
}
