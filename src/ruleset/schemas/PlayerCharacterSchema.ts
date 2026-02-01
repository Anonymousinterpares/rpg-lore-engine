import { z } from 'zod';
import { AbilityScoreSchema, SkillNameSchema } from './BaseSchemas';

export const PlayerCharacterSchema = z.object({
    name: z.string(),
    level: z.number().min(1).max(20),
    race: z.string(),
    class: z.string(),
    stats: z.record(AbilityScoreSchema, z.number()),
    savingThrowProficiencies: z.array(AbilityScoreSchema).default([]),
    skillProficiencies: z.array(SkillNameSchema).default([]),
    hp: z.object({
        current: z.number(),
        max: z.number(),
        temp: z.number().default(0)
    }),
    hitDice: z.object({
        current: z.number(),
        max: z.number(),
        dieType: z.string() // e.g., "1d8"
    }),
    spellSlots: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number()
    })).default({}),
    ac: z.number(),
    inventory: z.object({
        gold: z.number().default(0),
        items: z.array(z.object({
            id: z.string(),
            name: z.string(),
            weight: z.number(),
            quantity: z.number().default(1),
            equipped: z.boolean().default(false)
        })).default([])
    }).default({}),
    xp: z.number().default(0),
    inspiration: z.boolean().default(false),
    biography: z.object({
        background: z.string().optional(),
        backgroundId: z.string().optional(),
        traits: z.array(z.string()).default([]),
        ideals: z.array(z.string()).default([]),
        bonds: z.array(z.string()).default([]),
        flaws: z.array(z.string()).default([]),
        chronicles: z.array(z.object({
            turn: z.number(),
            event: z.string()
        })).default([])
    }).default({})
});

export type PlayerCharacter = z.infer<typeof PlayerCharacterSchema>;
