# Future Expansions — Unused Systems & Mechanics Backlog

Status: BACKLOG — Features documented here are planned for future phases. Not yet prioritized.

---

## Skills Without Mechanical Integration

These skills exist in SkillNameSchema (BaseSchemas.ts:36-41) and can be selected at character creation,
but have NO gameplay effect beyond the proficiency bonus on generic skill checks.

### Animal Handling (WIS)
- No mount/companion system exists
- No beast calming/taming mechanic
- No mounted combat
- **Future:** Beast companion system, mounted movement, calm hostile beasts

### History (INT)
- No lore-gated knowledge checks
- No bonus for recognizing historical artifacts, ruins, or NPCs
- **Future:** Knowledge checks that reveal monster weaknesses, hidden quest info, or bonus XP

### Nature (INT)
- No herbalism or nature knowledge checks
- No plant/creature identification
- **Future:** Herbalism gathering bonuses, creature identification, weather prediction

### Religion (INT)
- No divine knowledge checks
- No undead turning or fiend/celestial detection
- **Future:** Turn undead mechanic, sense alignment, identify cursed items

### Performance (CHA)
- No entertainment or busking mechanic
- No morale/inspiration system
- **Future:** Earn gold through busking, inspire allies with Performance checks

### Sleight of Hand (DEX)
- Only used in crafting recipes (leather armor)
- No pickpocketing during dialogue or exploration
- No combat disarm
- **Future:** Pickpocket mechanic, combat disarm action, trap disabling

### Medicine (WIS)
- Only used in crafting (potions)
- NOT used in rest healing (RestingEngine has no skill involvement)
- No poison/disease treatment
- **Future:** Short rest healing bonus, stabilize dying allies without magic, cure conditions

---

## Other Missing Systems

---

## Implementation Plan Audit Gaps (verified April 2026)

Items from the original implementation_plan.md that are incomplete or missing.

### Feat System — PARTIALLY IMPLEMENTED (April 2026)
- 12 feats defined in data/feats/feats.json with effects schema
- /feat command, LevelingEngine.selectFeat(), feats array on PlayerCharacterSchema
- Alert +5 initiative wired, Tough retroactive + per-level HP wired
- **Unwired feat mechanical effects (need combat integration):**
  - Alert: "can't be surprised" needs surprise system check; "unseen don't gain advantage" needs CombatResolutionEngine
  - Great Weapon Master: -5/+10 power attack needs player toggle in combat UI
  - Sharpshooter: -5/+10 power attack + ignore cover for ranged weapons (NOT spell saves)
  - Lucky: 3 luck points per long rest, reroll d20 — needs UI for spending points mid-roll
  - Mobile: +10 speed needs movementSpeed modification; no-OA-after-melee needs CombatOrchestrator
  - Polearm Master: bonus action butt-end attack + reach OA — needs CombatOrchestrator
  - Sentinel: OA stops movement + ignore disengage + ally protection — needs CombatOrchestrator
  - War Caster: concentration advantage + spell-as-OA — needs CombatOrchestrator + SpellManager
  - Actor: advantage on Deception/Performance impersonation — needs dialogue system check
  - Resilient: saving throw proficiency for chosen ability — needs ability choice UI + savingThrowProficiencies update
  - Athlete: STR/DEX choice — needs ability choice UI
- **No feat selection UI** — players use /feat command only; should be added to LevelUpOverlay

### Exhaustion System (6 Levels) — DEFERRED TO SURVIVAL EXPANSION
- D&D 5e has graduated exhaustion: level 1 = disadvantage on ability checks, up to level 6 = death
- WeatherEngine has `exhaustionRisk: true` flag but never applies it
- No exhaustion level tracking on character, no graduated penalties
- **Deferred:** Not suitable as standalone feature. Should be part of a broader Survival Expansion
  that includes forced march, starvation/dehydration, extreme weather, and camp quality.
  Exhaustion would be the penalty system tying those mechanics together.
  For solo play, exhaustion should be generous (easy to recover, hard to reach level 3+).

### Spell Upcasting — PARTIALLY IMPLEMENTED
- Spell JSONs have `damage.scaling` arrays with correct upcast values (Fireball, Cure Wounds, etc.)
- SpellcastingEngine validates `slotLevel >= spell.level` for casting
- BUT engine does NOT apply upcast damage scaling when casting at higher levels — always uses base dice
- **To implement:** In SpellcastingEngine.castSpell(), read `spell.damage.scaling[slotLevel - spell.level]` when slotLevel > spell.level

### AoE Spell Geometry — PARTIALLY IMPLEMENTED
- SpellSchema defines area shapes: CONE, SPHERE, RADIUS, CUBE, CYLINDER, LINE
- Spell JSONs use these shapes (Fireball = RADIUS 20ft, Cone of Cold = CONE 60ft)
- ALL_IN_AREA spells currently hit ALL enemies regardless of distance — no radius check
- CombatGridManager has line-of-sight (Bresenham's algorithm) but NO AoE targeting geometry
- Cover does NOT add to saving throws (D&D 5e: half cover = +2 DEX saves, three-quarters = +5)
- Cover AC bonus only applies when character has "hunkered_down" status, not passively
- **To implement:**
  - AoE geometry resolver: filter targets within spell radius from origin point
  - Cover save bonus: add cover-based bonus to DEX saves for AoE spells
  - Full cover should block AoE effects entirely
  - Fix cover to apply passively (not only when hunkered)

### Combat Narrator Tactical Awareness — MISSING
- The LLM narrator during combat receives ONLY: round number, enemy summary, whose turn
- NO spatial/positional data, distances, cover info, hazard tiles, AoE results, terrain features,
  formation data, visibility conditions, or movement paths are passed to the narrator
- Combat logs are text-only — narrator infers spatial context from log messages
- NarrativeGenerator.ts has tactical description templates but they're only used for UI labels,
  not fed to the LLM narrator
- **Impact:** Narrator cannot describe tactical situations ("the goblin ducks behind the pillar"
  or "the fireball engulfs the group in the open") because it has no awareness of these systems
- **To implement:** Enrich ContextBuilder.buildCombatContext() with:
  - Combatant positions and distances from player
  - Cover status per combatant
  - Active hazard tiles near combat
  - Recent AoE results (who was hit, who was shielded)
  - Terrain features near combatants
  - Lighting conditions

### Environmental Hazards — PARTIALLY IMPLEMENTED
- BiomeRegistry defines hazards: Lava (2d6 Fire), Spike Pit (2d6 Piercing), Thin Ice (1d6 Cold), etc.
- No dedicated HazardEngine
- Falling damage (1d6 per 10ft) NOT implemented
- Drowning (CON saves) NOT implemented
- Unclear if combat actually triggers hazard damage when combatants move to hazardous terrain tiles
- **To implement:** HazardEngine with falling/drowning rules, wire grid hazard tiles into CombatOrchestrator movement

### Light & Darkness — PARTIALLY IMPLEMENTED
- VisibilityEngine has correct logic for Bright/Dim/Darkness with darkvision
- BUT VisibilityEngine is NEVER CALLED during combat — completely dead code
- Darkvision chain is fully broken: race data exists (Elf=60ft etc.) but never flows to combat
  - PlayerCharacterSchema has no darkvision field
  - CharacterFactory doesn't copy race.darkvision to character
  - CombatantSchema has no darkvision field
  - CombatFactory doesn't carry darkvision to combat
  - CombatResolutionEngine never checks lighting/visibility
- No grid-based light propagation or shadow casting
- **Data chain FIXED** (April 2026): PlayerCharacterSchema, CombatantSchema, CharacterFactory, CharacterCreationEngine, CombatFactory all carry darkvision. VisibilityEngine simplified.
- **Still missing:** VisibilityEngine not wired into CombatResolutionEngine (combat doesn't check lighting)
- **Monster darkvision data:** Only 11/325 monsters have a darkvision field. Need bulk migration script to add
  darkvision based on creature type (dragons=120ft, undead/fiends/aberrations=60ft, humanoids=0, etc.)
  using D&D 5e SRD senses data as reference. ~200 monsters need the field added.

### Sub-Location / Dungeon Navigation — NOT IMPLEMENTED
- Currently the game only has hex-based movement on the world map
- No room-by-room navigation within a location (caves, dungeons, buildings)
- SubLocationSchema exists in WorldEnrichmentSchema but is not wired to gameplay
- **Critical dependency:** Systems like darkvision, torch illumination, trap detection,
  and room-based encounters all depend on sub-location navigation existing
- **To implement:** Room navigation state machine, room-based movement commands,
  room descriptions via narrator, room-based encounters, integration with:
  - Darkvision (darkness in rooms without light sources)
  - Trap detection (Investigation/Perception T3 abilities)
  - Environmental hazards (room-specific, not just combat grid)
  - Stealth (moving between rooms undetected)
  - Light sources (torch/lantern illumination radius)

---

### Ability Score Improvements (ASI)
- D&D 5e grants ASI at levels 4, 8, 12, 16, 19
- Currently NOT implemented in LevelingEngine
- Characters never gain stat boosts or feats after creation
- **Priority:** HIGH — significant balance gap at mid/high levels

### Feat System
- No feats exist in the engine
- D&D 5e allows choosing a feat instead of ASI
- **Future:** Feat selection at ASI levels, with prerequisites

### Tool Proficiencies
- Defined in background data (thieves' tools, gaming sets, etc.)
- No mechanical integration — tools have no effect on gameplay
- **Future:** Tool-gated interactions (thieves' tools for lockpicking, etc.)

### Mounted Combat
- No mount acquisition, movement, or combat rules
- Animal Handling skill exists but unused
- **Future:** Mount system with mounted charge, dismount penalties

### Companion/Familiar System
- No beast companions (Ranger), familiars (Wizard), or pets
- **Future:** Summon familiar, beast companion with own stats and actions

### NPC Skill Tiers
- Currently NPCs/monsters have binary skill proficiency (skills array in JSON data)
- MechanicsEngine.resolveCheck() handles monster skill checks (lines 69-84)
- Adding tiers would mean: `monsterSkills: Record<string, { tier: number }>`
- **Impact if implemented:**
  - Merchant NPCs: Perception/Insight tier → harder to pickpocket/deceive; Persuasion tier → harder to haggle
  - Combat NPCs: Athletics/Stealth tier → affects contested checks, ambush success, surprise detection
  - Quest NPCs: History/Arcana/Religion tier → quality of shared lore; Medicine tier → healing effectiveness
- **Recommendation:** Add when NPC AI is more sophisticated. Current binary proficiency sufficient for now.
- **Future:** Full NPC tier system with per-NPC skill configurations

---

## Skill Ability Wiring Status (Phase 10C)

### Wired (mechanically active)
| Skill | Tier | Ability | Where |
|---|---|---|---|
| Arcana | T3 passive | Auto-succeed identify Rare | GameLoop.ts examine handler |
| Arcana | T4 passive | Auto-identify on pickup (Rare-) | GameLoop.ts examine handler |
| Perception | T3 passive | +5 passive Perception | MechanicsEngine.getPassivePerception |
| Medicine | T3 passive | +50% short rest HP (from 10B) | RestingEngine.applyProportionalRest |
| Medicine | T4 passive | Temp HP after long rest | RestingEngine.applyProportionalRest |
| Persuasion | T3 passive | +10% sell price | ShopEngine.getSellPrice |
| Deception | T3 passive | No standing penalty on fail | ShopEngine.deceive |
| History | T4 passive | +25% XP | CombatOrchestrator.endCombat |
| Nature | T3 passive | +50% gathering yield | GatheringEngine.gather |
| Nature | T4 passive | Max yield from nodes | GatheringEngine.gather |
| Survival | T3 passive | Always discover hidden paths | GameLoop path discovery |

### NOT Wired — Missing Systems Required
| Skill | Tier | Ability | Missing System |
|---|---|---|---|
| Perception | T4 | Blindsight / can't be surprised | Surprise system rework (CombatOrchestrator ambush) |
| Persuasion | T4 | Exclusive merchant stock tier | Merchant stock tier system |
| Deception | T4 | Disguise identity | NPC recognition / disguise system |
| History | T3 | Codex reveals monster resistances | Codex auto-enrichment with resistance data |
| Intimidation | T3 | Enemies <25% HP disadvantage | Condition application in CombatOrchestrator per-attack |
| Intimidation | T4 | Enemies flee on ally 0 HP | Enemy morale / flee AI system |
| Survival | T4 | No random encounters while resting | RestingEngine encounter suppression |
| Stealth | T3 | Advantage on surprise attacks | Surprise round advantage system |
| Stealth | T4 | Double damage from stealth | First-strike damage multiplier in CombatResolutionEngine |
| Acrobatics | T3 | +2 AC vs opportunity attacks | Opportunity attack detection in CombatOrchestrator |
| Acrobatics | T4 | Evasion (half dmg DEX saves) | DEX save damage reduction in CombatResolutionEngine |
| Athletics | T3 | Advantage on grapple/shove | StandardActions grapple/shove advantage flag |
| Athletics | T4 | Climb/swim speed | Movement speed system (walk/climb/swim) |
| Animal Handling | T3 | Beasts won't attack | NPC AI hostility by type |
| Animal Handling | T4 | Beast companion | Full companion/pet system |
| Insight | T3 | Auto-detect lies | Dialogue lie detection system |
| Insight | T4 | NPC disposition revealed | NPC disposition display UI |
| Investigation | T3 | Trap sense | Trap detection system |
| Investigation | T4 | Reveal hidden item properties | Item property reveal on DataManager lookup |
| Performance | T3 | Merchant stock refresh on perform | Performance action + merchant restock |
| Performance | T4 | 20% better prices after performance | Performance-to-trade bonus tracking |
| Religion | T3 | Sense undead/fiend 60ft | Entity type detection system |
| Religion | T4 | Undead disadvantage on attacks | Per-creature-type condition in combat |
| Sleight of Hand | T3 | Auto-disarm non-magical traps | Trap disarm system |
| Sleight of Hand | T4 | Disarm weapons on crits | Critical hit disarm effect |
| Cartography | T3 | Reveal adjacent hex biomes | HexMapManager auto-reveal on move |
| Cartography | T4 | 3 hex radius map reveal | HexMapManager bulk reveal |
| Unarmed Combat | T3 | +1 damage die size | Unarmed damage die override in CombatResolutionEngine |
| Unarmed Combat | T4 | Magical unarmed attacks | Damage type bypass in resistance checks |

### Active Abilities — Wiring Status

All active abilities are invokable via `/ability <skill>` and `/chooseability <skill> <tier> <passive|active>`.
The SkillAbilityEngine tracks usage counts and resets per-rest/per-encounter.
However, most active abilities only deduct a use — the mechanical EFFECT is not yet implemented.

**Wired (effect implemented):** None yet — all active abilities currently just consume a use and return a message.

**NOT Wired — Missing Systems for Active Effects:**
| Skill | Tier | Active Ability | Missing System |
|---|---|---|---|
| Acrobatics | T3 | Tumble (free disengage) | Disengage action system in CombatOrchestrator |
| Acrobatics | T4 | Redirect (deflect attack) | Attack redirect in CombatResolutionEngine |
| Animal Handling | T3 | Calm Beast (pacify) | NPC AI hostility override |
| Animal Handling | T4 | Command Beast (control enemy) | Enemy control system |
| Arcana | T3 | Deep Analysis (3 ID attempts) | Already partially handled by tier-based attempt count |
| Arcana | T4 | Dispel (remove magic effect) | Spell/magic effect dispel system |
| Athletics | T3 | Power Shove (damage shove) | Shove damage in StandardActions |
| Athletics | T4 | Titan Grip (auto-grapple) | Auto-succeed grapple in StandardActions |
| Cartography | T3 | Chart Course (0-time move) | Time cost override in ExplorationManager |
| Cartography | T4 | Dimensional Anchor (anti-teleport) | Teleportation system |
| Deception | T3 | Feint (advantage next attack) | Next-attack advantage flag in CombatOrchestrator |
| Deception | T4 | Perfect Lie (auto-convince) | Dialogue auto-succeed system |
| History | T3 | Recall Weakness (+2 dmg) | Damage bonus by creature type |
| History | T4 | Exploit (auto-crit) | Forced critical in CombatResolutionEngine |
| Insight | T3 | Read Intent (learn NPC motive) | NPC motivation reveal system |
| Insight | T4 | Predict Action (enemy next action) | Enemy action preview |
| Intimidation | T3 | Frighten (2 round fear) | Frightened condition application |
| Intimidation | T4 | War Cry (AoE fear) | AoE condition application |
| Investigation | T3 | Thorough Search (3 ID attempts) | Already handled by tier-based count |
| Investigation | T4 | Deduce (enemy next action) | Same as Insight T4 |
| Medicine | T3 | Cure Condition | Condition removal system |
| Medicine | T4 | Emergency Surgery (revive) | Revive from 0 HP mechanic |
| Nature | T3 | Herbalist (identify potions) | Potion identification system |
| Nature | T4 | Commune with Nature (yes/no) | Area query LLM integration |
| Perception | T3 | True Sight (30ft, 1min) | True Sight vision mode |
| Perception | T4 | Eagle Eye (see through walls) | Wall vision system |
| Performance | T3 | Inspire (+1d4) | Inspiration die buff system |
| Performance | T4 | Masterpiece (+2 all checks) | Party-wide temporary buff system |
| Persuasion | T3 | Charm (auto-haggle) | Auto-succeed haggle in ShopEngine |
| Persuasion | T4 | Parley (hostile→neutral) | NPC hostility conversion |
| Religion | T3 | Turn Undead (AoE fear undead) | Undead-specific AoE frighten |
| Religion | T4 | Divine Rebuke (reflect damage) | Damage reflection in CombatOrchestrator |
| Sleight of Hand | T3 | Pickpocket (steal in dialogue) | Dialogue steal system |
| Sleight of Hand | T4 | Plant Evidence (frame NPC) | NPC framing social system |
| Stealth | T3 | Vanish (invisible 1 round) | Invisible condition in combat |
| Stealth | T4 | Shadow Step (teleport 30ft) | Combat teleportation system |
| Survival | T3 | Scout Ahead (encounter preview) | Encounter prediction system |
| Survival | T4 | Tracker (reveal hex enemies) | Enemy reveal on hex |
| Unarmed Combat | T3 | Stunning Strike (stun 1 round) | Stunned condition on hit |
| Unarmed Combat | T4 | Pressure Point (paralyze on crit) | Paralyzed condition on crit |


# ADDTIONAL HOLE DISCOVERED:
on level up for spellcaster, there is no new spell addition! verify & analyse!