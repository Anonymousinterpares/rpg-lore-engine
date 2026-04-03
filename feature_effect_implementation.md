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

### Feature Effects Not Yet in FeatureEffectEngine
- **Action Surge** (Fighter) — grant extra action on turn
- **Bardic Inspiration** (Bard) — d6-d12 to ally's roll
- **Ki** (Monk) — Flurry of Blows, Patient Defense, Step of the Wind
- **Cunning Action** (Rogue) — Dash/Disengage/Hide as bonus action
- **Wild Shape** (Druid) — beast transformation system
- **Channel Divinity** (Cleric/Paladin) — domain/oath-specific effects
- **Font of Magic / Metamagic** (Sorcerer) — sorcery point system
- **Reckless Attack** (Barbarian) — advantage with disadvantage trade
- **All subclass-specific features** (Sculpt Spells, Assassinate, etc.)

### Feat Combat Effects (from future_expansions.md)
- Great Weapon Master: -5/+10 power attack toggle
- Sharpshooter: -5/+10 ranged + ignore cover
- Lucky: 3 rerolls per long rest
- Mobile: +10 speed, no OA after melee
- Sentinel/Polearm Master: OA effects
- War Caster: concentration advantage + spell-as-OA

---

## Test Files
- `src/ruleset/tests/test_combat_features.ts` — CombatResolutionEngine integration (14 tests)
- `src/ruleset/tests/test_feature_effect_engine.ts` — FeatureEffectEngine unit tests (66 tests)
- `src/ruleset/tests/test_duration_tick.ts` — Status effect duration tracking (9 tests)
