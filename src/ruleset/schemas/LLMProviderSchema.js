import { z } from 'zod';
export const ModelSchema = z.object({
    id: z.string(), // Internal identifier (e.g., "gemini-3-flash-preview")
    apiName: z.string(), // Actual API call name (e.g., "gemini-3-flash-preview-001")
    displayName: z.string(), // UI display name
    contextWindow: z.number(), // Max tokens
    costPer1kTokens: z.number() // For budget tracking
});
export const LLMProviderSchema = z.object({
    id: z.string(), // e.g., "gemini", "openai"
    name: z.string(), // Display name
    apiKeyEnvVar: z.string(), // e.g., "GEMINI_API_KEY"
    baseUrl: z.string(), // API endpoint
    models: z.array(ModelSchema)
});
