import { CampaignSettings, CampaignSettingsSchema } from '../schemas/CampaignSettingsSchema';
import { NetworkStorageProvider } from './NetworkStorageProvider';

export class SettingsManager {
    private static STORAGE_KEY = 'rpg_global_settings';
    private static SETTINGS_FILE = 'settings.json';
    private static network = new NetworkStorageProvider();

    private static DEFAULT_SETTINGS: CampaignSettings = {
        permadeath: false,
        variantEncumbrance: false,
        milestoneLeveling: false,
        criticalFumbleEffects: false,
        difficultyModifier: 1.0,
        inspirationEnabled: true,
        multiclassingAllowed: true,
        maxConversationHistoryTurns: 50,
        video: {
            fullscreen: false,
            vsync: true,
            resolutionScale: 1.0
        },
        audio: {
            master: 0.8,
            music: 0.5
        },
        gameplay: {
            difficulty: 'normal',
            tutorials: true,
            autosave: false,
            developerMode: false
        },
        ai: {}
    };

    /**
     * Loads settings with local-first priority:
     * 1. Backend settings.json
     * 2. Browser localStorage
     * 3. Defaults
     */
    public static async loadSettings(): Promise<CampaignSettings> {
        // 1. Try Network/Local File
        try {
            const exists = await this.network.exists(this.SETTINGS_FILE);
            if (exists) {
                const content = await this.network.read(this.SETTINGS_FILE);
                const parsed = JSON.parse(content);
                console.log('[SettingsManager] Loaded from settings.json');
                return CampaignSettingsSchema.parse(parsed);
            }
        } catch (e) {
            console.warn('[SettingsManager] settings.json not available or invalid.', e);
        }

        // 2. Fallback to LocalStorage
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log('[SettingsManager] Loaded from LocalStorage');
                return CampaignSettingsSchema.parse(parsed);
            }
        } catch (e) {
            console.warn('[SettingsManager] LocalStorage fallback failed.', e);
        }

        console.log('[SettingsManager] Using default settings.');
        return { ...this.DEFAULT_SETTINGS };
    }

    /**
     * DEPRECATED: Use loadSettings() (async)
     * Kept for synchronous factory defaults if needed
     */
    public static getGlobalSettings(): CampaignSettings {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) return CampaignSettingsSchema.parse(JSON.parse(stored));
        } catch { }
        return { ...this.DEFAULT_SETTINGS };
    }

    /**
     * Saves settings to both settings.json and localStorage.
     */
    public static async saveGlobalSettings(settings: CampaignSettings): Promise<void> {
        const data = JSON.stringify(settings, null, 2);

        // 1. Write to local file
        try {
            await this.network.write(this.SETTINGS_FILE, data);
            console.log('[SettingsManager] settings.json updated.');
        } catch (e) {
            console.warn('[SettingsManager] Failed to write to settings.json (server might be down).', e);
        }

        // 2. Write to LocalStorage (as backup/sync)
        try {
            localStorage.setItem(this.STORAGE_KEY, data);
            console.log('[SettingsManager] LocalStorage updated.');
        } catch (e) {
            console.error('[SettingsManager] LocalStorage write failed.', e);
        }
    }

    /**
     * Merges current global settings into a target settings object.
     */
    public static syncGlobalToCampaign(campaign: CampaignSettings, global: CampaignSettings): CampaignSettings {
        return {
            ...campaign,
            video: { ...global.video },
            audio: { ...global.audio },
            gameplay: {
                ...campaign.gameplay,
                developerMode: global.gameplay.developerMode
            }
        };
    }
}
