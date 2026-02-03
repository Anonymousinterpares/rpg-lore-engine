import { z } from 'zod';
import { AbilityScoreSchema, SkillNameSchema, CurrencySchema } from './BaseSchemas';
export const EquipmentSlotsSchema = z.object({
    head: z.string().optional(),
    armor: z.string().optional(),
    cloak: z.string().optional(),
    hands: z.string().optional(),
    ring1: z.string().optional(),
    ring2: z.string().optional(),
    feet: z.string().optional(),
    mainHand: z.string().optional(),
    offHand: z.string().optional(),
    ammunition: z.string().optional()
}).default({});
export const DeathSavesSchema = z.object({
    successes: z.number().default(0),
    failures: z.number().default(0)
}).default({});
export const PlayerCharacterSchema = z.object({
    name: z.string(),
    level: z.number().min(1).max(20),
    race: z.string(),
    class: z.string(),
    conditions: z.array(z.string()).default([]),
    stats: z.record(AbilityScoreSchema, z.number()),
    savingThrowProficiencies: z.array(AbilityScoreSchema).default([]),
    skillProficiencies: z.array(SkillNameSchema).default([]),
    hp: z.object({
        current: z.number(),
        max: z.number(),
        temp: z.number().default(0)
    }),
    deathSaves: DeathSavesSchema,
    hitDice: z.object({
        current: z.number(),
        max: z.number(),
        dieType: z.string() // e.g., "1d8"
    }),
    spellSlots: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number()
    })).default({}),
    cantripsKnown: z.array(z.string()).default([]),
    knownSpells: z.array(z.string()).default([]),
    preparedSpells: z.array(z.string()).default([]),
    spellbook: z.array(z.string()).default([]),
    ac: z.number(),
    inventory: z.object({
        gold: CurrencySchema.default({}),
        items: z.array(z.object({
            id: z.string(),
            name: z.string(),
            weight: z.number(),
            quantity: z.number().default(1),
            equipped: z.boolean().default(false)
        })).default([])
    }).default({}),
    equipmentSlots: EquipmentSlotsSchema,
    attunedItems: z.array(z.string()).default([]),
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
