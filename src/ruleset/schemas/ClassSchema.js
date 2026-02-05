import { z } from 'zod';
import { AbilityScoreSchema, DiceRollSchema } from './BaseSchemas';
export const ClassFeatureSchema = z.object({
    level: z.number(),
    name: z.string(),
    description: z.string(),
    grantsSpell: z.string().optional(), // Cross-reference to Spell data
    actionCost: z.enum(['NONE', 'ACTION', 'BONUS_ACTION', 'REACTION']).default('NONE'),
    usage: z.object({
        type: z.enum(['PASSIVE', 'SHORT_REST', 'LONG_REST', 'PER_ROUND']),
        limit: z.number().optional()
    }).optional()
});
export const ClassProgressionSchema = z.object({
    level: z.number(),
    proficiencyBonus: z.number(),
    features: z.array(z.string()),
    spellSlots: z.array(z.number()).length(9).optional() // 1st to 9th level slots
});
export const ClassSchema = z.object({
    name: z.string(),
    hitDie: DiceRollSchema,
    primaryAbility: z.array(AbilityScoreSchema),
    savingThrowProficiencies: z.array(AbilityScoreSchema),
    armorProficiencies: z.array(z.string()),
    weaponProficiencies: z.array(z.string()),
    toolProficiencies: z.array(z.string()).optional(),
    skillChoices: z.object({
        count: z.number(),
        options: z.array(z.string())
    }),
    progression: z.array(ClassProgressionSchema).default([]),
    allFeatures: z.array(ClassFeatureSchema).default([]),
    subclasses: z.array(z.object({
        name: z.string(),
        features: z.array(ClassFeatureSchema)
    })).default([])
});
