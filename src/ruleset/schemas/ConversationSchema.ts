import { z } from 'zod';

// --- Talk Mode ---
export const TalkModeSchema = z.enum(['NONE', 'PRIVATE', 'NORMAL', 'GROUP']);
export type TalkMode = z.infer<typeof TalkModeSchema>;

// --- Conversation Message ---
export const ConversationMessageSchema = z.object({
    speakerId: z.string(),       // NPC sourceNpcId or 'player'
    speakerName: z.string(),
    text: z.string(),
    isPrivate: z.boolean().default(false),
    timestamp: z.string()
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// --- Active Conversation (player-initiated talk mode) ---
export const ActiveConversationSchema = z.object({
    primaryNpcId: z.string(),                        // The NPC the player initiated talk with
    participants: z.array(z.string()),               // All active NPC IDs in conversation
    mode: TalkModeSchema,
    history: z.array(ConversationMessageSchema),     // Messages within this talk session
    startedAtTurn: z.number()
});
export type ActiveConversation = z.infer<typeof ActiveConversationSchema>;

// --- Speech Bubble (shown on companion cards) ---
export const SpeechBubbleSchema = z.object({
    npcId: z.string(),
    npcName: z.string(),
    text: z.string(),
    expiresAt: z.number(),           // Date.now() timestamp for auto-dismiss
    isInterParty: z.boolean()        // true = party members talking to each other
});
export type SpeechBubble = z.infer<typeof SpeechBubbleSchema>;

// --- Background Conversation (NPC-NPC, hidden from player) ---
export const BackgroundConversationSchema = z.object({
    participantIds: z.array(z.string()),
    topic: z.string(),
    messages: z.array(ConversationMessageSchema),
    startedAtTurn: z.number()
});
export type BackgroundConversation = z.infer<typeof BackgroundConversationSchema>;

// --- Full Conversation State (persisted in saves) ---
export const ConversationStateSchema = z.object({
    activeConversation: ActiveConversationSchema.nullable().default(null),
    backgroundConversations: z.array(BackgroundConversationSchema).default([]),
    speechBubbles: z.array(SpeechBubbleSchema).default([]),
    chatterCooldowns: z.record(z.string(), z.number()).default({}),  // npcId -> last chatter turn
    lastBackgroundChatterTurn: z.number().default(0),
    lastConversationSummary: z.string().default(''),                 // Fed to narrator on resume
    tokenBudgetUsedThisTurn: z.number().default(0),
    /** Name of the NPC currently chosen to respond (for UI "X wants to respond" phase) */
    respondingNpcName: z.string().optional()
});
export type ConversationState = z.infer<typeof ConversationStateSchema>;

// --- Constants ---
export const CHATTER_COOLDOWN_TURNS = 3;
export const BACKGROUND_CONVO_CHANCE = 0.15;
export const PUBLIC_COMMENT_CHANCE_NORMAL = 0.30;
export const PUBLIC_COMMENT_CHANCE_GROUP = 0.70;
export const MAX_TURN_TOKEN_BUDGET = 800;
export const SPEECH_BUBBLE_DURATION_MS = 8000;
export const MAX_BACKGROUND_CONVERSATIONS = 3;

// --- Personality chatter probability modifiers ---
export const CHATTER_TRAIT_MODIFIERS: Record<string, number> = {
    'Gossip': 2.0, 'Charismatic': 1.8, 'Charming': 1.5, 'Flamboyant': 1.7,
    'Inquisitive': 1.5, 'Cheerful': 1.4, 'Optimistic': 1.3, 'Eccentric': 1.3,
    'Sarcastic': 1.4, 'Aggressive': 1.2,
    'Loner': 0.3, 'Reclusive': 0.3, 'Stoic': 0.4, 'Apathetic': 0.4,
    'Detached': 0.5, 'Cold': 0.5, 'Guarded': 0.6,
};

// --- Trait-topic keyword map for personality resonance scoring ---
export const TRAIT_TOPIC_KEYWORDS: Record<string, string[]> = {
    'Scholar': ['know', 'history', 'lore', 'book', 'magic', 'spell', 'arcane', 'study', 'learn', 'read'],
    'Bookish': ['know', 'history', 'lore', 'book', 'study', 'learn', 'read', 'research'],
    'Suspicious': ['trust', 'betray', 'trap', 'ambush', 'lie', 'danger', 'careful', 'watch'],
    'Aggressive': ['fight', 'attack', 'battle', 'kill', 'war', 'weapon', 'threat', 'strong'],
    'Ex-Soldier': ['fight', 'war', 'battle', 'soldier', 'army', 'weapon', 'tactics', 'defend'],
    'Mercenary': ['gold', 'pay', 'hire', 'contract', 'fight', 'coin', 'reward'],
    'Merchant': ['gold', 'trade', 'buy', 'sell', 'price', 'coin', 'goods', 'market', 'value'],
    'Greed (Gold)': ['gold', 'treasure', 'coin', 'rich', 'wealth', 'fortune', 'pay'],
    'Knowledge (Secrets)': ['secret', 'know', 'hidden', 'mystery', 'discover', 'truth', 'reveal'],
    'Faith (Divine)': ['god', 'pray', 'divine', 'holy', 'temple', 'faith', 'bless', 'curse'],
    'Nature Guardian': ['forest', 'nature', 'animal', 'tree', 'plant', 'wild', 'beast', 'druid'],
    'Hermit': ['alone', 'solitude', 'quiet', 'peace', 'cave', 'wilderness', 'retreat'],
    'Perceptive': ['see', 'notice', 'watch', 'look', 'track', 'find', 'hear', 'sense'],
    'Cunning': ['plan', 'trick', 'clever', 'scheme', 'strategy', 'outsmart'],
    'Helpful': ['help', 'aid', 'assist', 'support', 'save', 'protect', 'heal'],
    'Duty (Honor)': ['duty', 'honor', 'oath', 'protect', 'serve', 'defend', 'loyal'],
    'Revenge (Past)': ['revenge', 'past', 'wrong', 'justice', 'punish', 'betray'],
    'Survival (Fear)': ['danger', 'safe', 'survive', 'fear', 'escape', 'flee', 'hide'],
};
