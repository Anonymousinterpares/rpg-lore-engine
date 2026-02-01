import { NarratorOutput, DirectorDirective } from './ICPSchemas';

export abstract class BaseAgent {
    constructor(public name: string, public role: string) { }

    /**
     * Every agent should be able to generate a system prompt based on current state.
     */
    public abstract getSystemPrompt(context: any): string;
}

export class NarratorAgent extends BaseAgent {
    constructor() {
        super('Narrator', 'DM');
    }

    public getSystemPrompt(context: any): string {
        return `You are the Narrator and Game Master. 
        Describe the scene vividly but concisely. 
        Rules: 
        1. Never decide outcomes (the engine does). 
        2. Output MUST be valid JSON matching the NarratorOutputSchema.
        Current Location: ${context.location || 'Unknown'}
        Active Party: ${context.partyNames || 'None'}`;
    }
}

export class DirectorAgent extends BaseAgent {
    constructor() {
        super('Director', 'Pacing');
    }

    public getSystemPrompt(context: any): string {
        return `You are the Director. Monitor the pacing and "fun". 
        If the party is idle, inject a directive. 
        Output MUST match DirectorDirectiveSchema.`;
    }
}
