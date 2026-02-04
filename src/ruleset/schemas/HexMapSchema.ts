import { z } from 'zod';
import { BiomeTypeSchema } from './BiomeSchema';
import { SkillNameSchema } from './BaseSchemas';

export const HexDirectionSchema = z.enum(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
export type HexDirection = z.infer<typeof HexDirectionSchema>;

export const ResourceNodeSchema = z.object({
    id: z.string(),
    resourceType: z.enum(['Ore', 'Herb', 'Wood', 'Hide', 'Gem', 'Arcane']),
    itemId: z.string(),
    quantityRemaining: z.number(),
    depletedAt: z.string().optional(), // ISO string from WorldClock
    respawnDays: z.number().default(3),
    skillCheck: z.object({
        skill: SkillNameSchema,
        dc: z.number()
    }).optional()
});

export type ResourceNode = z.infer<typeof ResourceNodeSchema>;

export const PointOfInterestSchema = z.object({
    id: z.string(),
    name: z.string(),
    discovered: z.boolean().default(false),
    description: z.string().optional(),
    subLocationId: z.string().optional()
});

export const HexSchema = z.object({
    coordinates: z.tuple([z.number(), z.number()]),
    generated: z.boolean().default(false),
    biome: BiomeTypeSchema.default('Plains'),
    name: z.string().optional(),
    description: z.string().optional(),
    traversable_sides: z.record(HexDirectionSchema, z.boolean()).optional(),
    interest_points: z.array(PointOfInterestSchema).default([]),
    resourceNodes: z.array(ResourceNodeSchema).default([]),
    openedContainers: z.record(z.string(), z.array(z.object({
        itemId: z.string(),
        quantity: z.number()
    }))).default({}),
    visited: z.boolean().default(false),
    playerName: z.string().optional(),
    namingSource: z.enum(['engine', 'llm', 'player']).default('engine'),
    visualVariant: z.number().int().min(1).max(5).default(1)
});

export type Hex = z.infer<typeof HexSchema>;

export const MapRegistrySchema = z.object({
    grid_id: z.string(),
    hexes: z.record(z.string(), HexSchema)
});

export type MapRegistry = z.infer<typeof MapRegistrySchema>;
