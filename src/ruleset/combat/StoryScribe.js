import { ScribeAgent } from '../agents/ContextManager';
export class StoryScribe {
    scribe = new ScribeAgent();
    turnCounter = 0;
    summaryInterval = 20;
    /**
     * Checks if a summary is needed and updates the state.
     * In a real implementation, this would call an LLM.
     * For the ruleset logic, we provide the hook.
     */
    async processTurn(state, history) {
        this.turnCounter++;
        if (this.turnCounter >= this.summaryInterval) {
            console.log('[SYSTEM] StoryScribe: Condensing history into summary...');
            // In a real integration, we'd send history to ScribeAgent
            // state.storySummary = await this.scribe.generate(history);
            this.turnCounter = 0;
        }
    }
    forceSummary(state, history) {
        console.log('[SYSTEM] StoryScribe: Force summary update.');
        // state.storySummary = ...
    }
}
