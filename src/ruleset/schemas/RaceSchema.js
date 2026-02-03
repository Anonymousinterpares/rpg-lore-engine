import { z } from 'zod';
import { AbilityScoreSchema, SizeSchema } from './BaseSchemas';
export const RaceTraitSchema = z.object({
    name: z.string(),
    description: z.string().default('Trait description pending.')
});
export const RaceSchema = z.object({
    name: z.string(),
    optional: z.boolean().default(false), // e.g., for Dragonborn
    abilityScoreIncreases: z.record(AbilityScoreSchema, z.number()).default({}),
    speed: z.number(),
    size: SizeSchema,
    darkvision: z.number().default(0), // Distance in feet
    traits: z.array(RaceTraitSchema).default([]),
    languages: z.array(z.string()).default(['Common'])
});
