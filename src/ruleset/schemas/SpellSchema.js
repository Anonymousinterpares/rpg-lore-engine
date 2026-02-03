import { z } from 'zod';
import { DamageTypeSchema, DiceRollSchema, ScalingSchema } from './BaseSchemas';
export const SpellSchoolSchema = z.enum([
    'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
    'Evocation', 'Illusion', 'Necromancy', 'Transmutation'
]);
export const SpellComponentSchema = z.object({
    v: z.boolean().default(false),
    s: z.boolean().default(false),
    m: z.string().optional(),
    consume: z.boolean().default(false),
    cost: z.number().optional() // Cost in GP
});
export const SpellSchema = z.object({
    name: z.string(),
    level: z.number().min(0).max(9),
    school: SpellSchoolSchema,
    time: z.string(), // e.g., "1 Action", "1 Bonus Action"
    range: z.string(),
    components: SpellComponentSchema,
    duration: z.string(),
    concentration: z.boolean().default(false),
    description: z.string(),
    damage: z.object({
        dice: DiceRollSchema,
        type: DamageTypeSchema,
        scaling: ScalingSchema.optional()
    }).optional(),
    save: z.object({
        ability: z.string(),
        effect: z.string() // e.g., "half", "none"
    }).optional(),
    ritual: z.boolean().default(false),
    tags: z.array(z.string()).default([])
});
