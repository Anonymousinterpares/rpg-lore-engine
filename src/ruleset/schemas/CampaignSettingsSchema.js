import { z } from 'zod';
export const CampaignSettingsSchema = z.object({
    permadeath: z.boolean().default(false),
    variantEncumbrance: z.boolean().default(false),
    milestoneLeveling: z.boolean().default(false),
    criticalFumbleEffects: z.boolean().default(false),
    difficultyModifier: z.number().default(1.0),
    inspirationEnabled: z.boolean().default(true),
    multiclassingAllowed: z.boolean().default(true),
    maxConversationHistoryTurns: z.number().default(50)
});
