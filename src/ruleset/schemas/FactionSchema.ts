import { z } from 'zod';

export const FactionStandingSchema = z.number().min(-100).max(100);

export const FactionSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    standing: FactionStandingSchema.default(0), // -100 (Hostile) to 100 (Exalted)
    isPlayerMember: z.boolean().default(false)
});

export type Faction = z.infer<typeof FactionSchema>;
