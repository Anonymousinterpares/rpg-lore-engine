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

        console.log(`[LLMClient] Testing connection to ${provider.id} (${model.id})...`);
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
                const isOAICompatible = provider.id === 'openai' || provider.id === 'openrouter';
                url = isOAICompatible ? `${provider.baseUrl}/chat/completions` : provider.baseUrl;
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: model.apiName,
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 5
                };
                if (provider.id === 'anthropic') {
                    url = `${provider.baseUrl}/messages`;
                    headers['x-api-key'] = apiKey;
                    headers['anthropic-version'] = '2023-06-01';
                }
            }

            console.log(`[LLMClient] Test URL: ${url.split('?')[0]}`);
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[LLMClient] Test HTTP Error ${response.status} after ${duration}ms`);
                console.error(`[LLMClient] Test Response Body: ${errorText.substring(0, 500)}`);

                try {
                    const errorData = JSON.parse(errorText);
                    return {
                        success: false,
                        message: `API Error (${response.status}): ${errorData.error?.message || response.statusText}`
                    };
                } catch {
                    return {
                        success: false,
                        message: `API Error (${response.status}): ${response.statusText} (likely HTML/404)`
                    };
                }
            }

            const data = await response.json();
            console.log(`[LLMClient] Test Success (${duration}ms).`);

            return {
                success: true,
                message: 'Connection successful!',
                latencyMs: duration
            };
        } catch (e: any) {
            console.error(`[LLMClient] Test Network Error: ${e.message}`);
            return { success: false, message: `Network Error: ${e.message}` };
        }
    }

    /**
     * Generates a completion from the LLM provider.
     */
    public static async generateCompletion(
        provider: LLMProviderConfig,
        model: ModelConfig,
        options: {
            systemPrompt: string;
            userMessage: string;
            temperature?: number;
            maxTokens?: number;
            responseFormat?: 'json' | 'text';
        }
    ): Promise<string> {
        // IMMEDIATE LOGGING - If this doesn't appear, the old cached code is running!
        console.log('======= LLMClient.generateCompletion ENTERED =======');
        console.log(`[LLMClient] Provider: ${provider.id}, baseUrl: ${provider.baseUrl}`);
        console.log(`[LLMClient] Model: ${model.id}, apiName: ${model.apiName}`);

        const apiKey = await this.getApiKey(provider);
        if (!apiKey) {
            console.error(`[LLMClient] NO API KEY FOUND for provider: ${provider.id}`);
            throw new Error(`API key for ${provider.id} not found.`);
        }
        console.log(`[LLMClient] API Key found (length: ${apiKey.length})`);

        let url = provider.baseUrl;
        let headers: any = { 'Content-Type': 'application/json' };
        let body: any = {};

        const { systemPrompt, userMessage, temperature = 0.7, maxTokens = 1000, responseFormat = 'text' } = options;

        if (provider.id === 'gemini') {
            url = `${provider.baseUrl}/models/${model.apiName}:generateContent?key=${apiKey}`;
            body = {
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                }
            };
            if (responseFormat === 'json') {
                body.generationConfig.responseMimeType = 'application/json';
            }
        } else if (provider.id === 'anthropic') {
            url = `${provider.baseUrl}/messages`;
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = {
                model: model.apiName,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
                max_tokens: maxTokens,
                temperature
            };
        } else {
            // OpenAI and OpenRouter (OpenAI compatible)
            const isOAICompatible = provider.id === 'openai' || provider.id === 'openrouter';
            url = isOAICompatible ? `${provider.baseUrl}/chat/completions` : provider.baseUrl;
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = {
                model: model.apiName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature,
                max_tokens: maxTokens
            };
            if (responseFormat === 'json') {
                body.response_format = { type: 'json_object' };
            }
        }

        console.log(`[LLMClient] Requesting ${model.id} via ${provider.id}...`);
        console.log(`[LLMClient] URL: ${url.split('?')[0]} (API Key hidden)`);

        const startTime = Date.now();
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[LLMClient] HTTP Error ${response.status} after ${duration}ms`);
            console.error(`[LLMClient] Response Body: ${errorText.substring(0, 500)}${errorText.length > 500 ? '...' : ''}`);

            try {
                const errorData = JSON.parse(errorText);
                throw new Error(`LLM API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
            } catch {
                throw new Error(`LLM API Error (${response.status}): ${response.statusText}. See console for HTML response.`);
            }
        }

        const data = await response.json();
        console.log(`[LLMClient] Success (${duration}ms). Response received.`);

        // Extract text based on provider
        let result = '';
        if (provider.id === 'gemini') {
            result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (provider.id === 'anthropic') {
            result = data.content?.[0]?.text || '';
        } else {
            // OpenAI / OpenRouter
            result = data.choices?.[0]?.message?.content || '';
        }

        console.log(`[LLMClient] Content length: ${result.length} characters.`);
        return result;
    }
}
