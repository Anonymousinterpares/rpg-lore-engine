import { z } from 'zod';
import { WeatherSchema, TravelPaceSchema } from './BaseSchemas';
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

import {
    CombatantSchema,
    CombatLogEntrySchema,
    CombatEventSchema,
    CombatStateSchema
} from './CombatSchema';

export {
    CombatantSchema,
    CombatLogEntrySchema,
    CombatEventSchema,
    CombatStateSchema
};

export const FullSaveStateSchema = z.object({
    // --- Meta ---
    saveId: z.string(),
    saveVersion: z.number().default(1),
    worldSeed: z.number().default(12345),
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
        previousCoordinates: z.tuple([z.number(), z.number()]).optional(),
        previousControlPointOffset: z.tuple([z.number(), z.number()]).optional(),
        subLocationId: z.string().optional(),
        roomId: z.string().optional(),
        droppedItems: z.array(z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            quantity: z.number(),
            weight: z.number(),
            charges: z.number().optional(),
            instanceId: z.string()
        })).optional().default([]),
        combatLoot: z.array(z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            quantity: z.number(),
            weight: z.number(),
            charges: z.number().optional(),
            instanceId: z.string()
        })).optional().default([]),
        travelAnimation: z.object({
            startCoordinates: z.tuple([z.number(), z.number()]),
            targetCoordinates: z.tuple([z.number(), z.number()]),
            controlPointOffset: z.tuple([z.number(), z.number()]),
            startTime: z.number(),
            duration: z.number(),
            travelType: z.enum(['Road', 'Path', 'Ancient', 'Stealth', 'Wilderness']).optional().default('Wilderness')
        }).optional()
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
        category: z.enum(['bestiary', 'items', 'world']),
        entityId: z.string(),
        title: z.string(),
        content: z.string(),
        isNew: z.boolean().default(true),
        discoveredAt: z.number()
    })).default([]),
    notifications: z.array(z.object({
        id: z.string(),
        type: z.enum(['CODEX_ENTRY', 'SYSTEM_ERROR']),
        message: z.string(),
        data: z.any(),
        isRead: z.boolean().default(false),
        createdAt: z.number()
    })).default([]),

    // --- Environmental ---
    weather: WeatherSchema.default({ type: 'Clear', durationMinutes: 0 }),
    travelPace: TravelPaceSchema.default('Normal'),
    explorationBlindnessUntil: z.number().default(0),
    findThePathActiveUntil: z.number().default(0),
    navigationTarget: z.tuple([z.number(), z.number()]).optional(),
    clearedHexes: z.record(z.string(), z.number()).default({}), // hexId -> timestamp (in turns or game min)

    // --- Settings ---
    settings: CampaignSettingsSchema
});

export type FullSaveState = z.infer<typeof FullSaveStateSchema>;
export type GameState = FullSaveState; // Alias for backward compatibility
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
