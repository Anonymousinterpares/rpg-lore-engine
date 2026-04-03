import { GameState } from '../schemas/FullSaveStateSchema';
import { HexMapManager } from '../combat/HexMapManager';
import { ContextBuilder } from './ContextBuilder';
import { LLMClient } from '../combat/LLMClient';
import { AgentManager } from './AgentManager';
import { NarratorOutputSchema, NarratorOutput } from './ICPSchemas';
import { AgentProfile } from '../schemas/AgentConfigSchema';
import { LLM_PROVIDERS } from '../data/StaticData';
import { WorldClockEngine } from '../combat/WorldClockEngine';
import { Encounter } from '../combat/EncounterDirector';

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
                console.warn('[NarratorService] JSON parse error:', jsonError);
                // Attempt to salvage narrative_output from malformed JSON via regex
                const narrativeMatch = cleanJson.match(/"narrative_output"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (narrativeMatch) {
                    console.log('[NarratorService] Salvaged narrative from malformed JSON');
                    return {
                        narrative_output: narrativeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                        engine_calls: [],
                        world_updates: { hex_discovery: null, poi_unlocked: null }
                    };
                }
                // Last resort: use the raw text as narrative
                const rawText = cleanJson.replace(/[{}"\[\]]/g, '').replace(/narrative_output\s*:/i, '').trim();
                if (rawText.length > 20) {
                    console.log('[NarratorService] Using raw text as fallback narrative');
                    return {
                        narrative_output: rawText.substring(0, 2000),
                        engine_calls: [],
                        world_updates: { hex_discovery: null, poi_unlocked: null }
                    };
                }
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
                    maxTokens: 1200,
                    responseFormat: 'text'
                }
            );

            return this.extractJson(rawResponse).replace(/\{[\s\S]*\}/, '').trim() || rawResponse.trim();
        } catch (e) {
            console.error('[NarratorService] Combat summary failed:', e);
            return "The dust settles, and the battle is won.";
        }
    }

    /**
     * Generates atmospheric narration for a completed rest or wait period.
     */
    public static async narrateRestCompletion(
        state: GameState,
        durationMinutes: number,
        type: 'rest' | 'wait',
        mechanicalMessage: string
    ): Promise<string> {
        const profile = AgentManager.getAgentProfile('NARRATOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) return mechanicalMessage;

        const timePhase = WorldClockEngine.getTimePhase(state.worldTime);
        const hour = state.worldTime.hour;
        const weather = state.weather?.type || 'Clear';
        const currentHex = state.worldMap?.hexes?.[state.location.hexId];
        const biome = currentHex?.biome || 'Unknown';
        const durationHours = Math.floor(durationMinutes / 60);
        const durationMins = durationMinutes % 60;
        const durationStr = durationHours > 0
            ? `${durationHours} hour${durationHours > 1 ? 's' : ''}${durationMins > 0 ? ` and ${durationMins} minutes` : ''}`
            : `${durationMins} minutes`;

        const systemPrompt = `You are a legendary bard and chronicler for a D&D 5e adventure.
Write a short atmospheric narration (2-4 sentences) describing how time passed during a ${type === 'rest' ? 'rest' : 'waiting period'}.

## CONTEXT
- Duration: ${durationStr}
- Current time AFTER ${type}: ${timePhase} (${hour}:00)
- Weather: ${weather}
- Biome: ${biome}
- Type: ${type === 'rest' ? 'The character rested and recovered' : 'The character waited, staying alert'}

## RULES
- Describe the passage of time atmospherically (dawn breaking, stars wheeling, fire dying to embers, etc.)
- Match the time of day AFTER the ${type} — if it is now morning, describe dawn arriving
- Match the weather and biome
- Keep it under 60 words
- Do NOT mention specific HP, spell slots, or mechanical values
- End with a sense of readiness to continue`;

        try {
            const rawResponse = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: `Describe how the ${type} of ${durationStr} passed.`,
                    temperature: 0.7,
                    maxTokens: 800,
                    responseFormat: 'text'
                }
            );

            const narrative = rawResponse.trim();
            return `${narrative}\n\n${mechanicalMessage}`;
        } catch (e) {
            console.error('[NarratorService] Rest narration failed:', e);
            return mechanicalMessage;
        }
    }

    /**
     * Generates a narrative describing an ambush interrupting rest.
     */
    public static async narrateAmbush(
        state: GameState,
        encounter: Encounter,
        restType: 'rest' | 'wait'
    ): Promise<string> {
        const profile = AgentManager.getAgentProfile('NARRATOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) {
            return `Your ${restType} is interrupted! ${encounter.monsters.join(', ')} attack!`;
        }

        const timePhase = WorldClockEngine.getTimePhase(state.worldTime);
        const weather = state.weather?.type || 'Clear';
        const currentHex = state.worldMap?.hexes?.[state.location.hexId];
        const biome = currentHex?.biome || 'Unknown';
        const playerName = state.character?.name || 'the adventurer';
        const companions = (state.companions || []).map((m: any) => m.name);
        const partyDesc = companions.length > 0
            ? `${playerName} and ${companions.length === 1 ? companions[0] : 'their companions'}`
            : playerName;

        const systemPrompt = `You are a legendary bard and chronicler for a D&D 5e adventure.
Write a tense, dramatic narration (3-5 sentences) describing an ambush that interrupts ${partyDesc}'s ${restType}.

## CONTEXT
- Time: ${timePhase}
- Weather: ${weather}
- Biome: ${biome}
- ${restType === 'rest' ? 'The party was resting (sleeping/recovering)' : 'The party was waiting (alert but stationary)'}
- Attackers: ${encounter.monsters.join(', ')}

## RULES
- Build tension: subtle warning signs, then sudden danger
- Name the EXACT creatures listed above — do not invent others
- If resting, describe being jolted awake; if waiting, describe noticing the threat
- End on a cliffhanger — combat is about to begin
- Keep it under 80 words
- Do NOT describe combat actions or outcomes`;

        try {
            const rawResponse = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: `Describe the ambush by ${encounter.monsters.join(' and ')}.`,
                    temperature: 0.8,
                    maxTokens: 800,
                    responseFormat: 'text'
                }
            );
            return rawResponse.trim();
        } catch (e) {
            console.error('[NarratorService] Ambush narration failed:', e);
            return `Your ${restType} is interrupted! ${encounter.monsters.join(', ')} attack!`;
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

        // Add party/companion info if present
        if (context.party && context.party.length > 0) {
            prompt += `## TRAVELING COMPANIONS
${context.party.map((c: any) => `- ${c.name} (${c.role}, Level ${c.level} ${c.class}, ${c.hpStatus}) — Traits: ${c.traits}`).join('\n')}
These companions travel with the player. Reference them naturally in narrative — they react, comment, assist.
You may use engine_call "recruit_companion" or "dismiss_companion" if the narrative warrants it.

`;
        }

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

        prompt += `
## PLAYER ACTION GUIDANCE
ONLY add a guidance hint when the player EXPLICITLY expresses one of the intents below.
Do NOT add hints proactively or when the intent is ambiguous. When in doubt, omit the hint.

When the player EXPLICITLY wants to rest, camp, sleep, make camp, set up for the night, or recover:
1. Respond with ONLY a brief acknowledgment (one short sentence, e.g. "You look for a suitable place to settle down.").
2. Then add this EXACT line on its own paragraph:
   "[You can use the Rest button to rest and recover.]"
3. Do NOT narrate camp scenes, building fires, night falling, or any atmospheric rest description.
4. Do NOT claim the character has rested, recovered HP, or restored spell slots.
   The rest narration will be generated AFTER the player actually rests.

When the player EXPLICITLY asks to trade, shop, buy, or sell items:
- End with: "[Use the Trade button or approach a merchant to open the trading interface.]"

When the player EXPLICITLY asks to talk to, speak with, or converse with a specific NPC:
- End with: "[Click on an NPC or use the Talk button to start a conversation.]"

When the player EXPLICITLY asks to check, open, or manage their inventory or equipment:
- End with: "[Open the Inventory panel to manage your items and equipment.]"
`;

        if (context.hex && context.hex.neighbors && context.hex.neighbors.length > 0) {
            const visible = context.hex.neighbors.filter((n: any) => n.distance === 1);
            const horizon = context.hex.neighbors.filter((n: any) => n.distance === 2);

            prompt += `
## SURROUNDINGS
Immediate Vicinity (Visible):
${visible.map((n: any) => `- ${n.direction}: ${n.biome} ${n.name ? `(${n.name})` : ''}`).join('\n')}

On the Horizon (Distant):
${horizon.map((n: any) => `- ${n.direction}: ${n.biome} ${n.name ? `(${n.name})` : ''}`).join('\n')}

## LOCAL INHABITANTS
The following people are visible in this area:
${(context.hex.inhabitants || []).map((npc: string) => `- ${npc}`).join('\n') || 'None visible.'}

CRITICAL INSTRUCTION:
- You MUST base your environmental description on the data above.
- Do NOT hallucinate mountains or oceans if they are not listed in the Surroundings or Horizon.
- If specific inhabitants are listed, you MUST mention them in the scene (e.g., "A Harper Scout watches you from the trees"). 
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

    /**
     * Generates a narrative summary of the current session for save metadata.
     */
    public static async generateSaveSummary(state: GameState): Promise<string> {
        const profile = AgentManager.getAgentProfile('NARRATOR');
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) return "The adventure continues...";

        // Context gathering
        const recentHistory = (state.conversationHistory || []).slice(-5).map(h => `${h.role}: ${h.content}`).join('\n');
        const storySummary = state.storySummary || 'The journey has just begun.';
        let lastEvent = state.lastNarrative || 'Standing ready.';

        let combatContext = "";
        if (state.mode === 'COMBAT' && state.combat) {
            lastEvent = "Engaged in combat!";
            const recentLogs = (state.combat.logs || []).slice(-10).map(l => l.message).join('\n');
            combatContext = `\n## COMBAT STATUS (CURRENTLY FIGHTING)\nRound: ${state.combat.round}\nRecent Combat Actions:\n${recentLogs}`;
        }

        const systemPrompt = `You are a legendary bard. 
Summarize the current state and recent events of the adventure in 2-3 evocative sentences. 
This summary will be used by the player to identify their save game. 
Focus on the location, the player's current goal, and the most recent achievement or dilemma.
Keep it strictly under 50 words.

## STORY SO FAR
${storySummary}

## RECENT HISTORY
${recentHistory}${combatContext}

## LATEST EVENT
${lastEvent}`;

        try {
            const rawResponse = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: "Write a short summary for this save game.",
                    temperature: 0.7,
                    maxTokens: 800,
                    responseFormat: 'text'
                }
            );

            // Clean the response (strip markdown wrappers)
            let finalSummary = rawResponse.replace(/```json/i, '').replace(/```/g, '').trim();
            // If the LLM still tries to wrap it in a JSON block despite responseFormat: 'text'
            if (finalSummary.startsWith('{') && finalSummary.endsWith('}')) {
                try {
                    const parsed = JSON.parse(finalSummary);
                    if (parsed.narrative_output) {
                        finalSummary = parsed.narrative_output.trim();
                    } else if (parsed.summary) {
                        finalSummary = parsed.summary.trim();
                    }
                } catch (e) {
                    // Ignore JSON parse errors and just use the raw text if it wasn't actually JSON
                }
            }
            return finalSummary || "The adventure continues at " + state.location.hexId;
        } catch (e: any) {
            console.error('[NarratorService] Save summary failed:', e);
            return `[Summarize Error] ${e.message} (Location: ${state.location.hexId})`;
        }
    }

    private static extractJson(text: string): string {
        // Try to find JSON object in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : text;
    }
}
