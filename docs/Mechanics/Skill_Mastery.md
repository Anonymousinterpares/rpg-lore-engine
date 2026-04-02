# Skill Mastery — Player Guide

## What is Skill Mastery?

As you adventure, you earn **Skill Points (SP)** that let you improve your character's skills beyond basic proficiency. Instead of every Rogue picking locks equally well at every level, you decide what your character becomes great at.

Your skills progress through five tiers:

| Tier | Name | What it means |
|:---:|:---|:---|
| 0 | Untrained | No bonus. You rely on raw ability alone. |
| 1 | Proficient | Standard proficiency bonus (gained at character creation). |
| 2 | Expert | Double proficiency bonus. You're notably skilled. |
| 3 | Master | Double proficiency + a special ability you choose. |
| 4 | Grandmaster | Triple proficiency + a powerful ability you choose. |

---

## Earning Skill Points

You receive SP every time you level up. The amount depends on your class:

| Class | SP per Level |
|:---|:---:|
| Rogue | 3 |
| Bard | 3 |
| All others | 2 |

**You don't have to spend SP right away.** They accumulate until you're ready. Open the **Skills** tab in your journal to invest them.

If you multiclass, you receive SP from whichever class you chose for that level.

---

## Spending Skill Points

Open the **Skills** tab in your journal. Each skill shows its current tier, your total bonus, and the cost to advance.

| Advancement | SP Cost | Level Required |
|:---|:---:|:---:|
| Untrained → Proficient | 2 SP | 1 |
| Proficient → Expert | 3 SP | 1 |
| Expert → Master | 5 SP | 8 |
| Master → Grandmaster | 8 SP | 15 |

**Total cost to max one skill: 18 SP.** By level 20 you'll earn about 38 SP — enough for two Grandmaster skills, or a wider spread of Expert-level skills. Choose wisely.

To invest, click the "Invest" button next to the skill. Your investment is **pending** until you click **Confirm**. You can **Revert** all pending changes if you change your mind.

---

## Resetting Skills

Changed your mind about your build? Use the **Reset All** button to refund every SP you've invested. Your creation skills (the ones you picked when making your character) are preserved — only SP you spent manually is returned.

---

## Tier 3 & 4 — Special Abilities

When you reach Tier 3 (Master) or Tier 4 (Grandmaster) in a skill, you unlock a choice between two special abilities:

- **Passive** — Always active, no cost. A permanent upgrade.
- **Active** — Powerful but limited uses per rest or per encounter.

You pick one. The choice appears in your Skill Tree when you reach the tier. Here are some examples:

### Arcana (Master)
- *Passive — Arcane Intuition:* Rare items are automatically identified when you examine them.
- *Active — Deep Analysis:* You can attempt identification 3 times per day instead of the usual limit.

### Stealth (Master)
- *Passive — Shadow Strike:* You have advantage on all attacks during surprise rounds.
- *Active — Vanish:* Become invisible for one round, once per encounter.

### Medicine (Master)
- *Passive — Field Medic:* Short rests heal 50% more HP.
- *Active — Cure Condition:* Remove one poison, disease, or bleed effect. 3 uses per long rest.

### Persuasion (Master)
- *Passive — Silver Tongue:* All merchants give you 10% better sell prices permanently.
- *Active — Charm:* Automatically succeed on one haggle attempt per long rest.

Every skill has unique abilities at both Tier 3 and Tier 4. Check the Skill Tree for the full list.

---

## Ability Score Improvements (ASI)

At levels **4, 8, 12, 16, and 19**, you receive an Ability Score Improvement:

- **+2 to one ability** (maximum 20), or
- **+1 to two different abilities** (each max 20)

Use the `/asi` command or the prompt that appears on level up. Boosting CON retroactively increases your max HP for all levels.

---

## Multiclassing

You can add a second class to your character (maximum two classes total). To qualify:

1. Your **current class's** key ability must be 13+
2. The **target class's** key ability must be 13+

Once multiclassed, each level up asks you to choose which class gains the level. Your SP grant comes from the class you chose for that level (e.g., leveling as Rogue gives 3 SP, leveling as Fighter gives 2 SP).

---

## Difficulty Modes

Three difficulty modes are available in Settings. You can switch at any time, even mid-combat:

| Mode | Enemy HP | Enemy Damage | XP Earned |
|:---|:---:|:---:|:---:|
| Easy | -25% | -20% | -25% |
| Normal | Standard | Standard | Standard |
| Hard | +50% | +20% | +25% |

Skill points are **not** affected by difficulty — you earn the same SP regardless.

---

## Quick Reference

| Action | How |
|:---|:---|
| View skills | Open journal → **Skills** tab |
| Invest SP | Skills tab → click **Invest** → **Confirm** |
| Undo investment | Click **Revert** before confirming |
| Reset all skills | Skills tab → **Reset All** |
| Choose Tier 3/4 ability | Skills tab → click passive or active button when available |
| Use active ability | Type `/ability` to list, `/ability <skill name>` to use |
| Level up | `/levelup` (or `/levelup <class>` if multiclassed) |
| Apply ASI | `/asi +2 STR` or `/asi +1 DEX +1 CON` |
| Multiclass | `/multiclass <class>` |
| Change difficulty | Settings → Gameplay → Difficulty |
