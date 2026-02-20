import { z } from 'zod';
import { CurrencySchema } from './BaseSchemas';

export const QuestTypeSchema = z.enum(['KILL', 'FETCH', 'EXPLORE', 'DELIVER', 'INVESTIGATE', 'ESCORT']);

export const QuestObjectiveSchema = z.object({
    id: z.string(),
    description: z.string(),
    type: QuestTypeSchema.default('EXPLORE'),
    targetId: z.string().default('system'),
    targetCoords: z.tuple([z.number(), z.number()]).optional(),
    currentProgress: z.number().default(0),
    maxProgress: z.number().default(1),
    isCompleted: z.boolean().default(false),
    isHidden: z.boolean().default(false)
});

export const QuestSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    giverNpcId: z.string().optional(),
    turnAccepted: z.number().default(0), // Made default for existing saves compatibility
    deadlineTurn: z.number().optional(),
    status: z.enum(['AVAILABLE', 'ACTIVE', 'COMPLETED', 'FAILED']).default('ACTIVE'),
    objectives: z.array(QuestObjectiveSchema),
    rewards: z.object({
        xp: z.number().default(0),
        gold: CurrencySchema.optional(),
        items: z.array(z.string()).default([]),
        factionStanding: z.record(z.string(), z.number()).optional()
    }).default({}),
    dialogueHooks: z.object({
        turnIn: z.string().optional(),
        failure: z.string().optional()
    }).optional(),
    isNew: z.boolean().default(true)
});

export type Quest = z.infer<typeof QuestSchema>;
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;
