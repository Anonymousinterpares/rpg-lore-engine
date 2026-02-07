import { z } from 'zod';
import { DamageTypeSchema, DiceRollSchema, ScalingSchema } from './BaseSchemas';

export const SpellSchoolSchema = z.enum([
    'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
    'Evocation', 'Illusion', 'Necromancy', 'Transmutation'
]);

export const SpellEffectCategorySchema = z.enum([
    'DAMAGE', 'HEAL', 'BUFF', 'DEBUFF', 'CONTROL', 'SUMMON', 'TRANSFORM', 'UTILITY', 'REACTION'
]);

export const SpellTimingSchema = z.enum([
    'INSTANT', 'DURATION', 'CONCENTRATION'
]);

export const SpellDurationUnitSchema = z.enum([
    'ROUND', 'MINUTE', 'HOUR', 'DAY', 'PERMANENT'
]);

export const SpellAreaShapeSchema = z.enum([
    'SELF', 'SINGLE', 'RADIUS', 'CONE', 'LINE', 'CUBE', 'CYLINDER'
]);

export const SpellTargetTypeSchema = z.enum([
    'CREATURE', 'OBJECT', 'POINT', 'ALLY', 'ENEMY'
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
    effect: z.object({
        category: SpellEffectCategorySchema,
        timing: SpellTimingSchema,
        duration: z.object({
            value: z.number(),
            unit: SpellDurationUnitSchema
        }).optional(),
        area: z.object({
            shape: SpellAreaShapeSchema,
            size: z.number().optional(),
            units: z.enum(['feet', 'miles']).optional()
        }).optional(),
        targets: z.object({
            type: SpellTargetTypeSchema,
            count: z.union([z.number(), z.literal('ALL_IN_AREA')]).default(1)
        }).optional()
    }).optional(),
    damage: z.object({
        dice: DiceRollSchema,
        type: DamageTypeSchema,
        scaling: ScalingSchema.optional()
    }).optional(),
    save: z.object({
        ability: z.string(),
        effect: z.string() // e.g., "half", "none"
    }).optional(),
    condition: z.string().optional(),
    summon: z.object({
        options: z.array(z.object({
            count: z.union([z.number(), z.string()]),
            maxCR: z.number(),
            type: z.string()
        }))
    }).optional(),
    ritual: z.boolean().default(false),
    classes: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([])
});

export type Spell = z.infer<typeof SpellSchema>;
