import { z } from 'zod';
/**
 * Common interface for anything that can participate in combat.
 * This bridges the gap between Monster data and Player Character data.
 */
export const CombatantStateSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.object({
        current: z.number(),
        max: z.number(),
        temp: z.number().default(0)
    }),
    ac: z.number(),
    initiative: z.number().default(0),
    dexterityScore: z.number(),
    conditions: z.array(z.string()).default([]),
    isPlayer: z.boolean(),
    resources: z.object({
        actionSpent: z.boolean().default(false),
        bonusActionSpent: z.boolean().default(false),
        reactionSpent: z.boolean().default(false)
    }).default({}),
    tactical: z.object({
        cover: z.enum(['None', 'Half', 'Three-Quarters', 'Full']).default('None'),
        reach: z.number().default(5),
        isRanged: z.boolean().default(false),
        isGrappledBy: z.string().optional(), // ID of grappler
        isGrappling: z.string().optional() // ID of target
    }).default({}),
    spellSlots: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number()
    })).optional(),
    preparedSpells: z.array(z.string()).default([]),
    concentration: z.object({
        spellName: z.string(),
        startTurn: z.number()
    }).optional()
});
