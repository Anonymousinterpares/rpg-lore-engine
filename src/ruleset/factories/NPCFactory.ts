import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { NPC_TRAITS } from '../data/TraitRegistry';
import { SPAWN_TABLES } from '../data/SpawnTables';
import { BiomeType } from '../schemas/BiomeSchema';
import { v4 as uuidv4 } from 'uuid';

export class NPCFactory {
    /**
     * Generates a persistent NPC with 2-3 randomized traits, a specific role, and optional faction.
     */
    public static createNPC(name: string, isMerchant: boolean = false, factionId?: string, role?: string): WorldNPC {
        const traits: string[] = [];

        // Add faction-specific trait if applicable
        if (factionId) {
            if (factionId === 'harpers') traits.push('Harper Agent');
            if (factionId === 'zhentarim') traits.push('Zhentarim Mercenary');
            if (factionId === 'emerald_enclave') traits.push('Nature Guardian');
            if (factionId === 'order_gauntlet') traits.push('Holy Vindicator');
            if (factionId === 'lords_alliance') traits.push('Alliance Loyalist');
        }

        // Select 2-3 traits from different categories
        const categories = Object.keys(NPC_TRAITS) as (keyof typeof NPC_TRAITS)[];
        const count = Math.floor(Math.random() * 2) + 2; // 2 or 3

        const shuffled = categories.sort(() => 0.5 - Math.random());
        for (let i = 0; i < count; i++) {
            const cat = shuffled[i];
            const tray = NPC_TRAITS[cat];
            const trait = tray[Math.floor(Math.random() * tray.length)];
            if (!traits.includes(trait)) {
                traits.push(trait);
            }
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
            dialogue_triggers: [] as string[],
            inventory: [] as { id: string, quantity: number }[],
            conversationHistory: [] as { speaker: string, text: string, timestamp: string }[],
            factionId,
            role,
            stats: {
                'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10
            }
        };
    }

    /**
     * Generates a fully randomized NPC based on a Biome.
     */
    public static generateRandomNPC(biome: BiomeType): WorldNPC {
        const config = SPAWN_TABLES[biome] || { roles: ['Traveler'], chance: 0.1 };
        const role = config.roles[Math.floor(Math.random() * config.roles.length)];
        const isMerchant = role === 'Merchant';

        // 50% chance to belong to the dominant faction of the biome if one exists
        const factionId = (config.dominantFaction && Math.random() < 0.5) ? config.dominantFaction : undefined;

        const firstNames = ['Alaric', 'Bryn', 'Caelum', 'Dara', 'Elowen', 'Fenton', 'Garrick', 'Halia', 'Ivor', 'Janna'];
        const lastNames = ['Shadowstep', 'Ironfoot', 'Oakheart', 'Silvervein', 'Brightwood', 'Stormborn', 'Thornbusk'];
        const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

        return this.createNPC(name, isMerchant, factionId, role);
    }
}
