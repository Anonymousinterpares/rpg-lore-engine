import { z } from 'zod';
import { PlayerCharacterSchema } from './PlayerCharacterSchema';

export const CompanionMetaSchema = z.object({
    sourceNpcId: z.string(),                     // Original WorldNPC ID for dismiss/restore
    followState: z.enum(['following', 'waiting']).default('following'),
    waitHexId: z.string().optional(),            // Hex where companion is waiting
    recruitedAtTurn: z.number(),
    recruitmentCost: z.number().default(0),      // Gold paid to recruit
    originalRole: z.string().optional(),         // NPC role before recruitment (Guard, Scholar, etc.)
    originalTraits: z.array(z.string()).default([]), // Preserved for personality continuity
    originalFactionId: z.string().optional(),
    // Persistent conversation history — survives across talk sessions and saves
    conversationHistory: z.array(z.object({
        speaker: z.string(),
        text: z.string(),
        timestamp: z.string()
    })).default([]),
});

export const CompanionSchema = z.object({
    character: PlayerCharacterSchema,
    meta: CompanionMetaSchema,
});

export type CompanionMeta = z.infer<typeof CompanionMetaSchema>;
export type Companion = z.infer<typeof CompanionSchema>;

/**
 * Party configuration constants.
 * MAX_PARTY_SIZE controls the companion limit — change this single value to expand.
 */
export const MAX_PARTY_SIZE = 3;

/**
 * Gold cost calculation for recruiting an NPC.
 *
 * Base cost by role:
 *   Mercenary/Guard/Bandit = 50gp (they expect pay)
 *   Merchant = 100gp (leaving their livelihood)
 *   Scholar/Druid/Hermit = 0gp (motivated by knowledge/duty)
 *   Others = 25gp (general compensation)
 *
 * Modifiers:
 *   - Standing discount: -10% per 10 standing above threshold (10)
 *   - Standing 50+: half price
 *   - Standing 75+: free (true loyalty)
 *   - Faction discount: -25% if player has good faction standing
 *   - Level premium: +10gp per NPC effective level above 1
 */
export function calculateRecruitmentCost(
    role: string | undefined,
    standing: number,
    npcLevel: number,
    hasFactionDiscount: boolean
): number {
    // Base cost by role
    const ROLE_COSTS: Record<string, number> = {
        'Guard': 50, 'Mercenary': 50, 'Bandit': 50,
        'Merchant': 100,
        'Scholar': 0, 'Druid': 0, 'Hermit': 0, 'Monk': 0,
        'Farmer': 10, 'Miner': 20, 'Fisherman': 15,
        'Noble': 0, // Can't be bought — joins for political reasons
    };

    let baseCost = ROLE_COSTS[role || ''] ?? 25;

    // Level premium
    baseCost += Math.max(0, (npcLevel - 1)) * 10;

    // Standing discount
    if (standing >= 75) return 0;     // True loyalty
    if (standing >= 50) baseCost *= 0.5;
    else if (standing >= 20) {
        const discountTiers = Math.floor((standing - 10) / 10);
        baseCost *= Math.max(0.3, 1 - (discountTiers * 0.1));
    }

    // Faction discount
    if (hasFactionDiscount) baseCost *= 0.75;

    return Math.round(Math.max(0, baseCost));
}

/**
 * Role-to-class mapping for WorldNPC → PlayerCharacter conversion.
 */
export const ROLE_CLASS_MAP: Record<string, string> = {
    'Guard': 'Fighter', 'Mercenary': 'Fighter', 'Bandit': 'Rogue',
    'Scout': 'Ranger', 'Hunter': 'Ranger',
    'Scholar': 'Wizard', 'Druid': 'Druid',
    'Merchant': 'Rogue', 'Noble': 'Bard',
    'Hermit': 'Cleric', 'Monk': 'Monk',
    'Farmer': 'Fighter', 'Miner': 'Fighter',
    'Cultist': 'Warlock', 'Witch': 'Warlock',
    'Traveler': 'Bard', 'Explorer': 'Ranger',
    'Sailor': 'Fighter', 'Fisherman': 'Fighter',
    'Citizen': 'Fighter', 'Beggar': 'Rogue',
    'Archaeologist': 'Wizard', 'Nomad': 'Ranger',
    'Woodcutter': 'Fighter', 'Goatherd': 'Fighter',
    'Herder': 'Fighter', 'Prospector': 'Rogue',
    'Scavenger': 'Rogue', 'Wanderer': 'Bard',
    'Castaway': 'Fighter', 'Smuggler': 'Rogue',
};
