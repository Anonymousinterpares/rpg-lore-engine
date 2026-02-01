import { z } from 'zod';
import { AbilityScoreSchema, DiceRollSchema, SizeSchema } from './BaseSchemas';

export const MonsterActionSchema = z.object({
    name: z.string(),
    description: z.string(),
    attackBonus: z.number().optional(),
    damage: DiceRollSchema.optional(),
    recharge: z.string().optional() // e.g., "Recharge 5-6"
});

export const MonsterSchema = z.object({
    name: z.string(),
    cr: z.union([z.string(), z.number()]), // e.g., "1/4" or 5
    size: SizeSchema,
    type: z.string(), // e.g., "Undead", "Humanoid"
    alignment: z.string(),
    ac: z.number(),
    armorType: z.string().optional(),
    hp: z.object({
        average: z.number(),
        formula: DiceRollSchema
    }),
    speed: z.string(),
    stats: z.record(AbilityScoreSchema, z.number()),
    saves: z.record(AbilityScoreSchema, z.number()).optional(),
    skills: z.record(z.string(), z.number()).optional(),
    resistances: z.array(z.string()).optional(),
    immunities: z.array(z.string()).optional(),
    vulnerabilities: z.array(z.string()).optional(),
    traits: z.array(z.object({
        name: z.string(),
        description: z.string()
    })).default([]),
    actions: z.array(MonsterActionSchema).default([]),
    legendaryActions: z.array(MonsterActionSchema).optional()
});

export type Monster = z.infer<typeof MonsterSchema>;
