# Feature Effect Implementation Tracker

## Architecture

All feature effects are centralized in `src/ruleset/combat/FeatureEffectEngine.ts`.
Fighting style data lives in `data/features/fighting-styles.json`.
CombatOrchestrator and CombatResolutionEngine consume the engine — no feature-specific logic in main combat code.

---

## ✅ Fully Implemented (Backend + Combat Resolution + Tests)

### Extra Attack
- **Classes:** Fighter (2/3/4 at L5/L11/L20), Ranger/Paladin/Monk (2 at L5), Valor Bard (2 at L6)
- **Engine:** `FeatureEffectEngine.computeExtraAttacks()` via lookup table
- **Combat:** CombatOrchestrator attack loop uses `1 + mods.extraAttacks`
- **Edge cases:** Auto-retargets on kill, ammo per attack, stops if out of ammo
- **Tests:** 12 assertions covering all classes, levels, subclass-gated (Valor Bard)

### Improved Critical
- **Classes:** Champion Fighter — crit on 19+ (L3), 18+ (L15)
- **Engine:** `FeatureEffectEngine.computeCritRange()` reads subclass features from class JSON
- **Combat:** CombatResolutionEngine uses `featureContext.critRange`
- **Tests:** 4 assertions (Champion L3/L15, Battle Master, no subclass)

### Sneak Attack
- **Classes:** Rogue — ceil(level/2) d6s
- **Engine:** `FeatureEffectEngine.computeSneakAttack()` checks finesse/ranged + advantage/ally
- **Combat:** CombatResolutionEngine applies bonus dice, once per turn
- **Edge cases:** No trigger without finesse/ranged, no trigger without advantage AND ally, doubles on crit
- **Tests:** 9 assertions (eligibility matrix, dice scaling L1-L19, non-Rogue)

### Fighting Style Bonuses (passive combat effects)
- **Styles:** Archery (+2 attack ranged), Defense (+1 AC armored), Dueling (+2 dmg one-hand), Great Weapon Fighting (reroll 1-2), Two-Weapon Fighting
- **Engine:** `FeatureEffectEngine.computeFightingStyleBonuses()` data-driven from JSON with condition matching
- **Combat:** CombatOrchestrator applies `mods.attackBonus` and `mods.damageBonus`; CombatResolutionEngine handles `rerollDamageBelow`
- **Tests:** 9 assertions (each style with matching/non-matching context)

### Rage (activation + damage bonus)
- **Class:** Barbarian — +2/+3/+4 melee damage by level, 10 round duration
- **Engine:** `FeatureEffectEngine.resolveActivatedFeature("Rage")` consumes use, returns status effect
- **Engine:** `FeatureEffectEngine.isRaging()` checks status effect, `getAttackModifiers()` adds damage bonus
- **Tests:** 8 assertions (activation, double-rage prevention, melee-only, level scaling, resource consumption)

### Divine Smite (activation)
- **Class:** Paladin — 2d8 + 1d8 per slot above 1st (max 5d8), consumes spell slot
- **Engine:** `FeatureEffectEngine.resolveActivatedFeature("Divine Smite", { spellSlotLevel })`
- **Tests:** 5 assertions (L1/L2 scaling, slot consumption, no-slots failure, non-Paladin rejection)

### Second Wind (activation)
- **Class:** Fighter — 1d10 + level HP, short rest recharge
- **Engine:** `FeatureEffectEngine.resolveActivatedFeature("Second Wind")`
- **Tests:** 4 assertions (heal amount, resource consumption, exhaustion)

### Lay on Hands (activation)
- **Class:** Paladin — pool of level × 5 HP, long rest recharge
- **Engine:** `FeatureEffectEngine.resolveActivatedFeature("Lay on Hands", { healAmount })`
- **Tests:** 5 assertions (pool tracking, partial heal, cap at pool, empty pool)

---

### Rage Damage Resistance — ✅ WIRED
- CombatResolutionEngine checks target for `rage` status effect → halves physical damage
- Message shows "(Rage halves to X)"

### Defense Fighting Style AC — ✅ WIRED
- EquipmentEngine.recalculateAC() adds +1 AC when `pc.fightingStyle === 'Defense'` and armor equipped
- Persists outside combat

### Divine Smite Combat Integration — ✅ WIRED
- Paladin activates via ability system → queues `divine_smite_queued` status effect
- CombatOrchestrator: after melee hit, checks for queued smite → applies damage, consumes slot
- Removed after first hit

### Ability Handler Refactored — ✅ DONE
- CombatOrchestrator ability use handler now delegates to `FeatureEffectEngine.resolveActivatedFeature()`
- Legacy Second Wind/Action Surge code replaced
- Handles healing, status effects, and Divine Smite queuing generically

---

## ❌ Not Yet Implemented

### UI Work (deferred)
- Fighting Style selection: Creator step (Fighter L1), level-up overlay (Ranger/Paladin L2)
- Fighting Style display in character sheet
- AbilitiesFlyout redesign: abilities as spell-card style cards
- Rage/Smite/Lay on Hands activation via AbilitiesFlyout
- Fighting Style codex entries

### Action Surge — ✅ IMPLEMENTED
- Activated feature: resets actionSpent, grants extra action
- Consumes featureUsages, validated per Fighter class

### Reckless Attack — ✅ IMPLEMENTED
- Barbarian L2+: grants forceAdvantage on melee, enemies get advantage (status effect)
- No resource cost, duration 1 turn

### Cunning Action — ✅ IMPLEMENTED
- Rogue L2+: confirms availability for Dash/Disengage/Hide as bonus action
- Class and level validated

### Unarmored Defense — ✅ IMPLEMENTED
- Barbarian: AC = 10 + DEX + CON (when no armor)
- Monk: AC = 10 + DEX + WIS (when no armor)
- Wired in EquipmentEngine.recalculateAC()

### Danger Sense — ✅ IMPLEMENTED
- Barbarian L2+: advantage on DEX saves (exposed via getDefenseModifiers)

### Evasion — ✅ IMPLEMENTED
- Rogue/Monk L7+: DEX save success = 0 damage, fail = half
- Wired in CombatResolutionEngine.resolveSpell()

### Uncanny Dodge — ✅ IMPLEMENTED
- Rogue L5+: reaction to halve one attack's damage
- Exposed via getDefenseModifiers()

### Assassinate — ✅ IMPLEMENTED
- Assassin Rogue L3+: advantage vs not-acted targets, auto-crit on surprised
- forceAdvantage + forceCrit in AttackModifiers, wired in CombatResolutionEngine

### Remarkable Athlete — ✅ IMPLEMENTED
- Champion Fighter L7+: half proficiency bonus on unproficient STR/DEX/CON checks

### Great Weapon Master — ✅ IMPLEMENTED
- Feat: -5 attack / +10 damage on two-handed melee (toggle via gwmEnabled context)

### Sharpshooter — ✅ IMPLEMENTED
- Feat: -5 attack / +10 damage ranged + ignore cover (toggle via sharpshooterEnabled context)

### Mobile — ✅ IMPLEMENTED
- Feat: +10 movement speed (stacks with class bonuses)
- Barbarian L5+ fast movement also implemented
- Monk unarmored movement scaling (L2-L18) also implemented

### Resilient — ✅ IMPLEMENTED
- Feat: save proficiency tracked via savingThrowProficiencies

### Sculpt Spells — ✅ IMPLEMENTED
- Evocation Wizard L2+: AoE evocation spells exempt 1+spell level friendly targets
- Protected allies auto-succeed save and take 0 damage
- Wired in SpellManager target loop

### Reckless Attack Enemy Advantage — ✅ IMPLEMENTED
- Enemies get forceAdvantage when attacking a reckless Barbarian
- Wired in CombatOrchestrator.performAITurn()
- Statistical test confirms ~63% more hits against reckless target

### Feature Effects Still Not in FeatureEffectEngine
- **Bardic Inspiration** (Bard) — d6-d12 to ally's roll (needs target selection UI)
- **Ki** (Monk) — Flurry of Blows, Patient Defense, Step of the Wind (needs sub-ability UI)
- **Wild Shape** (Druid) — beast transformation system (major new system)
- **Channel Divinity** (Cleric/Paladin) — domain/oath-specific effects (9+ implementations)
- **Font of Magic / Metamagic** (Sorcerer) — sorcery point system (needs new resource)

### Feat Effects Still Not Implemented
- Lucky: 3 rerolls per long rest (needs mid-roll UI prompt)
- Sentinel/Polearm Master: OA effects (needs opportunity attack rework)
- War Caster: concentration advantage + spell-as-OA (needs OA rework)

---

## ❌ Documentation & Codex — NOT YET IMPLEMENTED

### Codex Entries (player-facing, in-game)
Each feature needs a codex entry accessible from the game. Entries should be **locked/hidden until the player has the feature** (class, subclass, or feat that grants it).

**Class Feature Codex Entries (unlock when feature is gained):**
- Extra Attack, Action Surge, Second Wind, Indomitable (Fighter)
- Rage, Reckless Attack, Danger Sense, Unarmored Defense (Barbarian)
- Sneak Attack, Cunning Action, Uncanny Dodge, Evasion (Rogue)
- Divine Smite, Lay on Hands, Aura of Protection (Paladin)
- Ki, Unarmored Defense, Unarmored Movement (Monk)
- Bardic Inspiration, Song of Rest (Bard)
- Wild Shape, Natural Recovery (Druid)
- Spellcasting, Arcane Recovery, Arcane Tradition overview (Wizard)
- Font of Magic, Metamagic (Sorcerer)
- Pact Magic, Eldritch Invocations (Warlock)
- Channel Divinity, Divine Domain overview (Cleric)
- Favored Enemy, Natural Explorer (Ranger)

**Subclass Codex Entries (unlock when subclass is chosen):**
- All 30 subclasses need individual entries with description + feature list
- Should be accessible from the Class Features overlay info icons

**Fighting Style Codex Entry:**
- General mechanics page explaining Fighting Styles
- Each style as a sub-entry with full description

**Feat Codex Entries (unlock when feat is taken):**
- Each of the 12 feats (Alert, Tough, GWM, Sharpshooter, Mobile, etc.)
- Mechanical effects explained clearly

**Mechanics Codex Entries (always available):**
- How Extra Attack works (general)
- How Saving Throws work (with Evasion, Danger Sense explained)
- How Critical Hits work (with Improved Critical explained)
- How Sneak Attack eligibility works
- How Concentration works
- How Advantage/Disadvantage work

### Codebase Documentation
- `FeatureEffectEngine.ts` — architecture doc: how to add new features
- `data/features/fighting-styles.json` — format documentation
- Class feature data flow: JSON → DataManager → LevelingEngine → FeatureEffectEngine → CombatOrchestrator
- Testing guide: how to write and run CLI tests

---

## Test Files
- `src/ruleset/tests/test_combat_features.ts` — CombatResolutionEngine integration (14 tests)
- `src/ruleset/tests/test_feature_effect_engine.ts` — FeatureEffectEngine unit tests (66 tests)
- `src/ruleset/tests/test_duration_tick.ts` — Status effect duration tracking (9 tests)
- `src/ruleset/tests/test_all_features.ts` — All 15 features comprehensive (79 tests)



# new potential gap:
    6. Temporary flags (_pendingASI, _pendingSubclass, _pendingFightingStyle, _pendingSpellChoices, _newFeatures) — These
     use underscore prefix and are stored on the character object. They will persist in saves since PlayerCharacterSchema
     uses Zod which strips unknown fields only if .strict() is used (it's not). However, these are transient flags that
    should probably be cleared on load to avoid stale prompts showing up.

    Potential gap: Those _pending* flags persisting across save/load could cause issues — e.g., loading a save where
    _pendingSubclass was true but the player already chose a subclass in a different session. Since Zod's .parse() with
    .default() doesn't strip extra fields, these could linger.

    Recommendation (after verification if necessary): A cleanup step in GameStateManager.loadGame() should clear transient flags:
    - Delete _pendingSubclass if subclass is already set
    - Delete _pendingFightingStyle if fightingStyle is already set
    - Delete _pendingSpellChoices if value is 0
    - Delete _newFeatures always (it's a one-time UI highlight)