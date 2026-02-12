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
    ]
};

export type TraitCategory = keyof typeof NPC_TRAITS;
