import { z } from 'zod';
import { AbilityScoreSchema, DiceRollSchema } from '../schemas/BaseSchemas';

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
    }).default({})
});

export type CombatantState = z.infer<typeof CombatantStateSchema>;

export interface CombatAction {
    name: string;
    description: string;
    execute: (source: CombatantState, target: CombatantState) => string;
}
