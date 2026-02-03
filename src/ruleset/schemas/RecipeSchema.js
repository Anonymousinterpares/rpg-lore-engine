import { z } from 'zod';
import { SkillNameSchema } from './BaseSchemas';
export const RecipeSchema = z.object({
    id: z.string(),
    name: z.string(),
    resultItemId: z.string(),
    ingredients: z.array(z.object({
        itemId: z.string(),
        quantity: z.number()
    })),
    toolRequired: z.string(),
    skillCheck: z.object({
        skill: SkillNameSchema,
        dc: z.number()
    }).optional(),
    timeDays: z.number().default(1),
    description: z.string().optional()
});
