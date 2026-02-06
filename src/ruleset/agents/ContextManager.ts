import { BaseAgent } from './AgentSwarm';
import { HistoryManager } from './HistoryManager';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { GameState } from '../schemas/FullSaveStateSchema';
import { HexMapManager } from '../combat/HexMapManager';
import { ContextBuilder } from './ContextBuilder';

export class ScribeAgent extends BaseAgent {
    constructor() {
        super('Scribe', 'Summarizer');
    }

    public getSystemPrompt(context: any): string {
        return `You are the Scribe. Your task is to summarize the recent events of the story. 
        Focus on important plot points, character development, and status changes.
        Previous Summary: ${context.previousSummary || 'None'}`;
    }
}

export class ContextManager {
    private history: HistoryManager = new HistoryManager();
    private currentSummary: string = '';

    /**
     * Constructs the full context for a Narrator call.
     */
    public getNarratorContext(state: GameState, hexManager: HexMapManager): any {
        return ContextBuilder.build(
            state,
            hexManager,
            this.history.getRecent(10)
        );
    }

    public addEvent(role: 'narrator' | 'player' | 'director' | 'scribe' | 'system', content: string) {
        this.history.addMessage(role, content);
    }

    public setSummary(summary: string) {
        this.currentSummary = summary;
    }

    public getSummary(): string {
        return this.currentSummary;
    }
}
