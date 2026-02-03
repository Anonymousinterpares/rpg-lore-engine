import { z } from 'zod';
import { SkillNameSchema } from './BaseSchemas';
export const BackgroundSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    skillProficiencies: z.array(SkillNameSchema),
    toolProficiencies: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
    startingEquipment: z.array(z.object({
        id: z.string(),
        quantity: z.number().default(1)
    })).default([]),
    feature: z.object({
        name: z.string(),
        description: z.string()
    }),
    personalitySuggested: z.object({
        traits: z.array(z.string()),
        ideals: z.array(z.string()),
        bonds: z.array(z.string()),
        flaws: z.array(z.string())
    }).optional()
});
