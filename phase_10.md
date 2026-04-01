Plan: Phase 10 — Skill Improvement & Progression System

Status: BRAINSTORM COMPLETE — Decisions locked. Ready for implementation planning.

---

## 1. Problem Statement

Skills are binary (proficient or not). No way to specialize, gain new proficiencies mid-game,
or unlock skill-specific abilities. D&D 5e Expertise exists in class data but isn't implemented.
Additionally, ASI (Ability Score Improvements) at levels 4/8/12/16/19 are missing — a significant
balance gap at mid/high levels.

---

## 2. Balance Assessment

### Current System Status
- XP progression follows standard D&D 5e (300 XP to level 2, 355,000 to level 20)
- Proficiency bonus scales +2 to +6 across 20 levels
- Skill checks use standard formula: d20 + ability mod + prof (if proficient)
- Early levels (1-5): fast progression, 4-30 encounters per level
- Mid/high levels (6-20): 20-50 encounters per level

### Balance Issues Identified
1. **NO ASI** — Characters never gain ability score improvements. At high levels, base stats
   from creation define everything. A level 20 character has the same STR as level 1.
   → **Must be addressed alongside or before Phase 10**
2. **Binary skills plateau** — A level 17 Rogue (+6 prof) barely outperforms a level 5 Rogue (+3 prof)
   on skill checks. No way to meaningfully specialize.
3. **Unused skills** — 7 of 20 skills have no mechanical effect (see future_expansions.md)
4. **No expertise** — Rogue's signature feature (double prof) is defined but not coded

### Balance Verdict
The system is **mechanically sound for combat** (D&D 5e XP/CR/encounter balance is correct) but
**skill progression is flat and unrewarding** — the tier system fixes this. ASI must be implemented
to avoid a separate, larger balance problem.

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tier count | **5 tiers (0-4)**: Untrained → Proficient → Expert → Master → Grandmaster | Deep progression, escalating cost per tier (see cost curve below) |

| Points per level | **2 per level, class-individually configurable** | Each class config specifies its own SP grant (default 2) |
| Tier 4 multiplier | **Triple proficiency**, easily changeable per config | Bold endgame reward, tunable |
| Special abilities | **Phased rollout**; passive/active choice pair per tier | Each tier unlock offers player a choice |
| Schema migration | **One-time migration script**, no backward compat in code | Clean break, simpler maintenance |
| Training downtime | **SKIP ENTIRELY** | Future expansion |
| Skill point saving | **No forced spending** — points accumulate across level-ups | Player decides when to invest |
| Full respec | **Yes** — reset button returns ALL invested SP to pool | Full flexibility |
| System design | **Plug-and-play** — easy to add new skills, per-class config, individual setup | Extensible architecture |
| Multiclass | **Max 2 classes** — on level up, choose which class's skill tree to advance | One class per level-up |

---

## 4. Skill Point Economy — Industry Best Practices

### Diablo 2 / Path of Exile
- 1 skill point per level, invest in skill tree nodes
- Deep specialization: pour all points into one branch or diversify
- Respec available but costly (PoE: Orbs of Regret)
- **Takeaway:** Limited points force meaningful choices

### Elder Scrolls (Skyrim) ---NOT SUITABLE!---
- Skills level up by USING them (swing sword → One-Handed increases)
- Perk points (1/level) unlock nodes in skill trees
- No point limit per skill — natural cap from use frequency
- **Takeaway:** Usage-based progression feels organic but hard to balance for text RPG

### Divinity: Original Sin 2 
- 2 points per level (combat + civil skill points)
- Civil skills (Persuasion, Lucky Charm, Thievery) separate from combat
- Low cap (5-10 ranks) with steep diminishing returns
- **Takeaway:** Separating combat/non-combat skills prevents power gaming

### Pathfinder 2e
- Proficiency tiers: Untrained → Trained → Expert → Master → Legendary
- Advancement tied to class level thresholds (automatic + choice)
- Legendary tier requires level 15+ in the skill
- **Takeaway:** Level-gating high tiers prevents early-game power spikes

### Baldur's Gate 3 (D&D 5e based)
- Binary proficiency (same as our current system)
- Expertise for Rogue/Bard only
- No skill points — progression only through proficiency bonus scaling
- **Takeaway:** Players universally wish BG3 had deeper skill progression

### Our Design (Hybrid)
- **2 points per level** (configurable per class in class JSON)
- **Cost curve:** Tier 0→1: 2 SP, Tier 1→2: 3 SP, Tier 2→3: 5 SP, Tier 3→4: 8 SP
- **Total by level 20:** 38 SP (enough for ~2 Grandmaster + 2 Expert, or broad diversification)
- **Level-gating:** Tier 3 requires character level 8+, Tier 4 requires level 15+
- **Respec:** Full reset, all SP returned to pool, no cost (can be changed later)


### LOCKED: Cost Curve Balance
Cost curve (2/3/5/8 = 18 SP for one skill to Grandmaster) means by level 20 (38 SP):
- Focused: 2 Grandmaster skills (36 SP) + 1 leftover
- Balanced: 4 Expert skills (20 SP) + 3 Proficient skills (6 SP) + 6 leftover
- Broad: 12 Proficient skills (24 SP) + remaining for Expert

This forces meaningful specialization — you cannot max everything.

---

## 5. Difficulty Scaling System

### Overview
Single-player only. Three modes: Easy / Normal (default) / Hard.
Changeable at any time during gameplay including mid-combat. Takes effect immediately on all
backend stats and frontend display.

### Scaling Factors (configurable in game settings)
```
data/config/difficulty.json
{
  "easy":   { "enemyStatScale": 0.75, "enemyHPScale": 0.75, "xpScale": 0.75, "enemyDamageScale": 0.8 },
  "normal": { "enemyStatScale": 1.0,  "enemyHPScale": 1.0,  "xpScale": 1.0,  "enemyDamageScale": 1.0 },
  "hard":   { "enemyStatScale": 1.25, "enemyHPScale": 1.5,  "xpScale": 1.25, "enemyDamageScale": 1.2 }
}
```

### What Scales
- **Enemy HP** — multiplied by HPScale on spawn and on difficulty change mid-combat (proportional)
- **Enemy attack/damage** — multiplied by damageScale
- **Enemy ability scores** — multiplied by statScale (affects AC, save DCs, skill checks)
- **XP rewards** — multiplied by xpScale (easy: less XP, hard: more XP)
- **Skill point grants** — NOT scaled (SP per level stays the same regardless of difficulty)

### Implementation
- Stored in `state.settings.difficulty: 'easy' | 'normal' | 'hard'`
- DifficultyEngine reads config, applies multipliers at point of use (not baked into data)
- On mid-combat difficulty change: recalculate all active combatant stats proportionally
- UI settings panel: difficulty dropdown, changeable anytime
- Flip-of-switch design: single config read, no hardcoded values

### Files Affected
- NEW: data/config/difficulty.json
- NEW: src/ruleset/combat/DifficultyEngine.ts — reads config, provides scale factors
- CombatOrchestrator.ts — apply enemy stat scaling on spawn
- MechanicsEngine.ts — apply XP scaling on reward
- EncounterDirector.ts — apply HP/stat scaling to generated encounters
- SettingsManager.ts — difficulty setting persistence
- UI: Settings panel — difficulty selector

---

## 6. Special Abilities — Passive/Active Choice Pairs

At Tier 3 (Master) and Tier 4 (Grandmaster), player chooses ONE of two options per tier.
Abilities supplement class features (never replace them).

### Tier 3 (Master) — Choose Passive OR Active

| Skill | Passive Option | Active Option |
|-------|---------------|---------------|
| **Arcana** | Auto-succeed identify on Rare items | 3 identification attempts/24h (up from 1) |
| **Investigation** | Reveal trap presence passively when entering room | 3 identification attempts/24h |
| **Perception** | +5 to passive Perception permanently | True Sight 30ft for 1 minute, 1/long rest |
| **Survival** | Always discover hidden paths on hex move | Predict next 3 encounters' difficulty, 1/long rest |
| **Medicine** | +50% HP from short rests (party-wide if you tend them) | Cure one condition (poison/disease/bleed), 3/long rest |
| **Stealth** | Advantage on all surprise round attacks | Vanish: become invisible 1 round, 1/encounter |
| **Persuasion** | Permanent +10% sell price at all merchants | Charm: auto-succeed one haggle, 1/long rest |
| **Intimidation** | Enemies below 25% HP have disadvantage on attacks | Frighten one enemy 2 rounds, 1/encounter |
| **Deception** | No standing penalty on failed Deceive checks | Feint: gain advantage on next attack, 1/encounter |
| **Athletics** | Grapple/shove checks always have advantage | Power Shove: shove deals STR mod damage, 3/encounter |
| **Acrobatics** | +2 AC against opportunity attacks | Tumble: disengage as free action, 2/encounter |
| **Sleight of Hand** | Auto-succeed on disarming non-magical traps | Pickpocket: steal one item during dialogue, 1/long rest |
| **Performance** | Merchant stock refreshes when you perform for them | Inspire: ally gains +1d4 to next check, 2/long rest |
| **Animal Handling** | Beasts won't attack unless provoked | Calm Beast: pacify one beast in combat, 1/encounter |
| **History** | Codex entries auto-reveal monster resistances | Recall Weakness: +2 damage vs identified creature type, 1/encounter |
| **Nature** | +50% gathering yields | Herbalist: identify unknown potions/plants for free |
| **Religion** | Sense undead/fiend within 60ft passively | Turn Undead: frighten undead in 30ft, 1/long rest |
| **Cartography** | Auto-reveal adjacent hex biomes on map | Chart Course: next hex movement costs 0 time, 1/long rest |
| **Unarmed Combat** | Unarmed damage die increases by one size | Stunning Strike: stun on hit for 1 round, 1/encounter |

### Tier 4 (Grandmaster) — Choose Passive OR Active

| Skill | Passive Option | Active Option |
|-------|---------------|---------------|
| **Arcana** | Auto-identify all items on pickup (Rare and below) | Dispel one magical effect, 1/long rest |
| **Investigation** | Reveal ALL hidden properties of items passively | Deduce: learn one enemy's next action, 1/encounter |
| **Perception** | Blindsight 10ft in combat (can't be surprised) | Eagle Eye: see through walls 30ft, 1/long rest |
| **Survival** | Immune to getting lost; no random encounters while resting | Tracker: reveal all enemies on current hex, 1/long rest |
| **Medicine** | Party gains temp HP equal to your WIS mod after long rest | Emergency Surgery: revive ally from 0 HP to 1, 1/long rest |
| **Stealth** | First attack from stealth deals double damage | Shadow Step: teleport 30ft to unoccupied shadow, 1/encounter |
| **Persuasion** | Unlock exclusive merchant stock tier | Silver Tongue: convert hostile NPC to neutral, 1/long rest |
| **Intimidation** | Enemies may flee when any ally drops to 0 HP | War Cry: all enemies frightened 1 round, 1/long rest |
| **Deception** | Disguise identity from all NPCs permanently | Perfect Lie: convince NPC of any single statement, 1/long rest |
| **Athletics** | Climb/swim speed equal to walk speed | Titan Grip: auto-succeed grapple + deal damage, 1/encounter |
| **Acrobatics** | Evasion: half damage on failed DEX saves, 0 on success | Redirect: deflect one attack to adjacent enemy, 1/encounter |
| **Sleight of Hand** | Disarm enemy weapons on critical hits automatically | Plant Evidence: frame NPC in social encounter, 1/long rest |
| **Performance** | Merchants offer 20% better prices after performance | Masterpiece: all allies gain +2 to all checks for 1 hour, 1/long rest |
| **Animal Handling** | Tame one beast as permanent companion | Command Beast: control enemy beast for 1 round, 1/encounter |
| **History** | +25% XP from all encounters | Exploit: auto-crit on identified creature type, 1/long rest |
| **Nature** | Auto-gather max yield from any node | Commune: ask one yes/no question about current area, 1/long rest |
| **Religion** | Undead/fiends have disadvantage on attacks against you | Divine Rebuke: reflect damage back to attacker, 1/encounter |
| **Cartography** | Full map reveal within 3 hex radius | Dimensional Anchor: prevent enemy teleportation, 1/encounter |
| **Unarmed Combat** | Unarmed attacks count as magical for resistance bypass | Pressure Point: paralyze target 1 round on crit, 1/encounter |

---

## 6. NPC Skill Tiers

**Moved to future_expansions.md** — not in Phase 10 scope. Current binary NPC proficiency is sufficient.

---

## 7. Multiclass Skill Advancement

### Rules
- Maximum 2 classes per character
- On level up: player first chooses which class to level (class 1 or class 2)
- Skill point grant comes from the CHOSEN class's config (e.g., Rogue: 3 SP, Fighter: 2 SP)
- Class-specific skill trees only advance when that class is chosen for the level
- Total character level determines proficiency bonus (as per D&D 5e multiclass rules)

### Edge Cases
- A Fighter 10 / Rogue 10 gets: (10 × 2 SP) + (10 × 3 SP) = 50 SP total
- Compare to Fighter 20: (20 × 2 SP) = 40 SP
- Multiclass gains more total SP but is split across two class pools
- Tier level-gates use CHARACTER level, not class level

---

## 8. Architecture — Plug-and-Play Design

### Skill Definition (data-driven, not hardcoded)
```
data/skills/skills.json — Master skill registry
{
  "Arcana": {
    "ability": "INT",
    "description": "...",
    "tierCosts": [2, 3, 5, 8],      // SP cost per tier advancement
    "levelGates": [1, 1, 8, 15],     // min character level per tier
    "tierMultipliers": [1, 2, 2, 3], // proficiency multiplier per tier
    "abilities": {
      "tier3": { "passive": {...}, "active": {...} },
      "tier4": { "passive": {...}, "active": {...} }
    }
  }
}
```

### Class Skill Config (per-class)
```
data/class/Rogue.json — extends existing format
{
  "skillPointsPerLevel": 3,
  "skillChoices": { "count": 4, "options": [...] },
  "expertise": { "level": 1, "count": 2 },  // free Tier 2 grants
  ...
}
```

### Adding a New Skill
1. Add to `SkillNameSchema` enum in BaseSchemas.ts
2. Add entry to `data/skills/skills.json` with ability, costs, abilities
3. Add to relevant class `skillChoices.options` arrays
4. Done — MechanicsEngine picks it up automatically

### Adding a New Special Ability
1. Add to the skill's `abilities.tier3` or `tier4` in skills.json
2. Implement the effect handler in a `SkillAbilityEngine` (new file)
3. Register the handler — the engine dispatches by skill name + tier

---

## 9. Skill Progression Tree UI

### Requirements
- Full-screen panel accessible from character sheet
- Shows all 20 skills organized by ability score
- Per-skill: current tier (visual indicator), points invested, cost to next, level gate
- Tier 3/4: show passive/active choice with descriptions, lock until available
- "Available SP: X" prominently displayed
- "Invest" button per skill (disabled if insufficient SP or level-gated)
- "Reset All" button — confirms, returns all SP to pool
- Tier visual: empty → filled circles or stars (★☆☆☆ for Tier 1)
- Locked tiers shown grayed with level requirement tooltip
- On hover: show full ability description for Tier 3/4 choices

### Layout Concept
```
┌─────────────────────────────────────────────────────────┐
│  SKILL MASTERY                    Available SP: 12      │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ▸ STRENGTH                                             │
│    Athletics       ★★☆☆  Expert    [+6]  [Invest 5SP]  │
│    Unarmed Combat  ★☆☆☆  Proficient [+4] [Invest 3SP]  │
│                                                         │
│  ▸ DEXTERITY                                            │
│    Acrobatics       ☆☆☆☆  Untrained  [+2] [Invest 2SP] │
│    Stealth          ★★★☆  Master     [+8] [Choose Ability]│
│    Sleight of Hand  ☆☆☆☆  Untrained  [+1] [Invest 2SP] │
│                                                         │
│  ▸ INTELLIGENCE                                         │
│    Arcana           ★★★★  Grandmaster [+18] [MAX]       │
│    ...                                                  │
│                                                         │
│  [Reset All Skills]                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Affected Systems Summary

| System | File(s) | Change |
|--------|---------|--------|
| **Schema** | PlayerCharacterSchema.ts, FullSaveStateSchema.ts | skills Record, skillPoints |
| **Skill Data** | NEW: data/skills/skills.json | Master skill registry |
| **Class Data** | data/class/*.json | Add skillPointsPerLevel per class |
| **Skill Engine** | NEW: SkillEngine.ts | Invest, reset, tier calc, ability dispatch |
| **Ability Engine** | NEW: SkillAbilityEngine.ts | Passive/active ability effects |
| **Mechanics** | MechanicsEngine.ts | Tier-based bonus in resolveCheck |
| **Leveling** | LevelingEngine.ts | Grant SP on level up from class config |
| **Save Migration** | NEW: migration script | Convert skillProficiencies[] → skills Record |
| **Character Creation** | creation.ts, CharacterFactory.ts, CharacterCreator.tsx | Init skills Record |
| **Identification** | GameLoop.ts, PaperdollScreen.tsx, InventoryGrid.tsx | Tier-scaled cooldowns |
| **Trade** | ShopEngine.ts, TradeModal.tsx | Tier-based bonuses |
| **Exploration** | GameLoop.ts | Survival tier benefits |
| **Combat** | MechanicsEngine.ts, StandardActions.ts, CombatActionBar.tsx | Tier bonuses + abilities |
| **Rest** | RestingEngine.ts | Medicine tier healing bonus |
| **Crafting** | DowntimeEngine.ts, GatheringEngine.ts | Tier-based gathering/craft bonus |
| **UI: Skill Tree** | NEW: SkillTreePanel.tsx + CSS | Full skill investment screen |
| **UI: Character Sheet** | CharacterSheet.tsx | Tier display, SP counter |
| **UI: Level Up** | NEW: LevelUpModal.tsx changes | SP grant notification |
| **CLI** | repl.ts, new SkillRenderer.ts | /skills, /invest commands |
| **CLI Tests** | NEW: test_skill_system.ts | Full regression suite |

---

## 11. Implementation Priority

### Must-Have (Core — Phase 10A)
- [ ] data/skills/skills.json master registry
- [ ] Schema: skills Record + skillPoints in PlayerCharacterSchema
- [ ] SkillEngine: invest, reset, tier calculation
- [ ] MechanicsEngine: tier-based bonus in resolveCheck
- [ ] Class JSON: skillPointsPerLevel per class (default 2)
- [ ] LevelingEngine: grant SP on level up + ASI at levels 4/8/12/16/19
- [ ] ASI system: +2 to one ability or +1/+1 to two abilities (cap 20)
- [ ] Save migration script
- [ ] Character creation: init skills Record
- [ ] CLI: /skills, /invest, /asi commands
- [ ] Respec: full reset returns all SP
- [ ] Difficulty scaling system (Easy/Normal/Hard)
- [ ] DifficultyEngine + data/config/difficulty.json

### Should-Have (Integration — Phase 10B)
- [ ] Identification scaling (attempts per tier)
- [ ] Trade scaling (Persuasion/Intimidation/Deception tiers)
- [ ] Medicine → rest healing bonus
- [ ] Survival → exploration benefits
- [ ] Expertise implementation (Rogue free Tier 2)
- [ ] Multiclass skill advancement
- [ ] Skill Tree UI panel (meticulously crafted — see section 10)

### Nice-to-Have (Abilities — Phase 10C)
- [ ] Tier 3 passive/active ability pairs (first batch: combat skills)
- [ ] Tier 4 passive/active ability pairs (phased)
- [ ] SkillAbilityEngine for effect dispatch
- [ ] Remaining unused skill mechanics (see future_expansions.md)

---

## 13. Documentation Requirement

Once Phase 10 is implemented, the following must be thoroughly documented:

### Game Documentation (docs/Mechanics/)
- Skill system overview (tiers, costs, level gates)
- Per-skill reference: ability, all 4 tier effects, passive/active choices
- Skill point economy: sources, costs, respec rules
- Difficulty modes: what scales, by how much, when it applies
- Multiclass skill rules

### Technical Documentation (docs/Content/ or inline)
- Schema: skills Record structure, migration format
- SkillEngine API: invest, reset, getTier, getBonus
- SkillAbilityEngine: how to add new abilities
- DifficultyEngine: how to add new difficulty modes
- data/skills/skills.json format specification
- How to add a new skill (plug-and-play guide)
