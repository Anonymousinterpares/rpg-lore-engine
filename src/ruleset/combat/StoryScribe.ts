import { ScribeAgent } from '../agents/ContextManager';
import { GameState } from '../schemas/FullSaveStateSchema';
import { AgentManager } from '../agents/AgentManager';
import { LLMClient } from './LLMClient';
import { LLM_PROVIDERS } from '../data/StaticData';

export class StoryScribe {
    private scribe = new ScribeAgent();
    private turnCounter: number = 0;
    private readonly summaryInterval: number = 20;

    /**
     * Checks if a summary is needed and updates the state.
     */
    public async processTurn(state: GameState, history: any[]): Promise<void> {
        this.turnCounter++;

        if (this.turnCounter >= this.summaryInterval) {
            await this.generateSummary(state, history);
            this.turnCounter = 0;
        }
    }

    public async forceSummary(state: GameState, history: any[]): Promise<void> {
        await this.generateSummary(state, history);
    }

    private async generateSummary(state: GameState, history: any[]): Promise<void> {
        console.log('[SYSTEM] StoryScribe: Condensing history into summary...');

        const profile = AgentManager.getAgentProfile('NARRATOR'); // Use same provider as narrator
        const providerConfig = LLM_PROVIDERS.find(p => p.id === profile.providerId);
        const modelConfig = providerConfig?.models.find(m => m.id === profile.modelId);

        if (!providerConfig || !modelConfig) return;

        const systemPrompt = this.scribe.getSystemPrompt({ previousSummary: state.storySummary });
        const historyText = history.map(h => `${h.role}: ${h.content}`).join('\n');

        try {
            const summary = await LLMClient.generateCompletion(
                providerConfig,
                modelConfig,
                {
                    systemPrompt,
                    userMessage: `HISTORY:\n${historyText}\n\nUpdate the "Story So Far" summary based on these recent events.`,
                    temperature: 0.3,
                    maxTokens: 500,
                    responseFormat: 'text'
                }
            );

            if (summary && summary.length > 10) {
                state.storySummary = summary.trim();
                console.log('[SYSTEM] StoryScribe: Summary updated.');
            }
        } catch (error) {
            console.error('[StoryScribe] Summary generation failed:', error);
        }
    }
}
