# Mechanics: Rules Engine

## 1. Core Resolution Mechanic
The game uses a standard d20 system. All logic checks must follow this formula:

`Result = d20_Roll + Ability_Modifier + Proficiency_Bonus (if applicable) + Miscellaneous_Modifiers`

*   **Ability Modifier:** `floor((Score - 10) / 2)`
*   **Proficiency Bonus:** Determined by Level (see table).
*   **Advantage/Disadvantage:** Roll 2d20. Keep Highest (Advantage) or Lowest (Disadvantage). These cancel each other out (1 Adv + 1 Disadv = Normal Roll).

## 2. Economy & Wealth
Base unit is **Copper Piece (cp)**.

| Coin | Value (cp) | Value (gp) | Weight (50 coins) |
| :--- | :--- | :--- | :--- |
| **Copper (cp)** | 1 | 0.01 | 1 lb |
| **Silver (sp)** | 10 | 0.10 | 1 lb |
| **Electrum (ep)** | 50 | 0.50 | 1 lb |
| **Gold (gp)** | 100 | 1.00 | 1 lb |
| **Platinum (pp)** | 1,000 | 10.00 | 1 lb |

*   **Selling Loot:** Equipment sells for 50% of base cost. Art/Gems sell for 100%.

## 3. Proficiency & Progression
### Proficiency Bonus Table
| Level | Bonus |
| :---: | :---: |
| 1-4 | +2 |
| 5-8 | +3 |
| 9-12 | +4 |
| 13-16 | +5 |
| 17-20 | +6 |

### Experience Points (XP) Table
| Level | XP Needed | Level | XP Needed |
| :---: | :---: | :---: | :---: |
| 1 | 0 | 11 | 85,000 |
| 2 | 300 | 12 | 100,000 |
| 3 | 900 | 13 | 120,000 |
| 4 | 2,700 | 14 | 140,000 |
| 5 | 6,500 | 15 | 165,000 |
| 6 | 14,000 | 16 | 195,000 |
| 7 | 23,000 | 17 | 225,000 |
| 8 | 34,000 | 18 | 265,000 |
| 9 | 48,000 | 19 | 305,000 |
| 10 | 64,000 | 20 | 355,000 |



## 4. Combat Rules
### Turn Sequence
1.  **Surprise:** Determine if any side is surprised (Perception vs Stealth).
2.  **Initiative:** Roll `d20 + DEX Mod` for all combatants. Order from highest to lowest.
3.  **Turns:** Each participant takes a turn.
4.  **Round:** Once everyone has acted, the round ends (approx 6 seconds).

### Action Economy
*   **Move:** Up to speed. Can be broken up.
*   **Bonus Action:** Only if granted by a specific feature/spell (e.g., Cunning Action).
*   **Reaction:** Triggered instant response (e.g., Opportunity Attack, Shield spell). 1 per round.

### Standard Actions
*   **Attack:** Make one melee or ranged attack (or more if *Extra Attack*).
*   **Cast a Spell:** Cast a spell with Casting Time of "1 Action".
*   **Dash:** Gain extra movement equal to current speed phase.
*   **Disengage:** Movement does not provoke Opportunity Attacks.
*   **Dodge:** Until start of next turn:
    *   Attacks against you have **Disadvantage**.
    *   You have **Advantage** on DEX Saves.
*   **Help:** Grant Advantage to an ally's next check or attack.
*   **Hide:** Make a Stealth check vs Passive Perception to become "Unseen".
*   **Ready:** Hold an action to trigger on a specific condition (Uses Reaction).
*   **Search:** Make a Perception or Investigation check.
*   **Use an Object:** Interact with an item (Drink potion, pull lever).

### Standard Actions
*   **Attack:** Make one melee or ranged attack (or more if *Extra Attack*).
*   **Cast a Spell:** Cast a spell with Casting Time of "1 Action".
*   **Dash:** Gain extra movement equal to current speed phase.
*   **Disengage:** Movement does not provoke Opportunity Attacks.
*   **Dodge:** Until start of next turn:
    *   Attacks against you have **Disadvantage**.
    *   You have **Advantage** on DEX Saves.
*   **Help:** Grant Advantage to an ally's next check or attack.
*   **Hide:** Make a Stealth check vs Passive Perception to become "Unseen".
*   **Ready:** Hold an action to trigger on a specific condition (Uses Reaction).
*   **Search:** Make a Perception or Investigation check.
*   **Use an Object:** Interact with an item (Drink potion, pull lever).

### Attack Resolution
1.  **Attack Roll:** `d20 + STR/DEX Mod + Proficiency` vs `Target AC`.
2.  **Hit:** If Roll >= AC.
3.  **Critical Hit:** Natural 20. Roll damage dice twice.
4.  **Damage:** Roll Weapon Dice + Ability Mod. (Spells do not add Mod unless specified).

## 4. Resting & Recovery
### Short Rest (1 Hour)
*   Character can spend **Hit Dice** (HD) to heal.
*   Roll HD + CON Mod per die spent.
*   Refreshes: Warlock Slots, Monk Ki, Fighter Action Surge/Second Wind, Druid Wild Shape.

### Long Rest (8 Hours)
*   Regain **All HP**.
*   Regain **Half** of maximum Hit Dice (min 1).
*   Regain **All** Spell Slots.
*   Reduces **Exhaustion** by 1 level.
*   Requirement: Must have at least 1 HP at start; only 1 Long Rest per 24h.

## 6. Conditions (State Machine)
Flags applied to entities that alter their capabilities.

*   **Blinded:** Auto-Fail sight checks. Attacks against: Adv. Attacks by: Disadv.
*   **Charmed:** Cannot attack charmer. Charmer has Adv on social checks.
*   **Deafened:** Auto-Fail hearing checks.
*   **Exhaustion (Stacked Levels):**
    1.  Disadv on Ability Checks.
    2.  Speed halved.
    3.  Disadv on Attacks/Saves.
    4.  HP Max halved.
    5.  Speed 0.
    6.  Death.
*   **Frightened:** Disadv on Checks/Attacks while source visible. Cannot move closer.
*   **Grappled:** Speed 0. Ends if grappler incapacitated or moved away.
*   **Incapacitated:** No Actions or Reactions.
*   **Invisible:** Unseen (Heavily Obscured). Attacks against: Disadv. Attacks by: Adv.
*   **Paralyzed:** Incapacitated + Can't move/speak. Auto-Fail STR/DEX saves. Attacks against from 5ft are **Crits**.
*   **Petrified:** Turned to stone. Incapacitated. Resistance to all damage. Immune Poison/Disease.
*   **Poisoned:** Disadv on Attacks and Ability Checks.
*   **Prone:** Crawler. Attacks by: Disadv. Attacks against (5ft): Adv. Attacks against (>5ft): Disadv.
*   **Restrained:** Speed 0. Attacks against: Adv. Attacks by: Disadv. Disadv on DEX saves.
*   **Stunned:** Incapacitated + Can't move/speak. Auto-Fail STR/DEX saves. Attacks against: Adv.
*   **Unconscious:** Incapacitated + Prone. Drops held items. Auto-Fail STR/DEX saves. Attacks against from 5ft are **Crits**.

## 6. Damage Types
*   **Physical:** Bludgeoning, Piercing, Slashing.
*   **Elemental:** Acid, Cold, Fire, Lightning, Thunder.
*   **Exotic:** Force, necrotic, Poison, Psychic, Radiant.

## 7. Encumbrance
*   **Carrying Capacity (lbs):** `Score(STR) * 15`.
*   **Push/Drag/Lift:** `Score(STR) * 30` (Speed drops to 5ft if excess).
*   If carrying > Capacity, Speed drops to 5ft/0.

## 8. Multiclassing
*   **Supported** — Maximum 2 classes. See [Skill Mastery](Skill_Mastery.md) for details.

## 9. Leveling Up

When you earn enough XP, your character levels up. If you earn enough XP to skip multiple levels,
all levels are gained at once with cumulative benefits.

**Per-level gains:**
| Benefit | How it works |
|:---|:---|
| **HP increase** | `floor(hitDie / 2) + 1 + CON modifier` per level (see hit die table below) |
| **Hit Dice max** | +1 per level (used for short rest healing) |
| **Proficiency bonus** | Increases automatically: +2 (levels 1-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17-20) |
| **Skill Points (SP)** | Granted per level based on your class (see SP table below) |
| **ASI** | At levels 4, 8, 12, 16, 19: choose +2 to one ability score or +1 to two (max 20 each) |
| **Spell Slots** | All spell slots restored to maximum on level up |

**HP and Hit Die by class:**

| Class | Hit Die | HP per level (before CON mod) |
|:---|:---:|:---:|
| Barbarian | d12 | 7 |
| Fighter | d10 | 6 |
| Paladin | d10 | 6 |
| Ranger | d10 | 6 |
| Bard | d8 | 5 |
| Cleric | d8 | 5 |
| Druid | d8 | 5 |
| Monk | d8 | 5 |
| Rogue | d8 | 5 |
| Warlock | d8 | 5 |
| Sorcerer | d6 | 4 |
| Wizard | d6 | 4 |

**Skill Points (SP) per level by class:**

These values are defined in each class's data file (`data/class/<ClassName>.json`, field `skillPointsPerLevel`).

| Class | SP per level |
|:---|:---:|
| Rogue | 3 |
| Bard | 3 |
| Barbarian | 2 |
| Cleric | 2 |
| Druid | 2 |
| Fighter | 2 |
| Monk | 2 |
| Paladin | 2 |
| Ranger | 2 |
| Sorcerer | 2 |
| Warlock | 2 |
| Wizard | 2 |

For details on how to spend SP, see [Skill Mastery](Skill_Mastery.md).
