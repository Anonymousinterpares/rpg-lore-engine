import { z } from 'zod';

/**
 * The Internal Communication Protocol (ICP) defines how LLMs talk to the Engine.
 */

export const EngineCallSchema = z.object({
    function: z.enum([
        'add_xp',
        'set_condition',
        'add_item',
        'trigger_trap',
        'modify_hp',
        'level_up',
        'start_combat',
        'end_combat',
        'skill_check',
        'saving_throw',
        'remove_item',
        'modify_gold',
        'discover_poi',
        'update_quest',
        'set_faction_standing',
        'advance_time',
        'spawn_npc',
        'set_npc_disposition'
    ]),
    args: z.record(z.any())
});

export const NarratorOutputSchema = z.object({
    narrative_output: z.string(),
    engine_calls: z.array(EngineCallSchema).default([]),
    world_updates: z.object({
        hex_discovery: z.string().nullable().default(null),
        poi_unlocked: z.string().nullable().default(null)
    }).default({})
});

export type NarratorOutput = z.infer<typeof NarratorOutputSchema>;

/**
 * Director Directive: System-level prompts to guide the Narrator.
 */
export const DirectorDirectiveSchema = z.object({
    type: z.enum(['XP_GAIN', 'ITEM_EVAL', 'PACING_EVENT', 'SURPRISE_CHECK']),
    directive: z.string(),
    data: z.record(z.any()).optional()
});

export type DirectorDirective = z.infer<typeof DirectorDirectiveSchema>;
