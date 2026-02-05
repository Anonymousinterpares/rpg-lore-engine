import { SwarmConfig } from '../schemas/AgentConfigSchema';

export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
    NARRATOR: {
        id: 'NARRATOR',
        name: 'The Narrator',
        providerId: 'anthropic',
        modelId: 'claude-4-5-sonnet',
        temperature: 0.8,
        maxTokens: 1500
    },
    DIRECTOR: {
        id: 'DIRECTOR',
        name: 'The Director',
        providerId: 'google',
        modelId: 'gemini-3-0-flash',
        temperature: 0.7,
        maxTokens: 500
    },
    NPC_CONTROLLER: {
        id: 'NPC_CONTROLLER',
        name: 'NPC Controller',
        providerId: 'google',
        modelId: 'gemini-3-0-flash',
        temperature: 0.9,
        maxTokens: 800
    },
    LORE_KEEPER: {
        id: 'LORE_KEEPER',
        name: 'Lore Keeper',
        providerId: 'openrouter',
        modelId: 'mistral-7b',
        temperature: 0.3,
        maxTokens: 2000
    }
};
