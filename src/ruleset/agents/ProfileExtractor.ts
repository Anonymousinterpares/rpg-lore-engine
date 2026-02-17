import { AgentManager } from './AgentManager';
import { LLMClient } from '../combat/LLMClient';
import { LLM_PROVIDERS } from '../data/StaticData';

export interface NPCProfile {
    appearance: string;
    personality: string;
    background: string;
    occupation: string;
    relationships: string;
    notableQuotes: string[];
}

export class ProfileExtractor {
    /**
     * Merges a new factual narrative into an existing NPC profile using LLM.
     * Returns a complete updated NPCProfile object.
     */
    public static async mergeNpcProfile(
        narrativeText: string,
        npcName: string,
        existingProfile?: NPCProfile
    ): Promise<NPCProfile | null> {
        if (!narrativeText) return existingProfile || null;

        const profile = AgentManager.getAgentProfile('DIRECTOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) return existingProfile || null;

        const existingStr = existingProfile
            ? JSON.stringify(existingProfile, null, 2)
            : "No existing profile. This is the first encounter.";

        const systemPrompt = `You are an RPG chronicler maintaining a structured NPC codex.
TASK:
Analyze the "NEW NARRATIVE" and merge any new factual information into the "EXISTING PROFILE" for NPC: ${npcName}.

OUTPUT FORMAT:
Return a complete, rewritten JSON object matching this schema:
{
  "appearance": "Physical description and clothing.",
  "personality": "Traits, mannerisms, and temperament.",
  "background": "History, origins, and past deeds.",
  "occupation": "Current role, shop details, or daily activities.",
  "relationships": "Factions, friends, enemies, or attitudes toward groups.",
  "notableQuotes": ["Up to 5 short, direct quotes from their dialogue."]
}

STRICT CONSTRAINTS:
1. DO NOT speculate. Only include facts explicitly stated or strongly implied in the NEW NARRATIVE.
2. MERGE with existing data. Do not delete existing info unless the new text directly contradicts it.
3. DEDUPLICATE. Do not repeat facts. If new info refines old info, rewrite the relevant section to be cohesive.
4. KEEP IT CONCISE. Use evocative but efficient prose.
5. QUOTES: Only include actual dialogue. Maintain a max of 5. If adding a 6th, drop the least significant one.
6. If the NEW NARRATIVE contains no new info about ${npcName}, return the "EXISTING PROFILE" as-is.

EXISTING PROFILE:
${existingStr}

NEW NARRATIVE TO ANALYZE:
"${narrativeText}"

JSON output:`;

        try {
            const response = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: `Merge new facts for ${npcName} and return the updated structured JSON profile.`,
                    temperature: 0.1, // High precision
                    maxTokens: 800,
                    responseFormat: 'json'
                }
            );

            if (!response) return existingProfile || null;

            // Attempt to parse JSON
            try {
                const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedResponse);

                // Basic validation
                if (typeof parsed === 'object' && parsed !== null) {
                    return {
                        appearance: parsed.appearance || '',
                        personality: parsed.personality || '',
                        background: parsed.background || '',
                        occupation: parsed.occupation || '',
                        relationships: parsed.relationships || '',
                        notableQuotes: Array.isArray(parsed.notableQuotes) ? parsed.notableQuotes.slice(0, 5) : []
                    };
                }
            } catch (jsonError) {
                console.warn('[ProfileExtractor] JSON parse failed during merge:', jsonError, response);
            }
        } catch (e) {
            console.error('[ProfileExtractor] Profile merge failed:', e);
        }

        return existingProfile || null;
    }
}
