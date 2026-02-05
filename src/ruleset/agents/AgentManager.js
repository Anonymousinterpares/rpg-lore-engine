import { SwarmConfigSchema } from '../schemas/AgentConfigSchema';
import DEFAULT_SWARM_JSON from './AgentConfig.json';
const DEFAULT_SWARM_CONFIG = DEFAULT_SWARM_JSON;
export class AgentManager {
    static STORAGE_KEY = 'rpg_agent_config';
    /**
     * Returns the active configuration for the entire swarm.
     * Merges defaults with any user overrides in localStorage.
     */
    static getConfig() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored)
            return DEFAULT_SWARM_CONFIG;
        try {
            const parsed = JSON.parse(stored);
            // Partial merge: start with defaults, overwrite with stored
            return {
                ...DEFAULT_SWARM_CONFIG,
                ...parsed
            };
        }
        catch (e) {
            console.error('[AgentManager] Failed to parse stored config, falling back to defaults.', e);
            return DEFAULT_SWARM_CONFIG;
        }
    }
    /**
     * Returns the profile for a specific agent role.
     */
    static getAgentProfile(type) {
        return this.getConfig()[type];
    }
    /**
     * Saves a specific agent profile override.
     */
    static saveAgentProfile(profile) {
        const current = this.getRawStoredConfig();
        current[profile.id] = profile;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    }
    /**
     * Resets a specific agent to its default.
     */
    static resetAgent(type) {
        const current = this.getRawStoredConfig();
        delete current[type];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    }
    /**
     * Imports a full configuration from a JSON string.
     */
    static importConfig(json) {
        try {
            const parsed = JSON.parse(json);
            const validated = SwarmConfigSchema.safeParse(parsed);
            if (!validated.success) {
                return { success: false, error: 'Invalid configuration format.' };
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated.data));
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
    /**
     * Exports the current CONFIG (including defaults) as a JSON string.
     */
    static exportConfig() {
        return JSON.stringify(this.getConfig(), null, 2);
    }
    static getRawStoredConfig() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored)
            return {};
        try {
            return JSON.parse(stored);
        }
        catch {
            return {};
        }
    }
}
