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
        directorDirective?: any,
        encounter?: any
    ): Promise<NarratorOutput> {
        const profile = AgentManager.getAgentProfile('NARRATOR');
        const context = ContextBuilder.build(state, hexManager, history);

        // Resolve provider and model configs
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        if (!providerConfig) throw new Error(`Provider ${profile.providerId} not found.`);

        const modelConfig = providerConfig.models.find(m => m.id === profile.modelId);
        if (!modelConfig) throw new Error(`Model ${profile.modelId} not found in provider ${profile.providerId}.`);

        // Handle special opening scene marker
        const isOpeningScene = playerInput === '__OPENING_SCENE__';
        const effectiveInput = isOpeningScene ? 'Describe the opening scene of this new adventure.' : playerInput;

        const systemPrompt = this.constructSystemPrompt(context, state, profile, directorDirective, encounter);

        try {
            console.log(`[NarratorService] Generating narrative (isOpening: ${isOpeningScene})...`);
            const rawResponse = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: effectiveInput || "The adventure begins.",
                    temperature: profile.temperature,
                    maxTokens: profile.maxTokens,
                    responseFormat: 'json'
                }
            );

            console.log('[NarratorService] Raw response (first 300 chars):', rawResponse.substring(0, 300));

            // Clean response for JSON parsing (remove markdown blocks if LLM adds them)
            const cleanJson = this.extractJson(rawResponse);

            // Parse with safeParse to avoid crashes
            let parsed: any;
            try {
                parsed = JSON.parse(cleanJson);
            } catch (jsonError) {
                console.error('[NarratorService] JSON parse error:', jsonError);
                console.error('[NarratorService] Clean JSON was:', cleanJson.substring(0, 500));
                throw new Error('LLM returned invalid JSON');
            }

            const result = NarratorOutputSchema.safeParse(parsed);
            if (!result.success) {
                console.warn('[NarratorService] Schema validation failed:', result.error.errors);
                console.warn('[NarratorService] Parsed object was:', JSON.stringify(parsed).substring(0, 500));

                // Attempt to salvage the narrative_output if it exists
                if (parsed.narrative_output && typeof parsed.narrative_output === 'string') {
                    return {
                        narrative_output: parsed.narrative_output,
                        engine_calls: [],
                        world_updates: { hex_discovery: null, poi_unlocked: null }
                    };
                }

                // If there's any text that looks like narrative, use it
                if (parsed.narrative || parsed.text || parsed.content || parsed.response) {
                    return {
                        narrative_output: parsed.narrative || parsed.text || parsed.content || parsed.response,
                        engine_calls: [],
                        world_updates: { hex_discovery: null, poi_unlocked: null }
                    };
                }

                throw new Error('LLM response did not match expected schema');
            }

            this.isFirstTurnAfterLoad = false; // Reset after use
            return result.data;
        } catch (e: any) {
            console.error('[NarratorService] Narrative generation failed:', e);
            return {
                narrative_output: `[System Error] Narrative generation failed: ${e.message}`,
                engine_calls: [],
                world_updates: { hex_discovery: null, poi_unlocked: null }
            };
        }
    }

    /**
     * Generates a narrative summary of a completed combat encounter.
     */
    public static async summarizeCombat(state: GameState, logs: any[]): Promise<string> {
        const profile = AgentManager.getAgentProfile('NARRATOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) return "The battle ends in silence.";

        const logSummary = logs.map(l => l.message).join('\n');
        const systemPrompt = `You are a legendary bard and chronicler. 
Summarize the combat encounter that just occurred in a visceral, exciting, and concise paragraph.
Focus on the turning points and the final blow. 
Keep it under 100 words.

## RAW COMBAT LOG
${logSummary}`;

        try {
            const rawResponse = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: "Write a dramatic summary of this battle.",
                    temperature: 0.7,
                    maxTokens: 500,
                    responseFormat: 'text'
                }
            );

            return this.extractJson(rawResponse).replace(/\{[\s\S]*\}/, '').trim() || rawResponse.trim();
        } catch (e) {
            console.error('[NarratorService] Combat summary failed:', e);
            return "The dust settles, and the battle is won.";
        }
    }

    private static constructSystemPrompt(context: any, state: GameState, profile: AgentProfile, directorDirective?: any, encounter?: any): string {
        const isNewGame = state.conversationHistory.length === 0 && !this.isFirstTurnAfterLoad;

        let prompt = `You are the Narrator for a D&D 5e text-based RPG.
${profile.basePrompt || ''}

## CURRENT CONTEXT
- Mode: ${context.mode}
- Time: ${context.timeOfDay}
- Date: ${context.dateString} (${context.season})
- Location: ${context.location.name} (${context.location.biome})
- Description: ${context.location.description}
- Player: ${context.player.name}, Level ${context.player.level} ${context.player.class} (${context.player.hpStatus})
- Story So Far: ${context.storySummary}

`;

        if (directorDirective) {
            prompt += `
## DIRECTOR DIRECTIVE
${directorDirective.directive}
(Note: Incorporate this into your narrative naturally.)

`;
        }

        if (encounter) {
            prompt += `
## ENCOUNTER DETAILS
- Name: ${encounter.name}
- Monsters: ${encounter.monsters.join(', ')}
- Context: ${encounter.description}
(Note: You MUST describe these exact monsters. Do not hallucinate other creatures unless they are supplemental to the scene.)

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

        if (context.hex && context.hex.neighbors && context.hex.neighbors.length > 0) {
            const visible = context.hex.neighbors.filter((n: any) => n.distance === 1);
            const horizon = context.hex.neighbors.filter((n: any) => n.distance === 2);

            prompt += `
## SURROUNDINGS
Immediate Vicinity (Visible):
${visible.map((n: any) => `- ${n.direction}: ${n.biome} ${n.name ? `(${n.name})` : ''}`).join('\n')}

On the Horizon (Distant):
${horizon.map((n: any) => `- ${n.direction}: ${n.biome} ${n.name ? `(${n.name})` : ''}`).join('\n')}

CRITICAL INSTRUCTION:
- You MUST base your environmental description on the data above.
- Do NOT hallucinate mountains or oceans if they are not listed in the Surroundings or Horizon.
- If a direction is missing, it means there is nothing notable generated there yet (fog of war). Describe it as "shrouded in mist" or "obscured".
- You can NAME a location (e.g., "The Whispering Woods") if the player passes a passive Lore check (History/Nature/Religion) or if an NPC reveals it.
- To name a hex, use the \`engine_call\`: \`NAME_HEX\`. 
  Format: \`{ "action": "NAME_HEX", "hex_id": "0,1", "name": "The Dragon's Teeth", "source": "lore_check", "skill": "History" }\`
  (Note: You don't have hex IDs here, so for now just describe it. The system will support ID-based naming in the next update. For now, rely on your description matches.)
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
## OUTPUT FORMAT (STRICT JSON)
You MUST respond with ONLY valid JSON in this EXACT format:
{
  "narrative_output": "Your narrative text goes here. Describe the scene, respond to the player's action, and advance the story.",
  "engine_calls": [],
  "world_updates": {
    "hex_discovery": null,
    "poi_unlocked": null
  }
}

RULES:
- "narrative_output" is REQUIRED and must be a string with your narrative.
- "engine_calls" should be an empty array [] unless you need to trigger game mechanics.
- Do NOT include any text outside the JSON object.
- Do NOT wrap the JSON in markdown code blocks.
`;

        return prompt;
    }

    private static extractJson(text: string): string {
        // Try to find JSON object in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : text;
    }
}
