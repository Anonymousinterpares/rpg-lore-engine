import { z } from 'zod';
import { AbilityScoreSchema, DamageTypeSchema, DiceRollSchema } from './BaseSchemas';

export const DispositionSchema = z.enum(['Friendly', 'Neutral', 'Hostile']);
export type Disposition = z.infer<typeof DispositionSchema>;

export const WorldNPCSchema = z.object({
    id: z.string(),
    name: z.string(),
    disposition: DispositionSchema.default('Neutral'),
    dialogue_triggers: z.array(z.string()).default([]),
    factionId: z.string().optional(),
    inventory: z.array(z.object({
        id: z.string(),
        quantity: z.number().default(1)
    })).default([]),
    stats: z.record(AbilityScoreSchema, z.number()).optional(),
    description: z.string().optional()
});

export type WorldNPC = z.infer<typeof WorldNPCSchema>;

export const HazardSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['Lava', 'Cold', 'Falling', 'Trap', 'Poison', 'Other']),
    damage: DiceRollSchema.optional(),
    damageType: DamageTypeSchema.optional(),
    saveDC: z.number().optional(),
    saveAbility: AbilityScoreSchema.optional(),
    description: z.string().optional()
});

export type Hazard = z.infer<typeof HazardSchema>;

export const RoomSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    exits: z.record(z.string(), z.string()), // Direction -> RoomId
    npcs: z.array(z.string()).default([]), // NPC IDs
    hazards: z.array(HazardSchema).default([]),
    items: z.array(z.object({
        id: z.string(),
        quantity: z.number().default(1)
    })).default([])
});

export type Room = z.infer<typeof RoomSchema>;

export const SubLocationSchema = z.object({
    id: z.string(),
    parentHexId: z.string(),
    parentPoiId: z.string(),
    name: z.string(),
    type: z.enum(['Dungeon', 'Building', 'Cave', 'City_District', 'Other']),
    rooms: z.record(z.string(), RoomSchema),
    initialRoomId: z.string()
});

export type SubLocation = z.infer<typeof SubLocationSchema>;
