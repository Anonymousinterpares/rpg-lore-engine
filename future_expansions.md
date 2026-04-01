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
