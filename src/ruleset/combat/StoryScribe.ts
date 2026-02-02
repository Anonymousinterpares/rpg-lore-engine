import { ScribeAgent } from '../agents/ContextManager';
import { GameState } from './GameStateManager';

export class StoryScribe {
    private scribe = new ScribeAgent();
    private turnCounter: number = 0;
    private readonly summaryInterval: number = 20;

    /**
     * Checks if a summary is needed and updates the state.
     * In a real implementation, this would call an LLM.
     * For the ruleset logic, we provide the hook.
     */
    public async processTurn(state: GameState, history: any[]): Promise<void> {
        this.turnCounter++;

        if (this.turnCounter >= this.summaryInterval) {
            console.log('[SYSTEM] StoryScribe: Condensing history into summary...');
            // In a real integration, we'd send history to ScribeAgent
            // state.storySummary = await this.scribe.generate(history);
            this.turnCounter = 0;
        }
    }

    public forceSummary(state: GameState, history: any[]): void {
        console.log('[SYSTEM] StoryScribe: Force summary update.');
        // state.storySummary = ...
    }
}
