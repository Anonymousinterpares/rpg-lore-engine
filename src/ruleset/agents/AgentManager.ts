import { AgentProfile, AgentType, SwarmConfig, SwarmConfigSchema } from '../schemas/AgentConfigSchema';
import DEFAULT_SWARM_JSON from './AgentConfig.json';
import { LLM_PROVIDERS } from '../data/StaticData';
import { LLMProviderConfig, ModelConfig } from '../schemas/LLMProviderSchema';

const DEFAULT_SWARM_CONFIG = DEFAULT_SWARM_JSON as SwarmConfig;

export class AgentManager {
    private static STORAGE_KEY = 'rpg_agent_config';

    /**
     * Returns the active configuration for the entire swarm.
     * Merges defaults with any user overrides in localStorage.
     */
    public static getConfig(): SwarmConfig {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return DEFAULT_SWARM_CONFIG;

        try {
            const parsed = JSON.parse(stored);
            // Partial merge: start with defaults, overwrite with stored
            return {
                ...DEFAULT_SWARM_CONFIG,
                ...parsed
            };
        } catch (e) {
            console.error('[AgentManager] Failed to parse stored config, falling back to defaults.', e);
            return DEFAULT_SWARM_CONFIG;
        }
    }

    /**
     * Returns the profile for a specific agent role.
     */
    public static getAgentProfile(type: AgentType): AgentProfile {
        return this.getConfig()[type] as AgentProfile;
    }

    /**
     * Helper to get the provider configuration for an agent's current setting.
     */
    public static getProviderForAgent(profile: AgentProfile): LLMProviderConfig | undefined {
        return LLM_PROVIDERS.find(p => p.id === profile.providerId);
    }

    /**
     * Helper to get the model configuration for an agent's current setting.
     */
    public static getModelForAgent(profile: AgentProfile): ModelConfig | undefined {
        const provider = this.getProviderForAgent(profile);
        return provider?.models.find(m => m.id === profile.modelId);
    }

    /**
     * Saves a specific agent profile override.
     */
    public static saveAgentProfile(profile: AgentProfile) {
        const current = this.getRawStoredConfig();
        current[profile.id] = profile;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    }

    /**
     * Resets a specific agent to its default.
     */
    public static resetAgent(type: AgentType) {
        const current = this.getRawStoredConfig();
        delete current[type];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    }

    /**
     * Imports a full configuration from a JSON string.
     */
    public static importConfig(json: string): { success: boolean, error?: string } {
        try {
            const parsed = JSON.parse(json);
            const validated = SwarmConfigSchema.safeParse(parsed);
            if (!validated.success) {
                return { success: false, error: 'Invalid configuration format.' };
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated.data));
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Exports the current CONFIG (including defaults) as a JSON string.
     */
    public static exportConfig(): string {
        return JSON.stringify(this.getConfig(), null, 2);
    }

    private static getRawStoredConfig(): any {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return {};
        try {
            return JSON.parse(stored);
        } catch {
            return {};
        }
    }
}
