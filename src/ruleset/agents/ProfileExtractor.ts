import { AgentManager } from './AgentManager';
import { LLMClient } from '../combat/LLMClient';
import { LLM_PROVIDERS } from '../data/StaticData';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';

export class ProfileExtractor {
    /**
     * Extract factual information about NPCs from narrative text.
     * Uses a strict prompt to prevent hallucination.
     * Returns a map of npcId → extracted facts (string[]).
     */
    public static async extractNpcFacts(
        narrativeText: string,
        npcsInHex: WorldNPC[]
    ): Promise<Map<string, string[]>> {
        const results = new Map<string, string[]>();
        if (!narrativeText || npcsInHex.length === 0) return results;

        const profile = AgentManager.getAgentProfile('DIRECTOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) return results;

        const npcNames = npcsInHex.map(n => n.name).join(', ');
        const systemPrompt = `You are a factual data extractor for an RPG codex.
TASK:
Analyze the provided text and extract NEW factual information about these specific NPCs: ${npcNames}.

STRICT CONSTRAINTS:
1. Extract ONLY facts explicitly stated in the text (e.g., appearance, equipment, stated origins, visible actions).
2. Do NOT infer, speculate, or add information not in the text.
3. If the text mentions nothing new or specific about an NPC, return nothing for them.
4. If a fact is already likely known (like "he is a shopkeeper" when they are a merchant), skip it.
5. Format your response as a JSON object where keys are NPC names and values are arrays of strings (facts).
6. If no facts are found for any NPC, return an empty JSON object {}.

TEXT TO ANALYZE:
"${narrativeText}"

JSON output:`;

        try {
            const response = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: "Extract facts in JSON format.",
                    temperature: 0.1, // High precision
                    maxTokens: 500,
                    responseFormat: 'json' // CRITICAL: We expect JSON output
                }
            );

            if (!response) return results;

            // Attempt to parse JSON
            try {
                const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedResponse);

                for (const npc of npcsInHex) {
                    if (parsed[npc.name] && Array.isArray(parsed[npc.name])) {
                        results.set(npc.id, parsed[npc.name]);
                    }
                }
            } catch (jsonError) {
                console.warn('[ProfileExtractor] JSON parse failed:', jsonError, response);
            }
        } catch (e) {
            console.error('[ProfileExtractor] Fact extraction failed:', e);
        }

        return results;
    }
}
