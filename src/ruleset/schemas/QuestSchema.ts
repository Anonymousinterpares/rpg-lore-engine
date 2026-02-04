import { z } from 'zod';
import { CurrencySchema } from './BaseSchemas';

export const QuestObjectiveSchema = z.object({
    id: z.string(),
    description: z.string(),
    isCompleted: z.boolean().default(false),
    currentProgress: z.number().default(0),
    maxProgress: z.number().default(1)
});

export const QuestSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    objectives: z.array(QuestObjectiveSchema),
    status: z.enum(['ACTIVE', 'COMPLETED', 'FAILED']).default('ACTIVE'),
    rewards: z.object({
        xp: z.number().default(0),
        gold: CurrencySchema.optional(),
        items: z.array(z.string()).default([]) // Item IDs
    }).optional(),
    isNew: z.boolean().default(true)
});

export type Quest = z.infer<typeof QuestSchema>;
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;
