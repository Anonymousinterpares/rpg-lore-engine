import { z } from 'zod';

export const CampaignSettingsSchema = z.object({
    // --- Existing legacy fields for compatibility if any ---
    permadeath: z.boolean().default(false),
    variantEncumbrance: z.boolean().default(false),
    milestoneLeveling: z.boolean().default(false),
    criticalFumbleEffects: z.boolean().default(false),
    difficultyModifier: z.number().default(1.0),
    inspirationEnabled: z.boolean().default(true),
    multiclassingAllowed: z.boolean().default(true),
    maxConversationHistoryTurns: z.number().default(50),

    // --- Structured sections matching UI ---
    video: z.object({
        fullscreen: z.boolean().default(false),
        vsync: z.boolean().default(true),
        resolutionScale: z.number().default(1.0)
    }).default({}),
    audio: z.object({
        master: z.number().default(0.8),
        music: z.number().default(0.5)
    }).default({}),
    gameplay: z.object({
        difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
        tutorials: z.boolean().default(true),
        autosave: z.boolean().default(false),
        developerMode: z.boolean().default(false)
    }).default({}),
    ai: z.object({
        selectedModels: z.record(z.string(), z.string()).optional()
    }).default({})
});

export type CampaignSettings = z.infer<typeof CampaignSettingsSchema>;
