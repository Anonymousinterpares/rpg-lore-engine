# Feature Effect Architecture

## Overview

All D&D 5e class features, subclass features, feats, and fighting styles are centralized in the **FeatureEffectEngine** (`src/ruleset/combat/FeatureEffectEngine.ts`). Combat code (CombatOrchestrator, CombatResolutionEngine) consumes the engine — no feature-specific logic in main combat code.

## File Structure

```
src/ruleset/combat/
├── FeatureEffectEngine.ts    # Core engine: all passive/activated feature effects
├── OAEngine.ts               # Opportunity Attack detection + resolution
├── CombatResolutionEngine.ts # Attack/spell resolution (consumes FeatureEffectEngine output)
├── managers/
│   └── CombatOrchestrator.ts # Combat flow (consumes FeatureEffectEngine + OAEngine)
├── CombatManager.ts          # Movement (consumes OAEngine)
├── EquipmentEngine.ts        # AC calculation (Defense style, Unarmored Defense)
├── AbilityParser.ts          # Extracts abilities for UI display
├── LevelingEngine.ts         # Level-up: feature activation, spell learning, subclass/style selection

data/
├── class/*.json              # 12 classes with allFeatures, subclasses (30 total), progression (L1-20)
├── features/
│   └── fighting-styles.json  # 6 fighting styles with declarative conditions and effects
├── feats/
│   └── feats.json            # 12 feats with effects
```

## Adding a New Feature

### Passive Feature (always-on during combat)

1. Add logic to `FeatureEffectEngine.getAttackModifiers()` or `getDefenseModifiers()`
2. The method receives `PlayerCharacter` + `AttackContext` and returns `AttackModifiers`
3. CombatOrchestrator/CombatResolutionEngine automatically apply returned values
4. No changes needed in combat flow code

**Example: Improved Critical**
```typescript
// In FeatureEffectEngine.computeCritRange():
if (subclass.features.some(f => f.name === 'Improved Critical' && f.level <= pc.level)) return 19;

// CombatResolutionEngine automatically uses featureContext.critRange
```

### Activated Feature (player choice via /ability command)

1. Add a case to `FeatureEffectEngine.resolveActivatedFeature()` switch
2. Implement a private static method that validates resources and returns `ActivatedFeatureResult`
3. CombatOrchestrator's `useAbility()` handler automatically applies healing, status effects, etc.

**Example: Rage**
```typescript
case 'Rage': return this.resolveRage(pc);

private static resolveRage(pc): ActivatedFeatureResult {
    // Check resources, consume, return status effect
    return { success: true, statusEffect: { id: 'rage', ... }, message: '...' };
}
```

### Data-Driven Feature (Fighting Style)

1. Add entry to `data/features/fighting-styles.json`
2. The condition matcher automatically applies bonuses when context matches
3. No code changes needed

```json
{
    "name": "Archery",
    "effects": { "attackBonus": 2, "condition": { "isRanged": true } }
}
```

## Command Flow

```
UI Click "Abilities" → AbilitiesFlyout
   ↓
Click ability → processCommand("/ability Second Wind")
   ↓
IntentRouter.parse() → { type: 'COMMAND', command: 'ability', args: ['Second', 'Wind'] }
   ↓
GameLoop.handleCommand() → case 'ability' → combatOrchestrator.useAbility("second wind")
   ↓
CombatOrchestrator.useAbility():
  1. ensureFeatureUsages(char)         // Defensive: populate missing entries
  2. AbilityParser.getCombatAbilities() // Find ability by name
  3. Check action economy (action/bonus/reaction spent?)
  4. FeatureEffectEngine.resolveActivatedFeature()
  5. Apply healAmount, statusEffect, grantExtraAction
   ↓
Result displayed in combat narrative
```

**Important:** `/ability` is for class features. `/use` is for inventory items (potions, scrolls).

## Attack Flow

```
Player clicks "Attack"
   ↓
CombatOrchestrator.handleCombatAction({ command: 'attack' }):
  1. Build AttackContext (weapon type, offhand, armor, ally near target, etc.)
  2. FeatureEffectEngine.getAttackModifiers(pc, context) → AttackModifiers
  3. Apply fighting style attackBonus to modifiers
  4. Apply rage/feat damage bonus
  5. Loop: for each attack (1 + extraAttacks):
     a. CombatResolutionEngine.resolveAttack(... featureContext)
        - critRange (Improved Critical)
        - sneakAttackDice + eligibility
        - rerollDamageBelow (Great Weapon Fighting)
        - forceAdvantage (Reckless, Assassinate)
        - forceCrit (Assassinate on surprised)
        - ignoreCover (Sharpshooter)
     b. Sneak Attack: auto-applied once per turn if eligible
     c. Divine Smite: auto-applied if queued
     d. Apply damage, consume ammo, track results
```

## Movement + Opportunity Attacks

```
Player moves → CombatManager.moveCombatant()
   ↓
OAEngine.resolveOAsOnPath(mover, path, combatants, grid):
  1. For each step along path:
     - Check if mover leaves any enemy's reach
     - If yes + enemy has reaction available + mover not Disengaged:
       → Execute OA (resolveAttack with default weapon)
       → If Sentinel hit: stop movement, set speed to 0
       → If target killed: stop movement
     - Check Polearm Master: entering reach also provokes
  2. Return results + stopAtIndex
   ↓
CombatManager applies damage, adjusts final position
```

## Feature Usages (Resource Management)

Features with limited uses are tracked in `pc.featureUsages`:
```typescript
{
    "Second Wind": { current: 1, max: 1, usageType: "SHORT_REST" },
    "Rage": { current: 3, max: 3, usageType: "LONG_REST" },
    "Ki": { current: 5, max: 5, usageType: "SHORT_REST" },
    "Channel Divinity": { current: 1, max: 1, usageType: "SHORT_REST" },
    "Lay on Hands": { current: 25, max: 25, usageType: "LONG_REST" },
    "Lucky": { current: 3, max: 3, usageType: "LONG_REST" }
}
```

`ensureFeatureUsages()` in CombatOrchestrator populates missing entries from class JSON data on first ability use, handling characters from old saves or skipped levels.

`RestingEngine` resets SHORT_REST features on short rest and all features on long rest.

## Subclass System

- 30 subclasses across 12 classes in `data/class/*.json`
- `pc.subclass` field on PlayerCharacterSchema
- Level 1 classes (Cleric/Sorcerer/Warlock): chosen at character creation
- Level 2-3 classes: chosen via SubclassPickerOverlay at level-up
- Subclass features added to featureUsages on level-up
- Domain/oath spells auto-prepared, don't count against preparation limit
- AbilityParser includes subclass features in Class Features display

## Fighting Style System

- 6 styles in `data/features/fighting-styles.json` (data-driven)
- Fighter: chosen at character creation (new step in CharacterCreator)
- Ranger/Paladin: chosen at level 2 via level-up overlay
- `pc.fightingStyle` field on PlayerCharacterSchema
- Defense: +1 AC applied in EquipmentEngine.recalculateAC()
- Others: applied via FeatureEffectEngine.getAttackModifiers()

## Testing

9 test suites, ~424 tests total:

| Suite | File | Tests | Coverage |
|-------|------|-------|----------|
| Combat Features | `test_combat_features.ts` | 14 | CombatResolutionEngine: crit, sneak attack |
| FeatureEffectEngine | `test_feature_effect_engine.ts` | 66 | All passive + activated features |
| Duration Tracking | `test_duration_tick.ts` | 9 | Status effect per-turn tick |
| All 15 Features | `test_all_features.ts` | 79 | Each feature with edge cases |
| Sculpt + Reckless | `test_sculpt_reckless.ts` | 21 | AoE sculpting, enemy advantage |
| Bardic/Ki/Channel/Lucky | `test_bardic_ki_channel_lucky.ts` | 72 | All activated features, cross-class |
| Opportunity Attacks | `test_opportunity_attacks.ts` | 29 | OA system, Sentinel, Polearm Master |
| Integration | `test_integration_abilities.ts` | 48 | Full pipeline: IntentRouter → engine |
| Visual Scenarios | `test_visual_scenarios.ts` | 87 | All 10 user test scenarios |

Run all: `for suite in test_combat_features test_feature_effect_engine test_duration_tick test_all_features test_sculpt_reckless test_bardic_ki_channel_lucky test_opportunity_attacks test_integration_abilities test_visual_scenarios; do npx tsx src/ruleset/tests/$suite.ts; done`

## Implemented Features Summary

### Class Features (25 features)
| Feature | Class | Type | Status |
|---------|-------|------|--------|
| Extra Attack | Fighter/Ranger/Paladin/Monk/Bard | Passive | ✅ |
| Improved Critical / Superior Critical | Champion Fighter | Passive | ✅ |
| Sneak Attack | Rogue | Passive (auto) | ✅ |
| Second Wind | Fighter | Activated | ✅ |
| Action Surge | Fighter | Activated | ✅ |
| Rage | Barbarian | Activated | ✅ |
| Rage Damage Resistance | Barbarian | Passive (while raging) | ✅ |
| Reckless Attack | Barbarian | Activated | ✅ |
| Reckless Enemy Advantage | Barbarian | Passive (enemies get advantage) | ✅ |
| Unarmored Defense | Barbarian/Monk | Passive | ✅ |
| Danger Sense | Barbarian | Passive | ✅ |
| Cunning Action | Rogue | Activated | ✅ |
| Uncanny Dodge | Rogue | Passive (defense) | ✅ |
| Evasion | Rogue/Monk | Passive (defense) | ✅ |
| Assassinate | Assassin Rogue | Passive | ✅ |
| Remarkable Athlete | Champion Fighter | Passive | ✅ |
| Divine Smite | Paladin | Activated (queued) | ✅ |
| Lay on Hands | Paladin | Activated | ✅ |
| Bardic Inspiration | Bard | Activated | ✅ |
| Ki (3 sub-abilities) | Monk | Activated | ✅ |
| Channel Divinity (10 variants) | Cleric/Paladin | Activated | ✅ |
| Sculpt Spells | Evocation Wizard | Passive (AoE) | ✅ |
| Fighting Styles (6) | Fighter/Ranger/Paladin | Passive | ✅ |
| Arcane Recovery | Wizard | Activated (rest) | ✅ |
| Movement Speed Bonuses | Barbarian/Monk/Mobile | Passive | ✅ |

### Feat Effects (7 feats)
| Feat | Effect | Status |
|------|--------|--------|
| Great Weapon Master | -5/+10 two-handed melee toggle | ✅ |
| Sharpshooter | -5/+10 ranged + ignore cover toggle | ✅ |
| Mobile | +10 movement speed | ✅ |
| Lucky | 3 d20 rerolls per long rest | ✅ |
| Sentinel | OA stops movement, ignores Disengage | ✅ |
| Polearm Master | Entering reach provokes OA | ✅ |
| Resilient | Save proficiency for chosen ability | ✅ |

### Combat Systems
| System | Status |
|--------|--------|
| Opportunity Attacks | ✅ Per-step path analysis, faction-aware |
| Disengage prevents OA | ✅ Status effect properly checked |
| OA Warnings (easy/normal) | ✅ getOAWarnings() |
| Shield spell (+5 AC) | ✅ Status effect + buff indicator |
| Spell Upcasting | ✅ Full UI + scaling |
| Spell Slot Management | ✅ All 12 classes, L1-20 |
| Arcane Recovery | ✅ Proportional budget flyout |
| Domain Spell Preparation | ✅ Don't count against limit |

### Deferred Features
| Feature | Reason |
|---------|--------|
| Wild Shape (Druid) | Major new system: beast stat blocks, form transformation |
| Font of Magic / Metamagic (Sorcerer) | New resource system + spell modification pipeline |
| Eldritch Invocations (Warlock) | New customizable ability list |
| War Caster | Depends on OA spell-casting (deferred: auto-melee used) |
