import { BaseAgent } from './AgentSwarm';
import { HistoryManager } from './HistoryManager';
export class ScribeAgent extends BaseAgent {
    constructor() {
        super('Scribe', 'Summarizer');
    }
    getSystemPrompt(context) {
        return `You are the Scribe. Your task is to summarize the recent events of the story. 
        Focus on important plot points, character development, and status changes.
        Previous Summary: ${context.previousSummary || 'None'}`;
    }
}
export class ContextManager {
    history = new HistoryManager();
    currentSummary = '';
    /**
     * Constructs the full context for a Narrator call.
     */
    getNarratorContext(pc, hex) {
        return {
            character: {
                name: pc.name,
                class: pc.class,
                level: pc.level,
                hp: pc.hp,
                stats: pc.stats
            },
            location: hex.name || (hex.coordinates ? `Hex ${hex.coordinates.join(',')}` : 'Unknown Location'),
            recentHistory: this.history.getRecent(10),
            summary: this.currentSummary,
            partyNames: pc.name // Could expand to include NPCs
        };
    }
    addEvent(role, content) {
        this.history.addMessage(role, content);
    }
    setSummary(summary) {
        this.currentSummary = summary;
    }
    getSummary() {
        return this.currentSummary;
    }
}
