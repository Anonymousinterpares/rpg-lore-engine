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
        },
        'time_and_calendar': {
            name: 'Time and the Harptos Calendar',
            content: `In the Forgotten Realms, time is measured by the Calendar of Harptos.\n\n### The Year\nA year consists of 365 days, divided into twelve months of thirty days each. There are also five special holidays that fall between certain months, which are not part of any month itself.\n\n### The Months (in order):\n1. **Hammer** (Deepwinter)\n2. **Alturiak** (The Claw of Winter)\n3. **Ches** (The Claw of Sunsets)\n4. **Tarsakh** (The Garden)\n5. **Mirtul** (The Melting)\n6. **Kythorn** (The Time of Flowers)\n7. **Flamerule** (Summertide)\n8. **Eleasis** (Highsun)\n9. **Eleint** (The Fading)\n10. **Marpenoth** (Leafall)\n11. **Uktar** (The Rotting)\n12. **Nightal** (The Drawing Down)\n\n### The Week: Tendays\nInstead of a seven-day week, the Harptos calendar uses a **Tenday**. A month consists of exactly three tendays. This means every month starts on the first day of a tenday and ends on the last day of the third tenday.\n\n### Special Holidays\nBetween certain months, the world celebrates major festivals:\n- **Midwinter**: Between Hammer and Alturiak.\n- **Greengrass**: Between Tarsakh and Mirtul.\n- **Midsummer**: Between Flamerule and Eleasis. (Shieldmeet occurs every 4 years after Midsummer).\n- **Higharvestide**: Between Eleint and Marpenoth.\n- **The Feast of the Moon**: Between Uktar and Nightal.\n\nTime of day is generally measured by the bells and the position of the sun, with most folk being active between dawn and dusk.`
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
        'combat_modifiers': {
            name: 'Combat Modifiers',
            content: `### Combat Modifiers & Dice Math\n\nWhen you attack, the 20-sided die (d20) roll is modified by several factors to determine your final result against the enemy's Armor Class (AC).\n\n**Common Modifiers:**\n- **Stat (STR/DEX):** Your base physical power or agility. Melee uses Strength; Ranged uses Dexterity (unless Finesse).\n- **Proficiency:** A bonus added if you are trained in the weapon type.\n- **Weapon:** Magical weapons or masterwork items grant innate bonuses to hit.\n- **Range:** Shooting beyond a weapon's 'Normal Range' imposes a cumulative -2 penalty for every distance increment.`
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
    },
    SKILLS: {
        'acrobatics': {
            name: 'Acrobatics',
            ability: 'DEX',
            content: `### Acrobatics\nYour Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation.`,
            examples: ["Walking across an icy surface", "Balancing on a tightrope", "Staying upright on a rocking ship's deck"]
        },
        'animal_handling': {
            name: 'Animal Handling',
            ability: 'WIS',
            content: `### Animal Handling\nWhen there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal’s intentions, the GM might call for a Wisdom (Animal Handling) check.`,
            examples: ["Calming a frightened horse", "Training a hound", "Moving a stubborn ox"]
        },
        'arcana': {
            name: 'Arcana',
            ability: 'INT',
            content: `### Arcana\nYour Intelligence (Arcana) check measures your knowledge about spells, magic items, eldritch symbols, magical traditions, the planes of existence, and the inhabitants of those planes.`,
            examples: ["Recalling lore about a magic circle", "Identifying a spell being cast", "Understanding a portal's destination"]
        },
        'athletics': {
            name: 'Athletics',
            ability: 'STR',
            content: `### Athletics\nYour Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming.`,
            examples: ["Climbing a sheer cliff", "Jumping a wide chasm", "Swimming against a strong current"]
        },
        'deception': {
            name: 'Deception',
            ability: 'CHA',
            content: `### Deception\nYour Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions.`,
            examples: ["Fast-talking a guard", "Passing yourself off in a disguise", "Spreading false rumors"]
        },
        'history': {
            name: 'History',
            ability: 'INT',
            content: `### History\nYour Intelligence (History) check measures what you know about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.`,
            examples: ["Identifying an ancient ruin", "Recalling a legendary figure's deeds", "Understanding the origins of a lost artifact"]
        },
        'insight': {
            name: 'Insight',
            ability: 'WIS',
            content: `### Insight\nYour Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone’s next move.`,
            examples: ["Gauging if someone is lying", "Determining an NPC's emotional state", "Detecting a hidden message in a conversation"]
        },
        'intimidation': {
            name: 'Intimidation',
            ability: 'CHA',
            content: `### Intimidation\nWhen you attempt to influence someone through overt threats, hostile actions, and physical violence, the GM might ask you to make a Charisma (Intimidation) check.`,
            examples: ["Prying information from a prisoner", "Scaring off a group of thugs", "Using threats to get what you want"]
        },
        'investigation': {
            name: 'Investigation',
            ability: 'INT',
            content: `### Investigation\nWhen you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check.`,
            examples: ["Searching for a hidden door", "Examining a crime scene", "Deducing the contents of a complex mechanism"]
        },
        'medicine': {
            name: 'Medicine',
            ability: 'WIS',
            content: `### Medicine\nA Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness.`,
            examples: ["First aid to stop bleeding", "Identifying a disease", "Treating a poisoned wound"]
        },
        'nature': {
            name: 'Nature',
            ability: 'INT',
            content: `### Nature\nYour Intelligence (Nature) check measures your knowledge about terrain, plants and animals, the weather, and natural cycles.`,
            examples: ["Identifying a poisonous plant", "Predicting weather patterns", "Recalling lore about a wild beast"]
        },
        'perception': {
            name: 'Perception',
            ability: 'WIS',
            content: `### Perception\nYour Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something.`,
            examples: ["Hearing footsteps in a hallway", "Spotting a hidden trap", "Detecting a lurker in the shadows"]
        },
        'performance': {
            name: 'Performance',
            ability: 'CHA',
            content: `### Performance\nYour Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.`,
            examples: ["Playing a lute in a tavern", "Telling a captivating legend", "Impressing a noble with a courtly dance"]
        },
        'persuasion': {
            name: 'Persuasion',
            ability: 'CHA',
            content: `### Persuasion\nWhen you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask you to make a Charisma (Persuasion) check.`,
            examples: ["Negotiating a better price", "Convincing a king to grant an audience", "Calming a heated debate"]
        },
        'religion': {
            name: 'Religion',
            ability: 'INT',
            content: `### Religion\nYour Intelligence (Religion) check measures your knowledge about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults.`,
            examples: ["Identifying a holy symbol", "Recognizing a religious rite", "Understanding divine hierarchy"]
        },
        'sleight_of_hand': {
            name: 'Sleight of Hand',
            ability: 'DEX',
            content: `### Sleight of Hand\nWhenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, you make a Dexterity (Sleight of Hand) check.`,
            examples: ["Picking a pocket", "Palming a small object", "Performing a card trick"]
        },
        'stealth': {
            name: 'Stealth',
            ability: 'DEX',
            content: `### Stealth\nMake a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard.`,
            examples: ["Hiding in the shadows", "Creeping past a sleeping dragon", "Following someone in a crowd"]
        },
        'survival': {
            name: 'Survival',
            ability: 'WIS',
            content: `### Survival\nThe GM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict detrimental weather, or avoid quicksand and other natural hazards.`,
            examples: ["Tracking a deer", "Navigating a trackless forest", "Setting up a safe campsite"]
        },
        'cartography': {
            name: 'Cartography',
            ability: 'INT',
            content: `### Cartography\nYour Intelligence (Cartography) check measures your ability to create and read maps, and to translate the physical world into a mathematical record. It is essential for documenting infrastructure and surveying uncharted lands.`,
            examples: ["Creating a map of a dungeon", "Surveying a new territory", "Finding road stubs in the mists"]
        }
    },
    CONDITIONS: {
        'blinded': {
            name: 'Blinded',
            content: `A blinded creature can’t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature’s attack rolls have disadvantage.`
        },
        'charmed': {
            name: 'Charmed',
            content: `A charmed creature can’t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.`
        },
        'deafened': {
            name: 'Deafened',
            content: `A deafened creature can’t hear and automatically fails any ability check that requires hearing.`
        },
        'frightened': {
            name: 'Frightened',
            content: `A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can’t willingly move closer to the source of its fear.`
        },
        'grappled': {
            name: 'Grappled',
            content: `A grappled creature’s speed becomes 0, and it can’t benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the reach of the grappler.`
        },
        'incapacitated': {
            name: 'Incapacitated',
            content: `An incapacitated creature can’t take actions or reactions.`
        },
        'invisible': {
            name: 'Invisible',
            content: `An invisible creature is impossible to see without the aid of magic or a special sense. For the purpose of hiding, the creature is heavily obscured. Attack rolls against the creature have disadvantage, and the creature’s attack rolls have advantage.`
        },
        'paralyzed': {
            name: 'Paralyzed',
            content: `A paralyzed creature is incapacitated and can’t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.`
        },
        'petrified': {
            name: 'Petrified',
            content: `A petrified creature is transformed, along with any object it is wearing or carrying, into a solid inanimate substance. Its weight increases by a factor of ten, and it ceases aging. The creature is incapacitated, can’t move or speak, and is unaware of its surroundings. Attack rolls against the creature have advantage. The creature automatically fails Strength and Dexterity saving throws. The creature has resistance to all damage. The creature is immune to poison and disease, although a poison or disease already in its system is suspended, not neutralized.`
        },
        'poisoned': {
            name: 'Poisoned',
            content: `A poisoned creature has disadvantage on attack rolls and ability checks.`
        },
        'prone': {
            name: 'Prone',
            content: `A prone creature’s only movement option is to crawl, unless it stands up and thereby ends the condition. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.`
        },
        'restrained': {
            name: 'Restrained',
            content: `A restrained creature’s speed becomes 0, and it can’t benefit from any bonus to its speed. Attack rolls against the creature have advantage, and the creature’s attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.`
        },
        'stunned': {
            name: 'Stunned',
            content: `A stunned creature is incapacitated, can’t move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.`
        },
        'unconscious': {
            name: 'Unconscious',
            content: `An unconscious creature is incapacitated, can’t move or speak, and is unaware of its surroundings. The creature drops whatever it’s holding and falls prone. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.`
        }
    }
};
