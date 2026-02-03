import { z } from 'zod';
import { PlayerCharacterSchema } from './PlayerCharacterSchema';
import { WorldClockSchema } from './WorldClockSchema';
import { MapRegistrySchema } from './HexMapSchema';
import { SubLocationSchema, WorldNPCSchema } from './WorldEnrichmentSchema';
import { QuestSchema } from './QuestSchema';
import { FactionSchema } from './FactionSchema';
import { CampaignSettingsSchema } from './CampaignSettingsSchema';

export const ConversationTurnSchema = z.object({
    role: z.enum(['user', 'narrator', 'system']),
    content: z.string(),
    turnNumber: z.number()
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
    location: z.object({
        hexId: z.string(),
        coordinates: z.tuple([z.number(), z.number()]),
        subLocationId: z.string().optional(),
        roomId: z.string().optional()
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
    conversationHistory: z.array(ConversationTurnSchema).default([]),
    triggeredEvents: z.array(z.string()).default([]),

    // --- Settings ---
    settings: CampaignSettingsSchema
});

export type FullSaveState = z.infer<typeof FullSaveStateSchema>;
export type GameState = FullSaveState; // Alias for backward compatibility
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
