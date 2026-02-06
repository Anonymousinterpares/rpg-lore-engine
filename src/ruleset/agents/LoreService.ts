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
