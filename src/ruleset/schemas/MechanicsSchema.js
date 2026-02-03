import { z } from 'zod';
export const XPTableSchema = z.record(z.string(), z.number()); // Level -> Total XP
export const RestingRulesSchema = z.object({
    shortRest: z.object({
        duration: z.string(),
        benefits: z.array(z.string())
    }),
    longRest: z.object({
        duration: z.string(),
        benefits: z.array(z.string())
    })
});
export const MechanicsSchema = z.object({
    xpTable: XPTableSchema,
    resting: RestingRulesSchema,
    currencyConversion: z.record(z.string(), z.number()) // e.g., "pp": 10 (gp)
});
