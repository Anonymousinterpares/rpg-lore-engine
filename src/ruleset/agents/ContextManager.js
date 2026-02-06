import { BaseAgent } from './AgentSwarm';
import { HistoryManager } from './HistoryManager';
import { ContextBuilder } from './ContextBuilder';
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
    getNarratorContext(state, hexManager) {
        return ContextBuilder.build(state, hexManager, this.history.getRecent(10));
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
    getRecentHistory(n = 10) {
        return this.history.getRecent(n);
    }
}
