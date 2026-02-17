import { FACTION_LORE } from './FactionRegistry';

export const CODEX_LORE = {
    WORLD: {
        [FACTION_LORE.HARPERS.id]: {
            name: FACTION_LORE.HARPERS.name,
            content: `### The Harpers\n${FACTION_LORE.HARPERS.description}\n\n**Motto:** ${FACTION_LORE.HARPERS.motto}\n**Goals:** ${FACTION_LORE.HARPERS.goals}\n**Alignment:** ${FACTION_LORE.HARPERS.alignment}\n\nThe Harpers are a decentralized organization who act in secret. They believe that too much power in the hands of one individual or group leads to corruption. They often work through bards, spies, and scholars to influence events from the shadows.`
        },
        [FACTION_LORE.ORDER_GAUNTLET.id]: {
            name: FACTION_LORE.ORDER_GAUNTLET.name,
            content: `### The Order of the Gauntlet\n${FACTION_LORE.ORDER_GAUNTLET.description}\n\n**Motto:** ${FACTION_LORE.ORDER_GAUNTLET.motto}\n**Goals:** ${FACTION_LORE.ORDER_GAUNTLET.goals}\n**Alignment:** ${FACTION_LORE.ORDER_GAUNTLET.alignment}\n\nMembers of the Order are tireless vigilantes who prioritize justice and the rule of law. They are often found on the front lines against demonic incursions or undead plagues, bonded by their faith and shared sense of duty.`
        },
        [FACTION_LORE.EMERALD_ENCLAVE.id]: {
            name: FACTION_LORE.EMERALD_ENCLAVE.name,
            content: `### The Emerald Enclave\n${FACTION_LORE.EMERALD_ENCLAVE.description}\n\n**Motto:** ${FACTION_LORE.EMERALD_ENCLAVE.motto}\n**Goals:** ${FACTION_LORE.EMERALD_ENCLAVE.goals}\n**Alignment:** ${FACTION_LORE.EMERALD_ENCLAVE.alignment}\n\nDruids, scouts, and rangers make up the bulk of this enclave. They dwell in the spaces between civilization and the wild, ensuring that neither encroaches too far upon the other. They are the first to strike out against unnatural blights and monsters.`
        },
        [FACTION_LORE.LORDS_ALLIANCE.id]: {
            name: FACTION_LORE.LORDS_ALLIANCE.name,
            content: `### The Lords' Alliance\n${FACTION_LORE.LORDS_ALLIANCE.description}\n\n**Motto:** ${FACTION_LORE.LORDS_ALLIANCE.motto}\n**Goals:** ${FACTION_LORE.LORDS_ALLIANCE.goals}\n**Alignment:** ${FACTION_LORE.LORDS_ALLIANCE.alignment}\n\nThis coalition of rulers provides common defense and economic stability. Their guards patrol the high roads, and their diplomats forge alliances that keep the realms running. While bureaucratic, they are the strongest bulwark of order in a chaotic world.`
        },
        [FACTION_LORE.ZHENTARIM.id]: {
            name: FACTION_LORE.ZHENTARIM.name,
            content: `### The Zhentarim\n${FACTION_LORE.ZHENTARIM.description}\n\n**Motto:** ${FACTION_LORE.ZHENTARIM.motto}\n**Goals:** ${FACTION_LORE.ZHENTARIM.goals}\n**Alignment:** ${FACTION_LORE.ZHENTARIM.alignment}\n\nThe "Black Network" is often feared for its ruthlessness, but they are also reliable providers of mercenary labor and high-value goods. They value loyalty and profit above all, and their influence can be felt from the highest courts to the deepest dungeons.`
        }
    },
    MECHANICS: {
        'general_abilities': {
            name: 'Abilities',
            content: `Six abilities provide a quick shorthand for a creature's physical and mental characteristics: Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma. Is a character muscle-bound and insightful? Or charismatic and dashing? Ability scores define these traits.`
        },
        'ability_str': {
            name: 'Strength',
            content: `### Strength\nStrength measures bodily power, athletic training, and the extent to which you can exert raw physical force.\n\n**Examples:**\n- Lifting, pushing, pulling, or breaking things\n- Climbing a steep cliff or clinging to a surface\n- Jumping an unusually long distance\n- Swimming in treacherous water`
        },
        'ability_dex': {
            name: 'Dexterity',
            content: `### Dexterity\nDexterity measures agility, reflexes, and balance.\n\n**Examples:**\n- Sneaking past a guard\n- Performing acrobatics or balance feats\n- Picking a lock or disarming a trap\n- Reacting quickly to a trap (Saving Throws)`
        },
        'ability_con': {
            name: 'Constitution',
            content: `### Constitution\nConstitution measures health, stamina, and vital force.\n\n**Examples:**\n- Holding your breath\n- Marching for hours without rest\n- Going without sleep\n- Resisting poison or disease (Saving Throws)`
        },
        'ability_int': {
            name: 'Intelligence',
            content: `### Intelligence\nIntelligence measures mental acuity, accuracy of recall, and the ability to reason.\n\n**Examples:**\n- Recalling lore about historical events\n- Interpreting arcane symbols\n- Investigating a room for hidden clues\n- Estimating the value of a precious item`
        },
        'ability_wis': {
            name: 'Wisdom',
            content: `### Wisdom\nWisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition.\n\n**Examples:**\n- Noticing a hidden creature (Perception)\n- Reading someone's true intentions (Insight)\n- Treating a wound (Medicine)\n- Surviving in the wilderness`
        },
        'ability_cha': {
            name: 'Charisma',
            content: `### Charisma\nCharisma measures your ability to interact effectively with others. It includes such factors as confidence and eloquence.\n\n**Examples:**\n- Persuading a guard to let you pass\n- Lying convincingly to a merchant\n- Intimidating a rival\n- Performing for a crowd`
        },
        'general_saving_throws': {
            name: 'Saving Throws',
            content: `### Saving Throws\nA saving throw—also called a save—represents an attempt to resist a spell, a trap, a poison, a disease, or a similar threat. You don't normally decide to make a saving throw; you are forced to make one because your character or monster is at risk of harm.`
        },
        'general_skills': {
            name: 'Skills',
            content: `### Skills\nEach ability covers a broad range of capabilities, including skills that a character or a monster can be proficient in. A proficiency in a skill represents an individual's focus on one aspect of an ability, and a character's proficiency in a skill is reflected in his or her ability check.`
        },
        'combat_ac': {
            name: 'Armor Class (AC)',
            content: `### Armor Class (AC)\nYour Armor Class represents how hard it is for opponents to land a damaging blow on you. It is determined by your equipment, dexterity, and various magical or racial bonuses. An attack roll must equal or exceed your AC to hit.`
        },
        'combat_initiative': {
            name: 'Initiative',
            content: `### Initiative\nInitiative determines the order of turns during combat. When combat starts, every participant makes a Dexterity check to determine their place in the initiative order.`
        },
        'combat_speed': {
            name: 'Speed',
            content: `### Speed\nYour speed tells you how far you can move in a single turn. This is usually determined by your race and can be modified by encumbrance, spells, or features.`
        },
        'combat_hp': {
            name: 'Hit Points',
            content: `### Hit Points\nHit points represent a combination of physical and mental durability, the will to live, and luck. Creatures with more hit points are more difficult to kill. Those with fewer hit points are more fragile.`
        },
        'magic_overview': {
            name: 'Understanding Magic',
            content: `Magic is a pervasive force in the world, channeled through prayer, study, or innate talent. Spells are the primary way this power is manifested.\n\n### Cantrips\nCantrips are simple but powerful spells that you can cast at will. While they are weak compared to higher-level magic, they don't require spell slots and are always available for use.\n\n### Spell Slots\nMost spells require a burst of focused energy to manifest. This energy is represented by spell slots. You have a limited number of slots for each spell level you can cast. When you cast a spell, you expend a slot of that level or higher.\n\n### Preparation & Known Spells\nSome classes, like Wizards and Clerics, must choose a selection of spells from their wider library to have ready each day (Preparation). Others, like Sorcerers, have a fixed set of spells they always have active (Known Spells).`
        },
        'trade_system': {
            name: 'Trade & Commerce',
            content: `### Trade & Commerce

**Currency System**
The realm uses a five-tier currency system:
- **Platinum Pieces (pp)** - Worth 10 gp each. Rare, used for major transactions.
- **Gold Pieces (gp)** - Standard currency. Most prices are quoted in gold.
- **Electrum Pieces (ep)** - Worth 0.5 gp each. Uncommon, sometimes found in ancient hoards.
- **Silver Pieces (sp)** - Worth 0.1 gp each. Common for everyday goods.
- **Copper Pieces (cp)** - Worth 0.01 gp each. Used for the smallest transactions.

**Trading with Merchants**
When you encounter a merchant, you can:
- **Buy** items from their stock at market price (modified by your relationship and passive Persuasion skill)
- **Sell** items from your inventory (base rate: 50% of item value, improved by relationship)
- **Haggle** for a temporary discount using active Persuasion checks (DC 15, 24-hour cooldown on failure)
- **Intimidate** for a permanent discount via fear (risks destroying relationship)
- **Deceive** to inflate sell prices by 20% (critical failure results in being banned)
- **Buyback** items you previously sold (at original sell price, expires when you leave the hex)

**Passive Skill Benefits**
Your Charisma and Persuasion proficiency automatically reduce buy prices and increase sell prices:
- Passive Persuasion 15+: 5% discount on purchases, 5% bonus on sales
- Passive Persuasion 18+: 10% discount on purchases
- Passive Persuasion 20+: 15% discount on purchases, 10% bonus on sales

**Relationship Standing**
Your standing with NPCs affects prices:
- Hostile (< -25): +50% markup on purchases
- Neutral (0): Standard prices
- Friendly (25+): Better sell rates (60% of item value)
- Trusted (75+): Excellent sell rates (70% of item value)`
        }
    }
};
