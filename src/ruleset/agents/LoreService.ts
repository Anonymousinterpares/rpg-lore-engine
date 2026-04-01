import { LLMClient } from '../combat/LLMClient';
import { AgentManager } from './AgentManager';
import { DataManager } from '../data/DataManager';
import { GameState } from '../schemas/FullSaveStateSchema';

export class LoreService {
    /**
     * Registers an encounter with a monster.
     * If the monster is unknown, triggers background lore generation.
     */
    public static async registerMonsterEncounter(monsterId: string, state: GameState, updateState: () => void) {
        if (!state.character.knownEntities.monsters.includes(monsterId)) {
            state.character.knownEntities.monsters.push(monsterId);
            updateState(); // Save the fact that we encountered it

            // Trigger background generation
            this.generateLore('bestiary', monsterId, state, updateState);
        }
    }

    /**
     * Registers the discovery of an item.
     * If the item is unknown, triggers background lore generation.
     */
    public static async registerItemDiscovery(itemId: string, state: GameState, updateState: () => void) {
        if (!state.character.knownEntities.items.includes(itemId)) {
            state.character.knownEntities.items.push(itemId);
            updateState();

            this.generateLore('items', itemId, state, updateState);
        }
    }

    private static async generateLore(category: 'bestiary' | 'items', entityId: string, state: GameState, updateState: () => void) {
        const agentProfile = AgentManager.getAgentProfile('LORE_KEEPER');
        if (!agentProfile) return;

        // Fetch entity data for the prompt
        let entityData: any = {};
        let entityName = entityId;

        if (category === 'bestiary') {
            // Bestiary entries often come from a monster DB or narrative context
            // For now, we'll try to get it from DataManager if it exists there, 
            // or use the ID as a name to speculate.
            entityData = { id: entityId, type: 'Monster' };
            entityName = entityId.replace(/_/g, ' ');
        } else {
            const item = DataManager.getItem(entityId);
            if (item) {
                entityData = item;
                entityName = item.name;
            }
        }

        const prompt = this.buildPrompt(category, entityName, entityData);

        console.log(`[LoreService] Generating ${category} lore for: ${entityName}...`);

        try {
            const provider = AgentManager.getProviderForAgent(agentProfile);
            const model = AgentManager.getModelForAgent(agentProfile);

            if (!provider || !model) {
                console.error(`[LoreService] No provider/model found for agent: ${agentProfile.id}`);
                return;
            }

            const response = await LLMClient.generateCompletion(
                provider,
                model,
                {
                    systemPrompt: agentProfile.basePrompt || 'You are a scholarly chronicler of fantasy lore.',
                    userMessage: prompt,
                    temperature: agentProfile.temperature,
                    maxTokens: agentProfile.maxTokens,
                    responseFormat: 'json'
                }
            );

            const result = JSON.parse(response);

            // Create the codex entry
            const newEntry = {
                id: crypto.randomUUID(),
                category,
                entityId,
                title: result.title || entityName,
                content: result.content || result.description || "Historical records are silent on this matter.",
                isNew: true,
                discoveredAt: state.worldTime.totalTurns || 0
            };

            // Update state
            state.codexEntries.push(newEntry);

            // Add notification
            state.notifications.push({
                id: crypto.randomUUID(),
                type: 'CODEX_ENTRY',
                message: `New codex entry created: ${newEntry.title}`,
                data: { category, entityId: newEntry.id },
                isRead: false,
                createdAt: Date.now()
            });

            console.log(`[LoreService] Successfully generated lore for: ${entityName}`);
            updateState();

        } catch (error) {
            console.error(`[LoreService] Failed to generate lore for ${entityName}:`, error);
        }
    }

    /**
     * Generates an immersive narrative for a successful item identification.
     * Describes the examination experience, what the character discovers, and the item's history.
     */
    public static async generateIdentificationNarrative(
        item: any,
        characterName: string,
        skillUsed: string,
    ): Promise<string> {
        const agentProfile = AgentManager.getAgentProfile('LORE_KEEPER');
        if (!agentProfile) return '';

        const provider = AgentManager.getProviderForAgent(agentProfile);
        const model = AgentManager.getModelForAgent(agentProfile);
        if (!provider || !model) return '';

        const magicDesc = (item.magicalProperties || [])
            .map((p: any) => p.description || `${p.element || ''} ${p.type}`.trim())
            .filter(Boolean).join(', ');

        const modDesc = (item.modifiers || [])
            .map((m: any) => `+${m.value} ${m.target} (${m.type})`)
            .join(', ');

        const prompt = `${characterName} examines a mysterious item using their ${skillUsed} skill. Write an immersive 3-5 sentence narrative describing:
1. The examination process (arcane runes glowing, magical auras revealing themselves, etc.)
2. The moment of revelation — the item's true identity
3. What was discovered about the item's history and power

Item details:
- True name: "${item.name}"
- True rarity: ${item.rarity}
- Type: ${item.type}
${modDesc ? `- Bonuses: ${modDesc}` : ''}
${magicDesc ? `- Magical properties: ${magicDesc}` : ''}
${item.forgeSource ? `- Origin: ${item.forgeSource}` : ''}

Write ONLY the narrative. No dice rolls, no mechanical numbers, no game terms like "DC" or "check". Pure immersive storytelling.`;

        try {
            const response = await LLMClient.generateCompletion(provider, model, {
                systemPrompt: 'You are a D&D narrator. Write immersive item identification scenes. Plain text only, no JSON, no markdown headers.',
                userMessage: prompt,
                temperature: 0.8,
                maxTokens: 400,
                responseFormat: 'text'
            });
            return response.trim();
        } catch {
            return '';
        }
    }

    /**
     * Generates a brief narrative for a failed item identification attempt.
     */
    public static async generateIdentificationFailure(
        characterName: string,
        skillUsed: string,
        itemPerceivedName: string,
    ): Promise<string> {
        const agentProfile = AgentManager.getAgentProfile('LORE_KEEPER');
        if (!agentProfile) return '';

        const provider = AgentManager.getProviderForAgent(agentProfile);
        const model = AgentManager.getModelForAgent(agentProfile);
        if (!provider || !model) return '';

        try {
            const response = await LLMClient.generateCompletion(provider, model, {
                systemPrompt: 'You are a D&D narrator. Write a brief failure scene. Plain text, 2-3 sentences max.',
                userMessage: `${characterName} attempts to examine "${itemPerceivedName}" using ${skillUsed}, but fails to uncover its secrets. Describe the failed attempt immersively. End by noting they may try again after resting. No dice rolls or game mechanics.`,
                temperature: 0.8,
                maxTokens: 300,
                responseFormat: 'text'
            });
            return response.trim();
        } catch {
            return '';
        }
    }

    /**
     * Generates an evocative name and description for a forged item via LLM.
     * Non-blocking: returns default values if LLM fails or is unavailable.
     */
    public static async nameForgedItem(item: any, context: { monsterName: string; biome: string }): Promise<{ name: string; description: string }> {
        const defaultName = item.name;
        const defaultDesc = item.description || '';

        const agentProfile = AgentManager.getAgentProfile('LORE_KEEPER');
        if (!agentProfile) return { name: defaultName, description: defaultDesc };

        const provider = AgentManager.getProviderForAgent(agentProfile);
        const model = AgentManager.getModelForAgent(agentProfile);
        if (!provider || !model) return { name: defaultName, description: defaultDesc };

        const magicDesc = (item.magicalProperties || [])
            .map((p: any) => `${p.dice || ''} ${p.element || ''} ${p.type}`.trim())
            .filter(Boolean)
            .join(', ');

        const prompt = `Generate a name and 1-2 sentence description for this D&D 5e item:
- Base item: ${item.id || item.name}
- Rarity: ${item.rarity}
- Magical: ${item.isMagic ? 'Yes' : 'No'}
${magicDesc ? `- Magical properties: ${magicDesc}` : ''}
- Dropped by: ${context.monsterName} in ${context.biome}

Respond with ONLY valid JSON: { "name": "...", "description": "..." }
The name should be evocative and fitting for the rarity (${item.rarity}).
Do NOT alter stats. You are ONLY naming and describing.`;

        try {
            console.log(`[LoreService] Naming forged item: ${defaultName}...`);
            const response = await LLMClient.generateCompletion(
                provider,
                model,
                {
                    systemPrompt: 'You are a legendary artificer and namer of enchanted weapons and armor.',
                    userMessage: prompt,
                    temperature: 0.9,
                    maxTokens: 600,
                    responseFormat: 'json'
                }
            );

            // Clean response: strip markdown wrappers, extract JSON
            let cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) cleaned = jsonMatch[0];

            const result = JSON.parse(cleaned);
            const name = result.name || defaultName;
            const description = result.description || defaultDesc;
            console.log(`[LoreService] Named: "${defaultName}" → "${name}"`);
            return { name, description };
        } catch (e) {
            console.warn(`[LoreService] Item naming failed for ${defaultName}:`, e);
            return { name: defaultName, description: defaultDesc };
        }
    }

    private static buildPrompt(category: string, name: string, data: any): string {
        const base = `You are the Lore Keeper, a weathered scholar and chronicler of the realms.
Your task is to write a rich, immersive Codex entry for the following ${category === 'bestiary' ? 'creature' : 'item'}: "${name}".

${category === 'bestiary' ? `
Consider its physicality, potential biology, rumored ecology, and common myths associated with it. 
Write as if for a Monster Manual, providing both factual speculation and a "flavor" quote from an adventurer who survived an encounter.
` : `
Consider its history, craftsmanship, material properties, and legendary owners.
Write as if for a compendium of artifacts, including its cultural significance and a whisper of its secret potential.
`}

DATA CONTEXT:
${JSON.stringify(data, null, 2)}

OUTPUT FORMAT (JSON):
{
    "title": "A grand or evocative title for the entry",
"content": "The full entry in clean, immersive text. Do NOT use # or ## headers. Use ### for major sections if absolutely necessary, but prefer bolding for labels. Do not use markdown code blocks. Keep the tone in-universe."
}

Do not include any text outside the JSON block.`;
        return base;
    }
}
