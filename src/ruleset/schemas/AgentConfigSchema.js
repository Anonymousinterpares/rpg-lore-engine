import { z } from 'zod';
export const AgentTypeSchema = z.enum([
    'NARRATOR',
    'DIRECTOR',
    'NPC_CONTROLLER',
    'LORE_KEEPER'
]);
export const AgentProfileSchema = z.object({
    id: AgentTypeSchema,
    name: z.string(),
    providerId: z.string(),
    modelId: z.string(),
    basePrompt: z.string().default(''),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(32000).default(1000)
});
export const SwarmConfigSchema = z.record(AgentTypeSchema, AgentProfileSchema);
