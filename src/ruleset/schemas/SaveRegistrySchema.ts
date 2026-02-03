import { z } from 'zod';

export const SaveSlotMetadataSchema = z.object({
    id: z.string(),
    slotName: z.string(),
    characterName: z.string(),
    characterLevel: z.number(),
    characterClass: z.string(),
    lastSaved: z.string(), // ISO Timestamp
    playTimeSeconds: z.number(),
    locationSummary: z.string(),
    thumbnail: z.string().optional()
});

export const SaveRegistrySchema = z.object({
    slots: z.array(SaveSlotMetadataSchema).default([])
});

export type SaveSlotMetadata = z.infer<typeof SaveSlotMetadataSchema>;
export type SaveRegistry = z.infer<typeof SaveRegistrySchema>;
