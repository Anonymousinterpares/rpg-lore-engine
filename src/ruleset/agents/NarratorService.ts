import { GameState } from '../schemas/FullSaveStateSchema';
import { HexMapManager } from '../combat/HexMapManager';
import { ContextBuilder } from './ContextBuilder';
import { LLMClient } from '../combat/LLMClient';
import { AgentManager } from './AgentManager';
import { NarratorOutputSchema, NarratorOutput } from './ICPSchemas';
import { AgentProfile } from '../schemas/AgentConfigSchema';
import { LLM_PROVIDERS } from '../data/StaticData';

export class NarratorService {
    private static isFirstTurnAfterLoad = false;

    public static setFirstTurnAfterLoad(value: boolean) {
        this.isFirstTurnAfterLoad = value;
    }

    /**
     * Primary entry point for generating narrative.
     */
    public static async generate(
        state: GameState,
        hexManager: HexMapManager,
        playerInput: string,
        history: any[],
        directorDirective?: any
    ): Promise<NarratorOutput> {
        const profile = AgentManager.getAgentProfile('NARRATOR');
        const context = ContextBuilder.build(state, hexManager, history);

        // Resolve provider and model configs
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig) throw new Error(`Provider ${profile.providerId} not found.`);

        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) throw new Error(`Model ${profile.modelId} not found in provider ${profile.providerId}.`);

        const systemPrompt = this.constructSystemPrompt(context, state, profile, directorDirective);

        try {
            const rawResponse = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: playerInput || "The adventure begins.", // Handled as exploration trigger if empty
                    temperature: profile.temperature,
                    maxTokens: profile.maxTokens,
                    responseFormat: 'json'
                }
            );

            // Clean response for JSON parsing (remove markdown blocks if LLM adds them)
            const cleanJson = this.extractJson(rawResponse);
            const parsed = NarratorOutputSchema.parse(JSON.parse(cleanJson));

            this.isFirstTurnAfterLoad = false; // Reset after use
            return parsed;
        } catch (e: any) {
            console.error('[NarratorService] Narrative generation failed:', e);
            return {
                narrative_output: `[System Error] Narrative generation failed: ${e.message}`,
                engine_calls: [],
                world_updates: { hex_discovery: null, poi_unlocked: null }
            };
        }
    }

    private static constructSystemPrompt(context: any, state: GameState, profile: AgentProfile, directorDirective?: any): string {
        const isNewGame = state.conversationHistory.length === 0 && !this.isFirstTurnAfterLoad;

        let prompt = `You are the Narrator for a D&D 5e text-based RPG.
${profile.basePrompt}

## CURRENT CONTEXT
- Mode: ${context.mode}
- Time: ${context.timeOfDay}
- Location: ${context.location.name} (${context.location.biome})
- Description: ${context.location.description}
- Player: ${context.player.name}, Level ${context.player.level} ${context.player.class} (${context.player.hpStatus})
- Story So Far: ${context.storySummary}

`;

        if (directorDirective) {
            prompt += `
## DIRECTOR DIRECTIVE
${directorDirective.directive}
(Note: Incorporate this into your narrative or engine calls naturally.)

`;
        }

        if (isNewGame) {
            prompt += `
## NEW ADVENTURE START
This is the OPENING of a new adventure.
The player, ${context.player.name}, awakens in this location with no memory of how they arrived. They know only their name.
TASK:
1. Describe the scene viscerally.
2. Hint at the mystery of their arrival.
3. Suggest 2-3 immediate actions.
4. Set a tone of wonder mixed with mild unease.
`;
        } else if (this.isFirstTurnAfterLoad) {
            prompt += `
## RESUMING ADVENTURE
The player is resuming a saved game.
TASK:
1. Provide a brief (2-3 sentence) recap of where they are and what they were doing.
2. End with "What would you like to do?"
`;
        }

        // Add mode-specific details
        if (context.combat) {
            prompt += `
## COMBAT STATUS
- Round: ${context.combat.round}
- Enemies: ${context.combat.enemySummary}
- Turn: ${context.combat.isPlayerTurn ? 'Players turn' : 'Enemies turn'}
`;
        }

        prompt += `
## OUTPUT RULES
- Output MUST be valid JSON matching NarratorOutputSchema.
- Keep narrative concise and evocative.
- Suggest discoveries or mechanical triggers via engine_calls when appropriate.
`;

        return prompt;
    }

    private static extractJson(text: string): string {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : text;
    }
}
