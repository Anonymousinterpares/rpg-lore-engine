export const NPC_TRAITS = {
    PERSONALITY: [
        'Cheerful', 'Grumpy', 'Mysterious', 'Nervous', 'Arrogant',
        'Humble', 'Stoic', 'Flamboyant', 'Sarcastic', 'Naive',
        'Cynical', 'Optimistic', 'Melancholic', 'Eccentric', 'Apathetic'
    ],
    MOTIVATION: [
        'Greed (Gold)', 'Glory (Fame)', 'Knowledge (Secrets)', 'Duty (Honor)',
        'Revenge (Past)', 'Survival (Fear)', 'Power (Control)', 'Redemption (Guilt)',
        'Love (Family)', 'Boredom (Adventure)', 'Faith (Divine)', 'Chaos (Freedom)'
    ],
    QUIRKS: [
        'Stutters', 'Whispers', 'Shouts', 'Collects Bones', 'Hates Elves',
        'Loves Cats', 'Always Eating', 'Compulsive Liar', 'Superstitious',
        'Rhymes', 'Constant Fidgeting', 'Avoids Eye Contact', 'Humming'
    ],
    SOCIAL: [
        'Gossip', 'Loner', 'Leader', 'Follower', 'Diplomat',
        'Aggressive', 'Manipulative', 'Honest', 'Helpful', 'Suspicious',
        'Charismatic', 'Reclusive', 'Charming', 'Inquisitive'
    ],
    BACKGROUND: [
        'Ex-Soldier', 'Failed Wizard', 'Noble Scion', 'Escaped Convict',
        'Retired Adventurer', 'Farmer', 'Orphan', 'Cultist', 'Merchant',
        'Artisan', 'Hermit', 'Dockworker', 'Scholar', 'Mercenary'
    ],
    ALIGNMENT: [
        'Lawful', 'Chaotic', 'Good', 'Evil', 'Neutral'
    ],
    COMPETENCE: [
        'Shrewd', 'Dim-witted', 'Cunning', 'Bookish', 'Street-smart',
        'Absent-minded', 'Perceptive', 'Oblivious'
    ],
    DEMEANOR: [
        'Warm', 'Cold', 'Guarded', 'Volatile', 'Serene',
        'Anxious', 'Passionate', 'Detached'
    ]
};

export type TraitCategory = keyof typeof NPC_TRAITS;

/**
 * Structured trait with category label for richer LLM context.
 */
export interface StructuredTrait {
    category: TraitCategory;
    value: string;
}

/**
 * Trait exclusions: pairs that are genuinely nonsensical together.
 * Kept intentionally tight — unusual combos are often interesting.
 */
export const TRAIT_EXCLUSIONS: Record<string, string[]> = {
    'Naive':        ['Cynical', 'Cunning', 'Shrewd', 'Manipulative'],
    'Cynical':      ['Naive', 'Optimistic'],
    'Loner':        ['Leader', 'Gossip'],
    'Reclusive':    ['Flamboyant', 'Gossip', 'Charismatic'],
    'Lawful':       ['Chaotic'],
    'Chaotic':      ['Lawful'],
    'Honest':       ['Manipulative', 'Compulsive Liar'],
    'Compulsive Liar': ['Honest'],
    'Dim-witted':   ['Shrewd', 'Cunning', 'Bookish', 'Perceptive'],
    'Oblivious':    ['Perceptive', 'Suspicious'],
    'Detached':     ['Passionate', 'Warm'],
    'Serene':       ['Volatile', 'Anxious'],
    'Apathetic':    ['Passionate'],
};

/**
 * Role-based trait weight multipliers. Unlisted traits get weight 1.0.
 * Higher weight = more likely to be selected (not exclusive).
 */
export const ROLE_TRAIT_WEIGHTS: Record<string, Partial<Record<TraitCategory, Record<string, number>>>> = {
    'Guard': {
        BACKGROUND: { 'Ex-Soldier': 3, 'Mercenary': 2 },
        SOCIAL: { 'Leader': 2, 'Aggressive': 2, 'Suspicious': 2 },
        PERSONALITY: { 'Stoic': 2, 'Grumpy': 1.5 },
        DEMEANOR: { 'Guarded': 2, 'Cold': 1.5 }
    },
    'Merchant': {
        MOTIVATION: { 'Greed (Gold)': 3, 'Survival (Fear)': 1.5 },
        SOCIAL: { 'Charismatic': 2, 'Diplomat': 2, 'Charming': 1.5 },
        COMPETENCE: { 'Shrewd': 2.5, 'Street-smart': 2 },
        BACKGROUND: { 'Merchant': 3, 'Artisan': 1.5 }
    },
    'Hermit': {
        SOCIAL: { 'Loner': 3, 'Reclusive': 3 },
        PERSONALITY: { 'Mysterious': 2, 'Eccentric': 2 },
        BACKGROUND: { 'Hermit': 3 },
        DEMEANOR: { 'Detached': 2, 'Serene': 1.5 }
    },
    'Scholar': {
        COMPETENCE: { 'Bookish': 3, 'Shrewd': 2 },
        MOTIVATION: { 'Knowledge (Secrets)': 3 },
        BACKGROUND: { 'Scholar': 3, 'Failed Wizard': 1.5 },
        SOCIAL: { 'Inquisitive': 2 }
    },
    'Druid': {
        BACKGROUND: { 'Hermit': 2 },
        MOTIVATION: { 'Faith (Divine)': 2, 'Duty (Honor)': 1.5 },
        PERSONALITY: { 'Mysterious': 2, 'Stoic': 1.5 },
        DEMEANOR: { 'Serene': 2.5, 'Warm': 1.5 }
    },
    'Hunter': {
        COMPETENCE: { 'Perceptive': 3, 'Street-smart': 2 },
        SOCIAL: { 'Loner': 2, 'Suspicious': 1.5 },
        BACKGROUND: { 'Ex-Soldier': 1.5, 'Farmer': 1.5 },
        DEMEANOR: { 'Guarded': 2 }
    },
    'Scout': {
        COMPETENCE: { 'Perceptive': 3, 'Street-smart': 2 },
        SOCIAL: { 'Suspicious': 2, 'Inquisitive': 1.5 },
        DEMEANOR: { 'Guarded': 2, 'Anxious': 1.5 }
    },
    'Bandit': {
        ALIGNMENT: { 'Chaotic': 2, 'Evil': 1.5 },
        SOCIAL: { 'Aggressive': 3, 'Manipulative': 2 },
        MOTIVATION: { 'Greed (Gold)': 2, 'Survival (Fear)': 2 },
        BACKGROUND: { 'Escaped Convict': 2, 'Mercenary': 2 }
    },
    'Noble': {
        BACKGROUND: { 'Noble Scion': 3 },
        PERSONALITY: { 'Arrogant': 2, 'Flamboyant': 1.5 },
        SOCIAL: { 'Leader': 2, 'Diplomat': 1.5, 'Charismatic': 1.5 },
        COMPETENCE: { 'Shrewd': 2 }
    },
    'Farmer': {
        BACKGROUND: { 'Farmer': 3 },
        PERSONALITY: { 'Humble': 2, 'Stoic': 1.5 },
        SOCIAL: { 'Honest': 2, 'Helpful': 1.5 },
        DEMEANOR: { 'Warm': 2 }
    },
    'Cultist': {
        BACKGROUND: { 'Cultist': 3 },
        MOTIVATION: { 'Faith (Divine)': 2, 'Power (Control)': 2 },
        PERSONALITY: { 'Mysterious': 2, 'Eccentric': 1.5 },
        DEMEANOR: { 'Passionate': 2, 'Volatile': 1.5 }
    },
    'Miner': {
        BACKGROUND: { 'Dockworker': 2, 'Artisan': 1.5 },
        PERSONALITY: { 'Grumpy': 1.5, 'Stoic': 1.5 },
        SOCIAL: { 'Honest': 1.5 },
        COMPETENCE: { 'Street-smart': 2 }
    },
    'Traveler': {
        MOTIVATION: { 'Boredom (Adventure)': 2, 'Knowledge (Secrets)': 1.5 },
        SOCIAL: { 'Charismatic': 1.5, 'Inquisitive': 2 },
        BACKGROUND: { 'Retired Adventurer': 2 }
    },
    'Beggar': {
        MOTIVATION: { 'Survival (Fear)': 3, 'Redemption (Guilt)': 1.5 },
        SOCIAL: { 'Manipulative': 1.5, 'Helpful': 1.5 },
        BACKGROUND: { 'Orphan': 2, 'Escaped Convict': 1.5 },
        DEMEANOR: { 'Anxious': 2 }
    }
};

/**
 * Role-based stat modifiers. Applied as offsets to base 10.
 */
export const ROLE_STAT_MODIFIERS: Record<string, Partial<Record<string, number>>> = {
    'Guard':     { STR: 3, CON: 2, CHA: -1 },
    'Merchant':  { CHA: 3, WIS: 1, STR: -1 },
    'Scholar':   { INT: 4, WIS: 2, STR: -2 },
    'Druid':     { WIS: 3, CON: 1, CHA: -1 },
    'Hunter':    { DEX: 3, WIS: 2, CHA: -2 },
    'Scout':     { DEX: 3, WIS: 2, INT: 1, STR: -1 },
    'Noble':     { CHA: 3, INT: 1, CON: -1 },
    'Farmer':    { CON: 2, STR: 2, INT: -2 },
    'Bandit':    { DEX: 2, STR: 1, WIS: -1 },
    'Hermit':    { WIS: 3, INT: 1, CHA: -2 },
    'Miner':     { STR: 3, CON: 2, CHA: -2 },
    'Cultist':   { CHA: 2, WIS: 1, CON: -1 },
    'Beggar':    { DEX: 1, WIS: 1, STR: -2 },
    'Traveler':  { CON: 1, WIS: 1 },
    'Citizen':   {},
    'Fisherman': { CON: 2, STR: 1, INT: -1 },
    'Sailor':    { STR: 2, DEX: 1, INT: -1 },
    'Nomad':     { CON: 2, WIS: 2, CHA: -1 },
    'Explorer':  { DEX: 2, INT: 1, WIS: 1 },
};

/**
 * Expanded NPC name pools with cultural influence.
 */
export const NPC_NAME_POOLS = {
    HUMAN_COMMON: {
        first: [
            'Alaric', 'Bryn', 'Caelum', 'Dara', 'Elowen', 'Fenton', 'Garrick', 'Halia',
            'Ivor', 'Janna', 'Kael', 'Lyra', 'Mira', 'Nolan', 'Orin', 'Petra',
            'Quinn', 'Rowan', 'Selene', 'Theron', 'Una', 'Valen', 'Wren', 'Xara',
            'Yorick', 'Zara', 'Aldric', 'Breta', 'Corwin', 'Dessa', 'Edric', 'Fiora',
            'Gwen', 'Hollis', 'Iona', 'Jasper', 'Kira', 'Leander'
        ],
        last: [
            'Shadowstep', 'Ironfoot', 'Oakheart', 'Silvervein', 'Brightwood', 'Stormborn',
            'Thornbusk', 'Ashford', 'Blackthorn', 'Copperfield', 'Dunmere', 'Eldergrove',
            'Fairwind', 'Greycloak', 'Hartwell', 'Inkwell', 'Kingsley', 'Larkwood',
            'Millstone', 'Nighthollow', 'Oakridge', 'Pennywhistle', 'Ravencrest', 'Stonegate',
            'Thistledown', 'Underhill', 'Vex', 'Windermere', 'Yarrow', 'Zimmer'
        ]
    },
    ELVEN: {
        first: [
            'Aelindra', 'Caladrel', 'Elessar', 'Faelith', 'Galathil', 'Ilyana',
            'Kethraniel', 'Lirael', 'Miriel', 'Naevys', 'Oreleth', 'Sylvaris',
            'Thalion', 'Vaelora', 'Yrendil'
        ],
        last: [
            'Moonwhisper', 'Starweaver', 'Windwalker', 'Leafsong', 'Dawnbringer',
            'Nightbloom', 'Silverstream', 'Thornveil', 'Sunshadow', 'Mistwalker'
        ]
    },
    DWARVEN: {
        first: [
            'Brummir', 'Dolgrin', 'Gundrak', 'Harbek', 'Kildrak', 'Morgran',
            'Rurik', 'Tordek', 'Vondal', 'Adrik', 'Brottor', 'Duergin',
            'Helga', 'Kathra', 'Mardred'
        ],
        last: [
            'Anvilstrike', 'Boulderback', 'Coppervein', 'Deepdelver', 'Fireforge',
            'Goldbeard', 'Hammerfall', 'Ironhelm', 'Orebreaker', 'Stonefist'
        ]
    },
    ROUGH: {
        first: [
            'Grix', 'Skar', 'Vex', 'Rot', 'Mog', 'Nyx',
            'Slag', 'Blight', 'Fang', 'Raze', 'Cinder', 'Murk'
        ],
        last: [
            'Bonecrusher', 'Goreclaw', 'Skulltaker', 'Bloodmaw', 'Rotgut',
            'Blightfinger', 'Snarl', 'Gutripper', 'Ashbane', 'Vilehand'
        ]
    }
};

/**
 * Maps biome types to preferred name culture pools.
 */
export const BIOME_NAME_CULTURE: Record<string, (keyof typeof NPC_NAME_POOLS)[]> = {
    'Urban':        ['HUMAN_COMMON', 'ELVEN', 'DWARVEN'],
    'Farmland':     ['HUMAN_COMMON'],
    'Plains':       ['HUMAN_COMMON'],
    'Forest':       ['ELVEN', 'HUMAN_COMMON'],
    'Jungle':       ['HUMAN_COMMON', 'ELVEN'],
    'Hills':        ['DWARVEN', 'HUMAN_COMMON'],
    'Mountains':    ['DWARVEN', 'HUMAN_COMMON'],
    'Mountain_High':['DWARVEN'],
    'Coast':        ['HUMAN_COMMON'],
    'Coast_Cold':   ['HUMAN_COMMON', 'DWARVEN'],
    'Coast_Desert': ['HUMAN_COMMON'],
    'Ocean':        ['HUMAN_COMMON'],
    'Swamp':        ['ROUGH', 'HUMAN_COMMON'],
    'Desert':       ['HUMAN_COMMON'],
    'Tundra':       ['DWARVEN', 'HUMAN_COMMON'],
    'Volcanic':     ['ROUGH', 'DWARVEN'],
    'Ruins':        ['ROUGH', 'HUMAN_COMMON'],
};

/**
 * Looks up which category a trait value belongs to.
 * Returns undefined if not found.
 */
export function findTraitCategory(traitValue: string): TraitCategory | undefined {
    for (const [category, values] of Object.entries(NPC_TRAITS)) {
        if (values.includes(traitValue)) return category as TraitCategory;
    }
    return undefined;
}

/**
 * Formats an array of structured traits into labeled lines for LLM prompts.
 * Example: "PERSONALITY: Cheerful\nBACKGROUND: Ex-Soldier\nSOCIAL: Gossip"
 */
export function formatTraitsForPrompt(traits: StructuredTrait[]): string {
    return traits.map(t => `${t.category}: ${t.value}`).join('\n');
}

/**
 * Converts a flat string[] of trait values to StructuredTrait[] by looking up categories.
 * Faction traits (not in registry) are labeled as 'FACTION'.
 */
export function toStructuredTraits(flatTraits: string[]): StructuredTrait[] {
    return flatTraits.map(value => ({
        category: findTraitCategory(value) || 'FACTION' as any,
        value
    }));
}
