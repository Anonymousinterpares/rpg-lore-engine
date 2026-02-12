import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { NPC_TRAITS } from '../data/TraitRegistry';
import { v4 as uuidv4 } from 'uuid';

export class NPCFactory {
    /**
     * Generates a persistent NPC with 2-3 randomized traits.
     */
    public static createNPC(name: string, isMerchant: boolean = false): WorldNPC {
        const traits: string[] = [];

        // Select 2-3 traits from different categories
        const categories = Object.keys(NPC_TRAITS) as (keyof typeof NPC_TRAITS)[];
        const count = Math.floor(Math.random() * 2) + 2; // 2 or 3

        const shuffled = categories.sort(() => 0.5 - Math.random());
        for (let i = 0; i < count; i++) {
            const cat = shuffled[i];
            const tray = NPC_TRAITS[cat];
            const trait = tray[Math.floor(Math.random() * tray.length)];
            traits.push(trait);
        }

        return {
            id: uuidv4(),
            name,
            traits,
            isMerchant,
            relationship: {
                standing: 0,
                interactionLog: []
            },
            dialogue_triggers: [],
            inventory: [],
            conversationHistory: []
        };
    }

    /**
     * Generates a commoner NPC with a random name (placeholder logic).
     */
    public static generateRandomNPC(role: string): WorldNPC {
        const names = ['Eldric', 'Lyra', 'Gareth', 'Kaelen', 'Mira', 'Bram', 'Rowan', 'Sariel'];
        const name = names[Math.floor(Math.random() * names.length)];
        return this.createNPC(`${name} (${role})`);
    }
}
