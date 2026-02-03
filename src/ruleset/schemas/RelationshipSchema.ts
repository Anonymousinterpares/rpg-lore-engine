import { z } from 'zod';

export const RelationshipEventSchema = z.object({
    event: z.string(),
    delta: z.number(),
    timestamp: z.string()
});

export const RelationshipStateSchema = z.object({
    standing: z.number().min(-100).max(100).default(0),
    lastInteraction: z.string().optional(),
    interactionLog: z.array(RelationshipEventSchema).default([])
});

export type RelationshipState = z.infer<typeof RelationshipStateSchema>;
export type RelationshipEvent = z.infer<typeof RelationshipEventSchema>;
