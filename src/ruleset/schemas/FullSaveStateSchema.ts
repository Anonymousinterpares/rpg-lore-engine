import { z } from 'zod';
import { PlayerCharacterSchema } from './PlayerCharacterSchema';
import { WorldClockSchema } from './WorldClockSchema';
import { MapRegistrySchema } from './HexMapSchema';
import { SubLocationSchema, WorldNPCSchema } from './WorldEnrichmentSchema';
import { QuestSchema } from './QuestSchema';
import { FactionSchema } from './FactionSchema';
import { CampaignSettingsSchema } from './CampaignSettingsSchema';

export const ConversationTurnSchema = z.object({
    role: z.enum(['player', 'narrator', 'director', 'scribe', 'system']),
    content: z.string(),
    turnNumber: z.number()
});

export const CombatConditionSchema = z.object({
    id: z.string(), // e.g., 'blinded', 'prone'
    name: z.string(),
    description: z.string(),
    duration: z.number().optional(), // rounds remaining, undefined = permanent
    sourceId: z.string().optional()
});

export const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.object({
        current: z.number(),
        max: z.number()
    }),
    initiative: z.number(),
    isPlayer: z.boolean(),
    type: z.enum(['player', 'companion', 'enemy']),
    // Enhanced fields for deterministic combat
    ac: z.number().default(10),
    stats: z.record(z.string(), z.number()).default({}),
    conditions: z.array(CombatConditionSchema).default([]),
    spellSlots: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number()
    })).optional()
});

export type CombatCondition = z.infer<typeof CombatConditionSchema>;

export const CombatLogEntrySchema = z.object({
    id: z.string(),
    type: z.enum(['info', 'warning', 'error', 'success']),
    message: z.string(),
    turn: z.number().optional()
});

export const CombatEventSchema = z.object({
    id: z.string(),
    type: z.enum(['HIT', 'MISS', 'CRIT', 'HEAL', 'CONDITION']),
    targetId: z.string(),
    value: z.number().optional(),
    text: z.string().optional(),
    timestamp: z.number()
});

export const CombatStateSchema = z.object({
    round: z.number().default(1),
    currentTurnIndex: z.number().default(0),
    combatants: z.array(CombatantSchema),
    logs: z.array(CombatLogEntrySchema).default([]),
    selectedTargetId: z.string().optional(),
    lastRoll: z.number().optional(),
    events: z.array(CombatEventSchema).default([])
});

export const FullSaveStateSchema = z.object({
    // --- Meta ---
    saveId: z.string(),
    saveVersion: z.number().default(1),
    createdAt: z.string(),
    lastSavedAt: z.string(),
    playTimeSeconds: z.number(),
    saveSlotName: z.string().optional(),

    // --- Player & Party ---
    character: PlayerCharacterSchema,
    companions: z.array(PlayerCharacterSchema).default([]),

    // --- World State ---
    mode: z.string(), // Bridge to GameMode enum
    combat: CombatStateSchema.optional(), // Combat State
    location: z.object({
        hexId: z.string(),
        coordinates: z.tuple([z.number(), z.number()]),
        subLocationId: z.string().optional(),
        roomId: z.string().optional(),
        droppedItems: z.array(z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            quantity: z.number(),
            weight: z.number(),
            instanceId: z.string()
        })).optional().default([])
    }),
    worldTime: WorldClockSchema,
    worldMap: MapRegistrySchema,
    subLocations: z.array(SubLocationSchema).default([]),
    worldNpcs: z.array(WorldNPCSchema).default([]),

    // --- Progress ---
    activeQuests: z.array(QuestSchema).default([]),
    factions: z.array(FactionSchema).default([]),

    // --- Narrative & LLM ---
    storySummary: z.string().default(''),
    lastNarrative: z.string().default(''),
    conversationHistory: z.array(ConversationTurnSchema).default([]),
    triggeredEvents: z.array(z.string()).default([]),
    codexEntries: z.array(z.object({
        id: z.string(),
        category: z.enum(['bestiary', 'items']),
        entityId: z.string(),
        title: z.string(),
        content: z.string(),
        isNew: z.boolean().default(true),
        discoveredAt: z.number()
    })).default([]),
    notifications: z.array(z.object({
        id: z.string(),
        type: z.enum(['CODEX_ENTRY']),
        message: z.string(),
        data: z.any(),
        isRead: z.boolean().default(false),
        createdAt: z.number()
    })).default([]),

    // --- Settings ---
    settings: CampaignSettingsSchema
});

export type FullSaveState = z.infer<typeof FullSaveStateSchema>;
export type GameState = FullSaveState; // Alias for backward compatibility
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
