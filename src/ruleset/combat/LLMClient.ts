import { LLMProviderConfig, ModelConfig } from '../schemas/LLMProviderSchema';

export interface TestResult {
    success: boolean;
    message: string;
    latencyMs?: number;
}

export class LLMClient {
    private static STORAGE_KEY = 'rpg_llm_api_keys';

    /**
     * Resolves the API key for a given provider based on environment.
     */
    public static async getApiKey(provider: LLMProviderConfig): Promise<string | null> {
        // 1. Check LocalStorage (Browser)
        const browserKeys = localStorage.getItem(this.STORAGE_KEY);
        if (browserKeys) {
            const keys = JSON.parse(browserKeys);
            if (keys[provider.id]) return keys[provider.id];
        }

        // 2. Check Environment Variables (Node/Vite)
        // Vite shims process.env in our config
        const envKey = (process.env as any)[provider.apiKeyEnvVar];
        if (envKey) return envKey;

        return null;
    }

    /**
     * Saves an API key to LocalStorage.
     */
    public static setApiKey(providerId: string, apiKey: string) {
        const browserKeys = localStorage.getItem(this.STORAGE_KEY);
        const keys = browserKeys ? JSON.parse(browserKeys) : {};
        keys[providerId] = apiKey;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keys));
    }

    /**
     * Tests the connection to an LLM provider.
     */
    public static async testConnection(provider: LLMProviderConfig, model: ModelConfig): Promise<TestResult> {
        const apiKey = await this.getApiKey(provider);
        if (!apiKey) return { success: false, message: 'API key not found.' };

        const startTime = Date.now();
        try {
            // Minimal "Hello" request
            let url = provider.baseUrl;
            let headers: any = { 'Content-Type': 'application/json' };
            let body: any = {};

            if (provider.id === 'gemini') {
                url = `${provider.baseUrl}/models/${model.apiName}:generateContent?key=${apiKey}`;
                body = { contents: [{ parts: [{ text: 'Hello' }] }] };
            } else {
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: model.apiName,
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 5
                };
                if (provider.id === 'openai') {
                    url = `${provider.baseUrl}/chat/completions`;
                } else if (provider.id === 'anthropic') {
                    url = `${provider.baseUrl}/messages`;
                    headers['x-api-key'] = apiKey;
                    headers['anthropic-version'] = '2023-06-01';
                }
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    message: `API Error (${response.status}): ${errorData.error?.message || response.statusText}`
                };
            }

            return {
                success: true,
                message: 'Connection successful!',
                latencyMs: Date.now() - startTime
            };
        } catch (e: any) {
            return { success: false, message: `Network Error: ${e.message}` };
        }
    }
}
