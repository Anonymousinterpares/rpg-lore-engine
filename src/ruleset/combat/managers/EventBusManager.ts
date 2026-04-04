import { GameState } from '../../schemas/FullSaveStateSchema';

export type GameEventType =
    | 'COMBAT_KILL'
    | 'ITEM_ACQUIRED'
    | 'ITEM_LOST'
    | 'HEX_DISCOVERED'
    | 'NPC_INTERACTION'
    | 'POI_INVESTIGATED'
    | 'CONVERSATION_START'
    | 'CONVERSATION_END'
    | 'CONVERSATION_PARTICIPANT_ADDED'
    | 'SPEECH_BUBBLE'
    | 'BACKGROUND_CHATTER';

export interface GameEventPayload {
    COMBAT_KILL: { targetId: string, count: number };
    ITEM_ACQUIRED: { itemId: string, quantity: number };
    ITEM_LOST: { itemId: string, quantity: number };
    HEX_DISCOVERED: { coordinates: [number, number], hexId: string };
    NPC_INTERACTION: { npcId: string, nodeTopic?: string };
    POI_INVESTIGATED: { poiId: string, questTriggerId?: string };
    CONVERSATION_START: { npcId: string, mode: string, participants: string[] };
    CONVERSATION_END: { npcId: string, summary: string, durationTurns: number };
    CONVERSATION_PARTICIPANT_ADDED: { npcId: string, conversationPrimaryId: string };
    SPEECH_BUBBLE: { npcId: string, text: string, isInterParty: boolean };
    BACKGROUND_CHATTER: { participants: string[], topic: string };
}

export type EventCallback<T extends GameEventType> = (payload: GameEventPayload[T], state: GameState) => void | Promise<void>;

/**
 * EventBusManager
 * Centralized publish-subscribe system for decopuling engine mechanics.
 * Perfect for quest tracking, ambient achievements, and tutorial hooks.
 */
export class EventBusManager {
    private static listeners: { [K in GameEventType]?: EventCallback<K>[] } = {};
    private static stateRef: GameState | null = null;

    /**
     * Initializes the Event Bus with a reference to the global state.
     */
    public static initialize(state: GameState) {
        this.stateRef = state;
    }

    /**
     * Subscribes a callback to a specific event type.
     */
    public static subscribe<T extends GameEventType>(type: T, callback: EventCallback<T>): () => void {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type]!.push(callback as any);

        // Return unsubscribe function
        return () => {
            if (this.listeners[type]) {
                const index = this.listeners[type]!.indexOf(callback as any);
                if (index !== -1) {
                    this.listeners[type]!.splice(index, 1);
                }
            }
        };
    }

    /**
     * Publishes an event to all subscribers.
     */
    public static async publish<T extends GameEventType>(type: T, payload: GameEventPayload[T]): Promise<void> {
        if (!this.stateRef) {
            console.warn('[EventBusManager] Published event before initialization.');
            return;
        }

        const callbacks = this.listeners[type] || [];
        for (const callback of callbacks) {
            try {
                await callback(payload, this.stateRef);
            } catch (err) {
                console.error(`[EventBusManager] Error in listener for event ${type}:`, err);
            }
        }
    }

    /**
     * Clears all subscriptions. Useful for testing or full reboots.
     */
    public static clearAll() {
        this.listeners = {};
        this.stateRef = null;
    }
}
