export const DEFAULT_SWARM_CONFIG = {
    NARRATOR: {
        id: 'NARRATOR',
        name: 'The Narrator',
        providerId: 'anthropic',
        modelId: 'claude-4-5-sonnet',
        basePrompt: 'Describe the scene vividly but concisely. Never decide outcomes (the engine does). Output MUST be valid JSON matching the NarratorOutputSchema.',
        temperature: 0.8,
        maxTokens: 1500
    },
    DIRECTOR: {
        id: 'DIRECTOR',
        name: 'The Director',
        providerId: 'google',
        modelId: 'gemini-3-0-flash',
        basePrompt: 'You are the game director. Monitor pacing and suggest events or difficulty adjustments.',
        temperature: 0.7,
        maxTokens: 500
    },
    NPC_CONTROLLER: {
        id: 'NPC_CONTROLLER',
        name: 'NPC Controller',
        providerId: 'google',
        modelId: 'gemini-3-0-flash',
        basePrompt: 'You control the NPCs and companions. Roleplay their personalities and suggest tactical actions.',
        temperature: 0.9,
        maxTokens: 800
    },
    LORE_KEEPER: {
        id: 'LORE_KEEPER',
        name: 'Lore Keeper',
        providerId: 'openrouter',
        modelId: 'mistral-7b',
        basePrompt: 'You are the keeper of lore. Provide deep context on history, factions, and the world when requested.',
        temperature: 0.3,
        maxTokens: 2000
    }
};
