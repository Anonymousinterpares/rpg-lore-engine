import { z } from 'zod';

export const HexDirectionSchema = z.enum(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
export type HexDirection = z.infer<typeof HexDirectionSchema>;

export const PointOfInterestSchema = z.object({
    id: z.string(),
    name: z.string(),
    discovered: z.boolean().default(false),
    description: z.string().optional(),
    subLocationId: z.string().optional() // Links to a SubLocation if it has an interior
});

export const HexSchema = z.object({
    coordinates: z.tuple([z.number(), z.number()]),
    generated: z.boolean().default(false),
    biome: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    traversable_sides: z.record(HexDirectionSchema, z.boolean()).optional(),
    interest_points: z.array(PointOfInterestSchema).default([]),
    visited: z.boolean().default(false)
});

export type Hex = z.infer<typeof HexSchema>;

export const MapRegistrySchema = z.object({
    grid_id: z.string(),
    hexes: z.record(z.string(), HexSchema)
});

export type MapRegistry = z.infer<typeof MapRegistrySchema>;
