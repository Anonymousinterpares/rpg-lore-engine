export class BaseAgent {
    name;
    role;
    constructor(name, role) {
        this.name = name;
        this.role = role;
    }
}
export class NarratorAgent extends BaseAgent {
    constructor() {
        super('Narrator', 'DM');
    }
    getSystemPrompt(context) {
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
    getSystemPrompt(context) {
        return `You are the Director. Monitor the pacing and "fun". 
        If the party is idle, inject a directive. 
        Output MUST match DirectorDirectiveSchema.`;
    }
}
export class NPCControllerAgent extends BaseAgent {
    constructor() {
        super('NPCController', 'Companion AI');
    }
    getSystemPrompt(context) {
        return `You are the NPC Controller. You manage the dialogue and actions of party companions.
        Companions: ${context.companions?.map((c) => c.name).join(', ') || 'None'}
        Current Motivation: ${context.currentMotivation || 'Follow the leader'}
        Reaction to player: "${context.playerAction}"
        Output should suggest dialogue lines and tactical actions for companions.`;
    }
}
