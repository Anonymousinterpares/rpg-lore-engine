import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import {
    NPC_TRAITS, TraitCategory, StructuredTrait,
    TRAIT_EXCLUSIONS, ROLE_TRAIT_WEIGHTS, ROLE_STAT_MODIFIERS,
    NPC_NAME_POOLS, BIOME_NAME_CULTURE
} from '../data/TraitRegistry';
import { SPAWN_TABLES } from '../data/SpawnTables';
import { BiomeType } from '../schemas/BiomeSchema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fisher-Yates shuffle — unbiased random ordering.
 */
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Weighted random selection from a trait pool.
 * If role weights exist for this category, traits with higher weight are more likely.
 * All traits remain possible (minimum weight 1.0).
 */
function weightedPick(pool: string[], role: string | undefined, category: TraitCategory): string {
    const weights = role ? ROLE_TRAIT_WEIGHTS[role]?.[category] : undefined;
    if (!weights) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    const weighted = pool.map(trait => ({
        trait,
        weight: weights[trait] || 1.0
    }));

    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const { trait, weight } of weighted) {
        roll -= weight;
        if (roll <= 0) return trait;
    }

    return pool[pool.length - 1]; // fallback
}

/**
 * Checks if a trait is excluded by any already-selected trait.
 */
function isExcluded(candidate: string, selectedTraits: string[]): boolean {
    for (const existing of selectedTraits) {
        const exclusions = TRAIT_EXCLUSIONS[existing];
        if (exclusions && exclusions.includes(candidate)) return true;
    }
    // Also check reverse
    const candidateExclusions = TRAIT_EXCLUSIONS[candidate];
    if (candidateExclusions) {
        for (const existing of selectedTraits) {
            if (candidateExclusions.includes(existing)) return true;
        }
    }
    return false;
}

export class NPCFactory {
    /**
     * Generates a persistent NPC with 4-6 structured traits, role-influenced stats, and optional faction.
     *
     * Trait selection:
     * - Required (1 each): PERSONALITY, MOTIVATION, SOCIAL, BACKGROUND
     * - Optional (50% each): QUIRKS, ALIGNMENT
     * - Optional (25% each): COMPETENCE, DEMEANOR
     * - Faction trait prepended if applicable
     * - Contradiction prevention via TRAIT_EXCLUSIONS
     * - Role-based weighted selection via ROLE_TRAIT_WEIGHTS
     */
    public static createNPC(name: string, isMerchant: boolean = false, factionId?: string, role?: string): WorldNPC {
        const traitValues: string[] = [];

        // Add faction-specific trait if applicable
        if (factionId) {
            const FACTION_TRAITS: Record<string, string> = {
                'harpers': 'Harper Agent',
                'zhentarim': 'Zhentarim Mercenary',
                'emerald_enclave': 'Nature Guardian',
                'order_gauntlet': 'Holy Vindicator',
                'lords_alliance': 'Alliance Loyalist'
            };
            if (FACTION_TRAITS[factionId]) {
                traitValues.push(FACTION_TRAITS[factionId]);
            }
        }

        // Required categories — always pick 1 from each
        const requiredCategories: TraitCategory[] = ['PERSONALITY', 'MOTIVATION', 'SOCIAL', 'BACKGROUND'];

        // Optional categories with their selection probability
        const optionalCategories: { cat: TraitCategory; chance: number }[] = [
            { cat: 'QUIRKS', chance: 0.50 },
            { cat: 'ALIGNMENT', chance: 0.50 },
            { cat: 'COMPETENCE', chance: 0.25 },
            { cat: 'DEMEANOR', chance: 0.25 },
        ];

        // Select from required categories
        for (const cat of requiredCategories) {
            const pool = NPC_TRAITS[cat];
            let attempts = 0;
            let picked: string | null = null;

            while (attempts < 10) {
                const candidate = weightedPick(pool, role, cat);
                if (!isExcluded(candidate, traitValues) && !traitValues.includes(candidate)) {
                    picked = candidate;
                    break;
                }
                attempts++;
            }

            if (picked) traitValues.push(picked);
        }

        // Select from optional categories based on chance
        for (const { cat, chance } of optionalCategories) {
            if (Math.random() < chance) {
                const pool = NPC_TRAITS[cat];
                let attempts = 0;

                while (attempts < 10) {
                    const candidate = weightedPick(pool, role, cat);
                    if (!isExcluded(candidate, traitValues) && !traitValues.includes(candidate)) {
                        traitValues.push(candidate);
                        break;
                    }
                    attempts++;
                }
            }
        }

        // Generate role-influenced stats
        const baseStats: Record<string, number> = {
            'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10
        };
        const modifiers = (role ? ROLE_STAT_MODIFIERS[role] : undefined) || {};
        for (const [stat, mod] of Object.entries(modifiers)) {
            if (typeof mod === 'number') {
                baseStats[stat] = Math.max(3, Math.min(20, baseStats[stat] + mod));
            }
        }
        // Add small random variation (-2 to +2)
        for (const stat of Object.keys(baseStats)) {
            baseStats[stat] = Math.max(3, Math.min(20, baseStats[stat] + Math.floor(Math.random() * 5) - 2));
        }

        return {
            id: uuidv4(),
            name,
            traits: traitValues,
            isMerchant,
            relationship: {
                standing: 0,
                interactionLog: []
            },
            dialogue_triggers: [] as string[],
            inventory: [] as { id: string, quantity: number }[],
            availableQuests: [] as string[],
            conversationHistory: [] as { speaker: string, text: string, timestamp: string }[],
            factionId,
            role,
            stats: baseStats as any
        };
    }

    /**
     * Generates a fully randomized NPC based on a Biome, with culture-influenced naming.
     * Includes deduplication against existing world NPCs.
     */
    public static generateRandomNPC(biome: BiomeType, existingNpcs?: { name: string }[]): WorldNPC {
        const config = SPAWN_TABLES[biome] || { roles: ['Traveler'], chance: 0.1 };
        const role = config.roles[Math.floor(Math.random() * config.roles.length)];
        const isMerchant = role === 'Merchant';

        // 50% chance to belong to the dominant faction of the biome
        const factionId = (config.dominantFaction && Math.random() < 0.5) ? config.dominantFaction : undefined;

        // Culture-influenced name generation with deduplication
        const name = this.generateName(biome, existingNpcs);

        return this.createNPC(name, isMerchant, factionId, role);
    }

    /**
     * Generates a culture-influenced name based on biome, with deduplication.
     */
    private static generateName(biome: BiomeType, existingNpcs?: { name: string }[]): string {
        const cultures = BIOME_NAME_CULTURE[biome] || ['HUMAN_COMMON'];
        const culture = cultures[Math.floor(Math.random() * cultures.length)];
        const pool = NPC_NAME_POOLS[culture];

        const existingNames = new Set(existingNpcs?.map(n => n.name) || []);

        // Try up to 20 times to generate a unique name
        for (let attempt = 0; attempt < 20; attempt++) {
            const first = pool.first[Math.floor(Math.random() * pool.first.length)];
            const last = pool.last[Math.floor(Math.random() * pool.last.length)];
            const fullName = `${first} ${last}`;

            if (!existingNames.has(fullName)) {
                return fullName;
            }
        }

        // Fallback: append a number suffix
        const first = pool.first[Math.floor(Math.random() * pool.first.length)];
        const last = pool.last[Math.floor(Math.random() * pool.last.length)];
        return `${first} ${last} the ${Math.floor(Math.random() * 100)}th`;
    }
}
