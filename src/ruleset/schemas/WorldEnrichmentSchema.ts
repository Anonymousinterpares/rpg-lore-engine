import { z } from 'zod';
import { AbilityScoreSchema, DamageTypeSchema, DiceRollSchema } from './BaseSchemas';
import { RelationshipStateSchema } from './RelationshipSchema';

export const DispositionSchema = z.enum(['Friendly', 'Neutral', 'Hostile']);
export type Disposition = z.infer<typeof DispositionSchema>;

export const ShopStateSchema = z.object({
    inventory: z.array(z.string()).default([]), // Item IDs
    soldByPlayer: z.array(z.object({      // NEW: tracks player-sold items
        itemId: z.string(),
        originalSellPrice: z.number(),     // copper value paid to player
        buybackEligible: z.boolean().default(true) // cleared on hex change / NPC move
    })).default([]),
    lastHaggleFailure: z.record(z.string(), z.number()).default({}), // itemId -> turnNumber
    markup: z.number().default(1.0),
    discount: z.number().default(0.0),
    isOpen: z.boolean().default(true),
    gold: z.number().default(50)           // Merchant's gold in GP
});

export type ShopState = z.infer<typeof ShopStateSchema>;

export const NPCMovementTypeSchema = z.enum([
    'STATIONARY',   // Never moves (e.g., Shopkeepers, Guards)
    'TRADE_ROUTE',  // Follows Roads/Paths between Urban centers
    'PATROL',       // Moves within N hexes of an anchor point
    'WANDER',       // Random movement within biome constraints
    'HOSTILE'       // Stalks roads or specific criteria
]);

export type NPCMovementType = z.infer<typeof NPCMovementTypeSchema>;

export const NPCMovementBehaviorSchema = z.object({
    type: NPCMovementTypeSchema,
    interval: z.number().default(24),       // Turns between moves (12 = 12h, 24 = 24h)
    lastMoveTurn: z.number().default(0),    // Timestamp of last move
    anchorHex: z.string().optional(),       // Hex ID center for PATROL
    patrolRadius: z.number().default(3),    // Max distance from anchor
    routeIndex: z.number().default(0),      // For fixed paths (Trade Route)
    routeDirection: z.number().default(1),  // 1 (Forward) or -1 (Backward)
    currentPath: z.array(z.string()).default([]), // Ephemeral path cache
    restrictedBiomes: z.array(z.string()).optional() // If set, only move to these biomes
});

export type NPCMovementBehavior = z.infer<typeof NPCMovementBehaviorSchema>;

export const WorldNPCSchema = z.object({
    id: z.string(),
    name: z.string(),
    relationship: RelationshipStateSchema.default({}),
    dialogue_triggers: z.array(z.string()).default([]),
    factionId: z.string().optional(),
    role: z.string().optional(),
    isMerchant: z.boolean().default(false),
    shopState: ShopStateSchema.optional(),
    inventory: z.array(z.object({
        id: z.string(),
        quantity: z.number().default(1)
    })).default([]),
    stats: z.record(AbilityScoreSchema, z.number()).default({
        'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10
    }),
    description: z.string().optional(),
    traits: z.array(z.string()).default([]),
    conversationHistory: z.array(z.object({
        speaker: z.string(),
        text: z.string(),
        timestamp: z.string()
    })).default([]),
    npcProfile: z.any().optional(), // Structured profile
    movementBehavior: NPCMovementBehaviorSchema.optional()
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
