import { BaseAgent, NarratorAgent, DirectorAgent } from './AgentSwarm';
import { HistoryManager } from './HistoryManager';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

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
    public getNarratorContext(pc: PlayerCharacter, hex: any): any {
        return {
            character: {
                name: pc.name,
                class: pc.class,
                level: pc.level,
                hp: pc.hp,
                stats: pc.stats
            },
            location: hex.name || `Hex ${hex.coordinates.join(',')}`,
            recentHistory: this.history.getRecent(10),
            summary: this.currentSummary,
            partyNames: pc.name // Could expand to include NPCs
        };
    }

    public addEvent(role: 'narrator' | 'player' | 'director', content: string) {
        this.history.addMessage(role, content);
    }

    public setSummary(summary: string) {
        this.currentSummary = summary;
    }

    public getSummary(): string {
        return this.currentSummary;
    }
}
