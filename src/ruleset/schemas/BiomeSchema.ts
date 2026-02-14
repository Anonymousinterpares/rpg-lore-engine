import { z } from 'zod';

export const BiomeTypeSchema = z.enum([
    'Plains', 'Forest', 'Hills', 'Mountains', 'Swamp',
    'Desert', 'Tundra', 'Jungle', 'Coast', 'Ocean',
    'Volcanic', 'Ruins', 'Farmland', 'Urban',
    'Coast_Cold', 'Coast_Desert', 'Mountain_High'
]);

export type BiomeType = z.infer<typeof BiomeTypeSchema>;

export const BiomeDefinitionSchema = z.object({
    id: BiomeTypeSchema,
    displayName: z.string(),
    travelSpeedModifier: z.number().default(1.0),
    encounterRateModifier: z.number().default(1.0),
    baseAppearanceWeight: z.number(),
    adjacencyModifiers: z.record(BiomeTypeSchema, z.number()).default({}),
    maxClusterSize: z.number().default(10),
    clusterPenaltyMultiplier: z.number().default(0.2)
});

export type BiomeDefinition = z.infer<typeof BiomeDefinitionSchema>;
