import { z } from 'zod';
import { AbilityScoreSchema, SkillNameSchema, CurrencySchema } from './BaseSchemas';
import { CombatConditionSchema } from './CombatSchema';

export const EquipmentSlotsSchema = z.object({
    head: z.string().optional(),
    neck: z.string().optional(),
    shoulders: z.string().optional(),
    armor: z.string().optional(),
    cloak: z.string().optional(),
    belt: z.string().optional(),
    bracers: z.string().optional(),
    gloves: z.string().optional(),
    legs: z.string().optional(),
    feet: z.string().optional(),
    mainHand: z.string().optional(),
    offHand: z.string().optional(),
    ammunition: z.string().optional(),
    leftRing1: z.string().optional(),
    leftRing2: z.string().optional(),
    leftRing3: z.string().optional(),
    leftRing4: z.string().optional(),
    leftRing5: z.string().optional(),
    rightRing1: z.string().optional(),
    rightRing2: z.string().optional(),
    rightRing3: z.string().optional(),
    rightRing4: z.string().optional(),
    rightRing5: z.string().optional(),
}).default({});

export const DeathSavesSchema = z.object({
    successes: z.number().default(0),
    failures: z.number().default(0)
}).default({});

export const PlayerCharacterSchema = z.object({
    name: z.string(),
    sex: z.enum(['male', 'female']).default('male'),
    level: z.number().min(1).max(20),
    race: z.string(),
    darkvision: z.number().default(0), // Range in feet (0 = none, 60 = standard)
    class: z.string(), // Primary class
    secondaryClass: z.string().optional(), // Multiclass (max 2)
    multiclassLevels: z.record(z.string(), z.number()).default({}), // { "Fighter": 5, "Rogue": 3 }
    conditions: z.array(CombatConditionSchema).default([]),
    stats: z.record(AbilityScoreSchema, z.number()),
    savingThrowProficiencies: z.array(AbilityScoreSchema).default([]),
    skillProficiencies: z.array(SkillNameSchema).default([]), // Legacy — kept for migration; new code uses `skills`
    skills: z.record(SkillNameSchema, z.object({
        tier: z.number().min(0).max(4).default(0),
        baseTier: z.number().min(0).max(4).default(0), // Tier granted at creation (preserved on reset)
        pointsInvested: z.number().default(0),
        chosenAbility: z.object({
            tier3: z.enum(['passive', 'active']).optional(),
            tier4: z.enum(['passive', 'active']).optional(),
        }).default({})
    })).default({}),
    skillPoints: z.object({
        available: z.number().default(0),
        totalEarned: z.number().default(0),
    }).default({}),
    weaponProficiencies: z.array(z.string()).default([]), // e.g. "Simple Weapons", "Longsword"
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
    unseenSpells: z.array(z.string()).default([]),
    ac: z.number(),
    featureUsages: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number(),
        usageType: z.enum(['SHORT_REST', 'LONG_REST', 'PER_ROUND'])
    })).default({}),
    inventory: z.object({
        gold: CurrencySchema.default({}),
        items: z.array(z.object({
            id: z.string().optional().default(() => `item_${Math.random().toString(36).substr(2, 9)}`),
            instanceId: z.string().optional(), // Made optional for literal compatibility
            name: z.string(),
            type: z.string().optional().default('Misc'),
            weight: z.number(),
            quantity: z.number().default(1),
            charges: z.number().optional(),
            equipped: z.boolean().default(false)
        }).passthrough()).default([])
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
    }).default({}),
    knownEntities: z.object({
        monsters: z.array(z.string()).default([]),
        items: z.array(z.string()).default([])
    }).default({})
});

export type PlayerCharacter = z.infer<typeof PlayerCharacterSchema>;
