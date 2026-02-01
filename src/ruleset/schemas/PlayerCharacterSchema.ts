import { z } from 'zod';
import { AbilityScoreSchema } from './BaseSchemas';

export const PlayerCharacterSchema = z.object({
    name: z.string(),
    level: z.number().min(1).max(20),
    race: z.string(),
    class: z.string(),
    stats: z.record(AbilityScoreSchema, z.number()),
    hp: z.object({
        current: z.number(),
        max: z.number(),
        temp: z.number().default(0)
    }),
    ac: z.number(),
    equipment: z.array(z.string()).default([]),
    xp: z.number().default(0),
    inspiration: z.boolean().default(false)
});

export type PlayerCharacter = z.infer<typeof PlayerCharacterSchema>;
