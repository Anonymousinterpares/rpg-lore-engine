import { z } from 'zod';
import { FullSaveStateSchema } from './FullSaveStateSchema';

export const SessionInfoSchema = z.object({
    sessionId: z.string(),
    hostName: z.string(),
    hostEndpoint: z.string(),
    worldSeed: z.string().optional(),
    currentPlayers: z.number(),
    maxPlayers: z.number().default(4),
    createdAt: z.string(),
    lastPing: z.string()
});

export const ChatMessageSchema = z.object({
    messageId: z.string(),
    playerId: z.string(),
    playerName: z.string(),
    content: z.string().max(500),
    timestamp: z.string(),
    type: z.enum(['player', 'system', 'narrator']).default('player')
});

export const MultiplayerGameStateSchema = z.object({
    sessionId: z.string(),
    turnNumber: z.number(),
    currentPlayerId: z.string(),
    players: z.array(z.object({
        playerId: z.string(),
        playerName: z.string(),
        characterId: z.string(),
        isConnected: z.boolean(),
        lastSeen: z.string()
    })),
    gameState: FullSaveStateSchema,
    stateHash: z.string().optional(),
    chatHistory: z.array(ChatMessageSchema).default([])
});

export const PlayerActionSchema = z.object({
    actionId: z.string(),
    playerId: z.string(),
    actionType: z.enum([
        'MOVE', 'ATTACK', 'SPELL', 'INTERACT', 'USE_ITEM',
        'END_TURN', 'DIALOGUE_CHOICE', 'PASS'
    ]),
    targetCoordinates: z.tuple([z.number(), z.number()]).optional(),
    targetId: z.string().optional(),
    payload: z.record(z.any()).optional()
});

export const TurnTimerSchema = z.object({
    enabled: z.boolean().default(true),
    timeoutSeconds: z.number().default(120),
    currentTurnStartedAt: z.string()
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type MultiplayerGameState = z.infer<typeof MultiplayerGameStateSchema>;
export type PlayerAction = z.infer<typeof PlayerActionSchema>;
export type TurnTimer = z.infer<typeof TurnTimerSchema>;
