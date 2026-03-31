# Implementation Plan: Rest Guidance + ItemForgeEngine

---

# PART A: Rest Guidance via Narrator System Prompt — ✅ COMPLETED (2026-03-31)

## Problem
When a player types "I want to rest for the night" or similar natural language, IntentRouter classifies it as `NARRATIVE` (not a command). The Narrator LLM generates a narrative response but has no instruction to guide the player toward the actual rest mechanic. The player gets a story paragraph but no HP recovery.

## Solution (REVISED from original plan)
Three-part rework of the rest/wait narration UX:
1. **Pre-rest**: Minimal hint only — LLM responds with brief acknowledgment + `[You can use the Rest button to rest and recover.]`. No premature camping narration.
2. **Post-rest/wait narration**: AFTER rest actually completes, LLM generates time-accurate atmospheric narration (matching actual duration, time of day, weather, biome) with mechanical recovery info appended.
3. **Ambush pre-combat narration**: When encounters interrupt rest, LLM generates tense ambush narration that types out fully in NarrativeBox BEFORE combat mode activates (trigger-based, not time-based).

## Files Modified
- `src/ruleset/agents/NarratorService.ts` — PLAYER ACTION GUIDANCE prompt section (minimal hint); `narrateRestCompletion()` + `narrateAmbush()` methods
- `src/ruleset/combat/GameLoop.ts` — async `completeRest()` with LLM narration; `generateAmbushNarration()`; `initializeCombat()` accepts pre-narration; `setNarrative()` for state propagation; `/rest` + `/wait` command handlers updated
- `src/ruleset/combat/managers/TimeManager.ts` — `completeRest()` made async
- `src/ui/components/narrative/NarrativeBox.tsx` — `onTypingComplete` callback (ref-based to avoid re-triggering)
- `src/ui/components/layout/MainViewport.tsx` — `pendingCombat` state; `handleAmbush`/`handleTypingComplete` flow; action bar shows "Ambush..." during narration
- `src/ui/components/exploration/RestWaitModal.tsx` — `onAmbush` prop; fire-and-forget rest completion (modal closes immediately)
- `cli/repl.ts` — CLI hint detection translating UI hints to CLI commands
- `cli/tests/test_rest_guidance.ts` — 21 assertions, all passing

## Files to Modify

### `src/ruleset/agents/NarratorService.ts` — constructSystemPrompt()
After line 206 (after the RESUMING ADVENTURE section), add:

```typescript
prompt += `
## PLAYER ACTION GUIDANCE
When the player expresses intent to rest, camp, sleep, make camp, set up for the night,
or recover — you MUST do BOTH of the following:
1. Narrate the scene: describe finding shelter, building a fire, settling in.
2. End your narrative with this EXACT line on its own paragraph:
   "[Type 'rest' to open the rest menu, or '/rest 480' for a long rest, '/rest 60' for a short rest]"

Do NOT claim the character has rested, recovered HP, or restored spell slots.
The rest system handles all mechanical recovery — you only describe the atmosphere.

Similarly, when the player wants to trade, talk to an NPC, or use inventory:
- Trade: "[Type '/trade <npc_name>' to open the trading interface]"
- Talk: "[Type '/talk <npc_name>' to start a conversation]"
- Inventory: "[Use the inventory panel or type '/item_equip <name>' to equip items]"
`;
```

### `cli/repl.ts` — Add hint detection for CLI
In the REPL loop, after printing the response, detect the `[Type 'rest'...]` hint and optionally auto-prompt:

```typescript
if (response.includes("[Type 'rest'")) {
    console.log('  (Hint: type /rest 480 for long rest, /rest 60 for short rest)');
}
```

## Test Plan
1. Start game via CLI, type "I want to set up camp for the night"
2. Without LLM: response falls back to system message (acceptable)
3. With LLM: response should include the `[Type 'rest'...]` guidance
4. Verify that typing `/rest 480` after the guidance works correctly

## Deliverables
- Modified: `src/ruleset/agents/NarratorService.ts` (1 section added to system prompt)
- Modified: `cli/repl.ts` (hint detection, 3 lines)

---

# PART B: ItemForgeEngine — Dynamic Item Generation

## Overview
A new engine that generates items with level-scaled, rarity-driven stats and context-aware magical properties. Covers weapons, armor, and jewelry. LLM names/describes; engine decides all mechanics.

## Architecture

```
Monster defeated (type: "undead", cr: 5, biome: "Ruins")
        ↓
LootEngine calls ItemForgeEngine.forgeItem()
        ↓
    ┌──────────────────────────────────────┐
    │ 1. Determine item level (from CR)    │
    │ 2. Roll rarity (weighted by CR)      │
    │ 3. Pick base item (from category)    │
    │ 4. Roll stat bonuses (level×rarity)  │
    │ 5. Roll magical property (rarity %)  │
    │ 6. Pick element (monster type pool)  │
    │ 7. Validate via ItemSchema.parse()   │
    └──────────────────────────────────────┘
        ↓
    Optional: LLM names the item (async, non-blocking)
        ↓
    Item added to combatLoot
```

## Phase 1: Schema Extensions

### `src/ruleset/schemas/ItemSchema.ts`
Add new fields to BaseItemSchema:

```typescript
// New fields (all optional, backwards-compatible with existing 255 items)
rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary']).default('Common'),
itemLevel: z.number().min(1).max(20).default(1),
isForged: z.boolean().default(false),           // true = generated at runtime
forgeSource: z.string().optional(),              // e.g., "Skeleton CR 0.25 Ruins"
magicalProperties: z.array(z.object({
    type: z.enum([
        'BonusDamage',        // +Xd4 Fire/Cold/etc.
        'Resistance',          // Resistance to damage type
        'StatBonus',           // +X to ability score
        'SaveBonus',           // +X to saving throws
        'ConditionImmunity',   // Immune to Frightened, etc.
        'SpellCharge',         // Cast spell X times per rest
        'BonusAC',             // +X AC (jewelry/cloaks)
    ]),
    element: z.string().optional(),    // "Fire", "Necrotic", etc.
    value: z.number().optional(),      // Bonus amount or dice average
    dice: z.string().optional(),       // "1d4", "1d6" for variable bonuses
    spellName: z.string().optional(),  // For SpellCharge type
    maxCharges: z.number().optional(), // For SpellCharge type
    description: z.string().optional() // Flavor text for this property
})).default([]),
```

### `src/ruleset/schemas/ItemSchema.ts` — Extend ModifierSchema
Add new modifier types:

```typescript
export const ModifierSchema = z.object({
    type: z.enum([
        'StatBonus', 'ACBonus', 'DamageAdd', 'AbilitySET', 'RangePenaltyReduction',
        // New:
        'HitBonus',           // +X to attack rolls
        'SaveBonus',          // +X to saving throws
        'DamageResistance',   // Resistance to a damage type
    ]),
    target: z.string(),
    value: z.number()
});
```

## Phase 2: Forge Configuration Data

### New file: `src/ruleset/data/ForgeConfig.ts`

#### Rarity Probability (rolled by engine, NOT LLM)

```typescript
// CR → weighted rarity probability
export const RARITY_WEIGHTS: Record<string, Record<string, number>> = {
    'CR_0-1':   { Common: 70, Uncommon: 25, Rare: 5,  'Very Rare': 0, Legendary: 0 },
    'CR_2-4':   { Common: 50, Uncommon: 35, Rare: 12, 'Very Rare': 3, Legendary: 0 },
    'CR_5-8':   { Common: 25, Uncommon: 35, Rare: 25, 'Very Rare': 12, Legendary: 3 },
    'CR_9-12':  { Common: 10, Uncommon: 25, Rare: 35, 'Very Rare': 25, Legendary: 5 },
    'CR_13-16': { Common: 5,  Uncommon: 15, Rare: 30, 'Very Rare': 35, Legendary: 15 },
    'CR_17-20': { Common: 0,  Uncommon: 10, Rare: 25, 'Very Rare': 35, Legendary: 30 },
};
```

#### Magical Property Probability (by rarity, NOT LLM)

```typescript
export const MAGIC_CHANCE: Record<string, number> = {
    'Common':    0.00,   // NEVER magical
    'Uncommon':  0.15,   // 15% chance
    'Rare':      0.75,   // 75% chance
    'Very Rare': 1.00,   // Always magical
    'Legendary': 1.00,   // Always magical
};
```

#### Item Level → CR Mapping

```typescript
export function crToItemLevel(cr: number): number {
    // Item level tracks CR, clamped 1-20
    return Math.max(1, Math.min(20, Math.ceil(cr) || 1));
}

export function crToLevelTier(cr: number): string {
    const level = crToItemLevel(cr);
    if (level <= 4)  return '1-4';
    if (level <= 8)  return '5-8';
    if (level <= 12) return '9-12';
    if (level <= 16) return '13-16';
    return '17-20';
}
```

#### Stat Bonus Tables (level tier × rarity)

```typescript
// [min, max] ranges — engine rolls randomly within
export const WEAPON_BONUSES: Record<string, Record<string, {
    hitBonus: [number, number],
    damageBonus: [number, number],     // flat bonus
    bonusDamageDice: string | null,    // e.g., "1d4" or null
}>> = {
    '1-4': {
        'Common':    { hitBonus: [0, 0],  damageBonus: [0, 0],  bonusDamageDice: null },
        'Uncommon':  { hitBonus: [1, 1],  damageBonus: [0, 0],  bonusDamageDice: null },
        'Rare':      { hitBonus: [1, 1],  damageBonus: [0, 1],  bonusDamageDice: '1d4' },
        'Very Rare': { hitBonus: [2, 2],  damageBonus: [0, 1],  bonusDamageDice: '1d4' },
        'Legendary': { hitBonus: [3, 3],  damageBonus: [1, 2],  bonusDamageDice: '1d6' },
    },
    '5-8': {
        'Common':    { hitBonus: [0, 0],  damageBonus: [0, 0],  bonusDamageDice: null },
        'Uncommon':  { hitBonus: [1, 1],  damageBonus: [0, 1],  bonusDamageDice: null },
        'Rare':      { hitBonus: [2, 2],  damageBonus: [0, 1],  bonusDamageDice: '1d4' },
        'Very Rare': { hitBonus: [2, 2],  damageBonus: [1, 1],  bonusDamageDice: '1d6' },
        'Legendary': { hitBonus: [3, 3],  damageBonus: [1, 2],  bonusDamageDice: '1d8' },
    },
    '9-12': {
        'Common':    { hitBonus: [1, 1],  damageBonus: [0, 0],  bonusDamageDice: null },
        'Uncommon':  { hitBonus: [1, 1],  damageBonus: [0, 1],  bonusDamageDice: null },
        'Rare':      { hitBonus: [2, 2],  damageBonus: [1, 1],  bonusDamageDice: '1d6' },
        'Very Rare': { hitBonus: [3, 3],  damageBonus: [1, 1],  bonusDamageDice: '1d6' },
        'Legendary': { hitBonus: [3, 3],  damageBonus: [1, 2],  bonusDamageDice: '1d10' },
    },
    '13-16': {
        'Common':    { hitBonus: [1, 1],  damageBonus: [0, 0],  bonusDamageDice: null },
        'Uncommon':  { hitBonus: [2, 2],  damageBonus: [0, 1],  bonusDamageDice: null },
        'Rare':      { hitBonus: [2, 2],  damageBonus: [1, 1],  bonusDamageDice: '1d8' },
        'Very Rare': { hitBonus: [3, 3],  damageBonus: [1, 2],  bonusDamageDice: '1d8' },
        'Legendary': { hitBonus: [3, 3],  damageBonus: [2, 2],  bonusDamageDice: '2d6' },
    },
    '17-20': {
        'Common':    { hitBonus: [1, 1],  damageBonus: [0, 0],  bonusDamageDice: null },
        'Uncommon':  { hitBonus: [2, 2],  damageBonus: [0, 1],  bonusDamageDice: null },
        'Rare':      { hitBonus: [3, 3],  damageBonus: [1, 1],  bonusDamageDice: '1d8' },
        'Very Rare': { hitBonus: [3, 3],  damageBonus: [1, 2],  bonusDamageDice: '1d10' },
        'Legendary': { hitBonus: [3, 3],  damageBonus: [2, 3],  bonusDamageDice: '2d8' },
    },
};

export const ARMOR_BONUSES: Record<string, Record<string, {
    acBonus: [number, number],
}>> = {
    '1-4':   { Common: {acBonus:[0,0]}, Uncommon: {acBonus:[1,1]}, Rare: {acBonus:[1,1]}, 'Very Rare': {acBonus:[2,2]}, Legendary: {acBonus:[3,3]} },
    '5-8':   { Common: {acBonus:[0,0]}, Uncommon: {acBonus:[1,1]}, Rare: {acBonus:[1,2]}, 'Very Rare': {acBonus:[2,2]}, Legendary: {acBonus:[3,3]} },
    '9-12':  { Common: {acBonus:[0,1]}, Uncommon: {acBonus:[1,1]}, Rare: {acBonus:[2,2]}, 'Very Rare': {acBonus:[2,3]}, Legendary: {acBonus:[3,3]} },
    '13-16': { Common: {acBonus:[0,1]}, Uncommon: {acBonus:[1,2]}, Rare: {acBonus:[2,2]}, 'Very Rare': {acBonus:[3,3]}, Legendary: {acBonus:[3,3]} },
    '17-20': { Common: {acBonus:[0,1]}, Uncommon: {acBonus:[1,2]}, Rare: {acBonus:[2,3]}, 'Very Rare': {acBonus:[3,3]}, Legendary: {acBonus:[3,3]} },
};

export const JEWELRY_BONUSES: Record<string, Record<string, {
    statBonus: [number, number],       // To a random ability score
    saveBonus: [number, number],       // To saving throws
}>> = {
    '1-4':   { Common: {statBonus:[0,0],saveBonus:[0,0]}, Uncommon: {statBonus:[1,1],saveBonus:[0,0]}, Rare: {statBonus:[1,1],saveBonus:[1,1]}, 'Very Rare': {statBonus:[2,2],saveBonus:[1,1]}, Legendary: {statBonus:[2,3],saveBonus:[1,2]} },
    '5-8':   { Common: {statBonus:[0,0],saveBonus:[0,0]}, Uncommon: {statBonus:[1,1],saveBonus:[0,1]}, Rare: {statBonus:[1,2],saveBonus:[1,1]}, 'Very Rare': {statBonus:[2,2],saveBonus:[1,2]}, Legendary: {statBonus:[2,3],saveBonus:[2,2]} },
    '9-12':  { Common: {statBonus:[0,1],saveBonus:[0,0]}, Uncommon: {statBonus:[1,1],saveBonus:[1,1]}, Rare: {statBonus:[2,2],saveBonus:[1,1]}, 'Very Rare': {statBonus:[2,3],saveBonus:[2,2]}, Legendary: {statBonus:[3,3],saveBonus:[2,3]} },
    '13-16': { Common: {statBonus:[0,1],saveBonus:[0,0]}, Uncommon: {statBonus:[1,2],saveBonus:[1,1]}, Rare: {statBonus:[2,2],saveBonus:[1,2]}, 'Very Rare': {statBonus:[3,3],saveBonus:[2,2]}, Legendary: {statBonus:[3,3],saveBonus:[2,3]} },
    '17-20': { Common: {statBonus:[0,1],saveBonus:[0,1]}, Uncommon: {statBonus:[1,2],saveBonus:[1,1]}, Rare: {statBonus:[2,3],saveBonus:[2,2]}, 'Very Rare': {statBonus:[3,3],saveBonus:[2,3]}, Legendary: {statBonus:[3,3],saveBonus:[3,3]} },
};
```

#### Context-Aware Element Pools (monster type → valid elements)

```typescript
export const ELEMENT_POOLS: Record<string, string[]> = {
    // Monster type → valid magical damage/resistance types
    'undead':      ['Necrotic', 'Cold', 'Radiant'],
    'fiend':       ['Fire', 'Necrotic', 'Poison'],
    'celestial':   ['Radiant', 'Force', 'Thunder'],
    'dragon':      ['Fire', 'Cold', 'Lightning', 'Acid', 'Poison'],
    'elemental':   ['Fire', 'Cold', 'Lightning', 'Thunder'],
    'fey':         ['Psychic', 'Radiant', 'Force'],
    'aberration':  ['Psychic', 'Force', 'Acid'],
    'construct':   ['Force', 'Lightning', 'Thunder'],
    'monstrosity': ['Poison', 'Acid'],
    'ooze':        ['Acid', 'Poison'],
    'plant':       ['Poison', 'Radiant'],
    'beast':       ['Poison'],
    'giant':       ['Cold', 'Thunder', 'Lightning'],
    'humanoid':    ['Fire', 'Cold', 'Lightning', 'Radiant', 'Necrotic', 'Poison', 'Acid'],
};

// Biome fallback (if monster type not matched)
export const BIOME_ELEMENT_POOLS: Record<string, string[]> = {
    'Volcanic':  ['Fire'],
    'Tundra':    ['Cold', 'Thunder'],
    'Swamp':     ['Poison', 'Acid', 'Necrotic'],
    'Ruins':     ['Necrotic', 'Force', 'Radiant'],
    'Forest':    ['Poison', 'Lightning', 'Radiant'],
    'Desert':    ['Fire', 'Radiant'],
    'Mountain':  ['Cold', 'Lightning', 'Thunder'],
    'Ocean':     ['Cold', 'Lightning', 'Thunder'],
    'Coast':     ['Cold', 'Lightning'],
    'Jungle':    ['Poison', 'Acid'],
    'Plains':    ['Lightning', 'Radiant'],
    'Hills':     ['Thunder', 'Lightning'],
    'Urban':     ['Fire', 'Radiant', 'Force'],
    'Farmland':  ['Radiant'],
};

// Magical trait pool for jewelry (Rare+)
export const JEWELRY_TRAIT_POOL = [
    { type: 'Resistance', description: 'Resistance to {element} damage' },
    { type: 'ConditionImmunity', conditions: ['Frightened', 'Charmed', 'Poisoned'] },
    { type: 'SpellCharge', spells: ['Shield', 'Misty Step', 'Detect Magic', 'Feather Fall'] },
];

// Gold value multipliers by rarity
export const RARITY_VALUE_MULTIPLIER: Record<string, number> = {
    'Common': 1,
    'Uncommon': 5,
    'Rare': 50,
    'Very Rare': 500,
    'Legendary': 5000,
};
```

## Phase 3: ItemForgeEngine

### New file: `src/ruleset/combat/ItemForgeEngine.ts`

#### Public API

```typescript
export class ItemForgeEngine {
    /**
     * Main entry point. Generates a complete item with stats, rarity, and optional magic.
     */
    static forgeItem(params: ForgeParams): ForgedItem

    /**
     * Roll rarity based on CR-weighted probability table.
     */
    static rollRarity(cr: number): Rarity

    /**
     * Derive item level from monster CR.
     */
    static crToItemLevel(cr: number): number

    /**
     * Forge a weapon from a base template.
     */
    static forgeWeapon(base: Item, level: number, rarity: Rarity, context: ForgeContext): ForgedItem

    /**
     * Forge armor from a base template.
     */
    static forgeArmor(base: Item, level: number, rarity: Rarity, context: ForgeContext): ForgedItem

    /**
     * Forge jewelry (ring, amulet, cloak, belt, etc.) from a base template.
     */
    static forgeJewelry(base: Item, level: number, rarity: Rarity, context: ForgeContext): ForgedItem

    /**
     * Pick a magical element from the context-aware pool.
     */
    static rollElement(monsterType: string, biome: string): string | null

    /**
     * Generate a default name for the item (without LLM).
     * Example: "Rare Necrotic Longsword +2"
     */
    static generateDefaultName(base: Item, rarity: Rarity, magicalProps: MagicalProperty[]): string
}
```

#### ForgeParams and ForgeContext types

```typescript
interface ForgeParams {
    category: 'weapon' | 'armor' | 'shield' | 'jewelry';
    baseItemName: string;        // e.g., "Longsword", "Chain Mail", "Ring"
    cr: number;                  // Monster CR (determines level + rarity weight)
    monsterType: string;         // e.g., "undead" — for element pool
    biome: string;               // e.g., "Ruins" — fallback element pool
}

interface ForgeContext {
    monsterType: string;
    biome: string;
    monsterName: string;         // For forgeSource metadata
}

type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary';

interface ForgedItem extends Item {
    rarity: Rarity;
    itemLevel: number;
    isForged: true;
    forgeSource: string;
    magicalProperties: MagicalProperty[];
}
```

#### Core Logic Flow

```typescript
static forgeItem(params: ForgeParams): ForgedItem {
    const base = DataManager.getItem(params.baseItemName);
    if (!base) throw new Error(`Base item not found: ${params.baseItemName}`);

    const itemLevel = this.crToItemLevel(params.cr);
    const rarity = this.rollRarity(params.cr);
    const context = { monsterType: params.monsterType, biome: params.biome, monsterName: '' };

    let forged: ForgedItem;
    switch (params.category) {
        case 'weapon':  forged = this.forgeWeapon(base, itemLevel, rarity, context); break;
        case 'armor':   forged = this.forgeArmor(base, itemLevel, rarity, context); break;
        case 'shield':  forged = this.forgeArmor(base, itemLevel, rarity, context); break;
        case 'jewelry': forged = this.forgeJewelry(base, itemLevel, rarity, context); break;
    }

    // Validate against schema
    ItemSchema.parse(forged);
    return forged;
}
```

#### Weapon Forging Detail

```typescript
static forgeWeapon(base, level, rarity, context): ForgedItem {
    const tier = crToLevelTier(level);
    const bonuses = WEAPON_BONUSES[tier][rarity];

    // Roll stat bonuses within range
    const hitBonus = randomInRange(bonuses.hitBonus[0], bonuses.hitBonus[1]);
    const dmgBonus = randomInRange(bonuses.damageBonus[0], bonuses.damageBonus[1]);

    // Build modifiers array (for MechanicsEngine to consume)
    const modifiers = [];
    if (hitBonus > 0) modifiers.push({ type: 'HitBonus', target: 'Attack', value: hitBonus });
    if (dmgBonus > 0) modifiers.push({ type: 'DamageAdd', target: 'Damage', value: dmgBonus });

    // Roll for magical property
    const magicalProperties = [];
    const magicChance = MAGIC_CHANCE[rarity];
    if (Math.random() < magicChance) {
        const element = this.rollElement(context.monsterType, context.biome);
        if (element && bonuses.bonusDamageDice) {
            magicalProperties.push({
                type: 'BonusDamage',
                element: element,
                dice: bonuses.bonusDamageDice,
                value: averageDice(bonuses.bonusDamageDice),
            });
            modifiers.push({ type: 'DamageAdd', target: element, value: averageDice(bonuses.bonusDamageDice) });
        }
    }

    const name = this.generateDefaultName(base, rarity, magicalProperties);
    const goldValue = base.cost.gp * RARITY_VALUE_MULTIPLIER[rarity];

    return {
        ...base,
        name,
        rarity,
        itemLevel: level,
        isMagic: magicalProperties.length > 0,
        isForged: true,
        forgeSource: `${context.monsterName} CR ${level} ${context.biome}`,
        modifiers,
        magicalProperties,
        cost: { ...base.cost, gp: goldValue },
        instanceId: uuid(),
    };
}
```

## Phase 4: LootEngine Integration

### `src/ruleset/combat/LootEngine.ts` — Modify processDefeat()

```typescript
// BEFORE (current):
const equipDrops = this.getEquipmentDrops(monster);

// AFTER (with forge):
const equipDrops = this.getEquipmentDrops(monster);
const forgedDrops = equipDrops.map(item => {
    try {
        const category = this.getForgeCategory(item);
        if (!category) return item; // Non-forgeable item, return as-is
        return ItemForgeEngine.forgeItem({
            category,
            baseItemName: item.name,
            cr: Number(monster.cr) || 0,
            monsterType: monster.type?.toLowerCase() || 'humanoid',
            biome: currentBiome,  // Passed from combat context
        });
    } catch (e) {
        console.warn(`[LootEngine] Forge failed for ${item.name}, using base:`, e);
        return item; // Fallback to unmodified item
    }
});
```

The `biome` parameter must flow from `CombatOrchestrator.endCombat()` → `LootEngine.processDefeat()`. Currently `processDefeat` doesn't receive biome. This requires:

### `src/ruleset/combat/LootEngine.ts` — Signature change

```typescript
// BEFORE:
static processDefeat(monster: Monster): LootResult

// AFTER:
static processDefeat(monster: Monster, biome?: string): LootResult
```

### `src/ruleset/combat/managers/CombatOrchestrator.ts` — Pass biome

The orchestrator already has access to biome via the hex state. At the `endCombat` call site where `processDefeat` is called, add the current biome.

## Phase 5: Equipment System — Apply Forge Bonuses

### `src/ruleset/combat/EquipmentEngine.ts` — recalculateAC()
Add modifier consumption after base AC calculation:

```typescript
// After base AC is calculated, apply ACBonus modifiers from equipped items
for (const item of equippedItems) {
    if (item.modifiers) {
        for (const mod of item.modifiers) {
            if (mod.type === 'ACBonus') {
                ac += mod.value;
            }
        }
    }
}
```

### `src/ruleset/combat/CombatResolutionEngine.ts` or CombatOrchestrator
Apply HitBonus and DamageAdd modifiers during attack resolution:

```typescript
// When calculating attack roll, add HitBonus from equipped weapon
const weapon = getEquippedWeapon(attacker);
const hitMod = weapon?.modifiers?.find(m => m.type === 'HitBonus')?.value || 0;
attackRoll += hitMod;

// When calculating damage, add DamageAdd modifiers
const dmgMods = weapon?.modifiers?.filter(m => m.type === 'DamageAdd') || [];
for (const mod of dmgMods) {
    totalDamage += mod.value;
}
```

## Phase 6: LLM Item Naming (Optional, Async)

### `src/ruleset/agents/LoreService.ts` — Add item naming

```typescript
static async nameForgedItem(item: ForgedItem, context: ForgeContext): Promise<{name: string, description: string}> {
    // Non-blocking: fire and forget. Item uses default name until LLM responds.
    const prompt = `Generate a name and 1-2 sentence description for this item:
    - Base: ${item.name}
    - Rarity: ${item.rarity}
    - Magical: ${item.isMagic ? 'Yes' : 'No'}
    ${item.magicalProperties.length > 0 ? `- Magic: ${item.magicalProperties.map(p => `${p.dice || ''} ${p.element || ''} ${p.type}`).join(', ')}` : ''}
    - Context: Dropped by ${context.monsterName} in ${context.biome}

    Respond with JSON: { "name": "...", "description": "..." }
    Do NOT alter the stats. You are ONLY naming and describing.`;

    // Returns { name, description } or falls back to defaults
}
```

## Phase 4.5: Forged Item Persistence (Rare+ Auto-Catalog)

### Strategy: Tiered Persistence
- **All forged items** persist in save files as full objects (free — already how items work)
- **Rare, Very Rare, Legendary** items auto-write to `data/item/forged/` as separate JSON files
- Items written to disk become available as potential loot/shop items in ALL future sessions
- Deduplication by name prevents collisions

### `src/ruleset/data/DataManager.ts` — Add `registerItem()` + load forged items
- New method: `registerItem(item: Item)` — adds item to the in-memory registry at runtime
- On startup: also load from `data/item/forged/*.json` alongside base items
- CLI: `DataManagerCLI.ts` loads forged items from disk via fs

### `src/ruleset/combat/ItemForgeEngine.ts` — Add `persistIfRare()`
- After forging, check rarity >= Rare
- If yes, check if name already exists in DataManager registry (deduplication)
- If new: write JSON to `data/item/forged/{sanitized_name}.json`
- Register in DataManager immediately (available this session)

### `src/ruleset/data/ForgedItemCatalog.ts` — New file
- Handles read/write of forged item files
- `writeForgedItem(item, projectRoot)` — writes to `data/item/forged/`
- `loadForgedItems(projectRoot)` — reads all JSON from `data/item/forged/`
- Deduplication check: `exists(itemName)` before writing

## Phase 7: CLI Test

### `cli/tests/test_itemforge.ts`

1. Test `rollRarity()` distribution over 1000 rolls for each CR tier
2. Test `forgeWeapon()` for all 5 rarity tiers — verify bonuses within expected ranges
3. Test `forgeArmor()` — verify acBonus within range, never exceeds +3
4. Test `forgeJewelry()` — verify statBonus assignment
5. Test magical property assignment: Common = never, Rare = often, Legendary = always
6. Test element pool: undead monster → element is in ['Necrotic', 'Cold', 'Radiant']
7. Test schema validation: every forged item passes `ItemSchema.parse()`
8. Test LootEngine integration: defeat a Skeleton and verify forged loot appears
9. Test equipment integration: equip a forged +2 weapon, verify AC/attack calculations change
10. Test persistence: forge a Rare item → verify JSON file written to `data/item/forged/`
11. Test deduplication: forge same-name item twice → only one file exists
12. Test DataManager.registerItem(): forged item available via getItem() after registration

## Phase 8: Enshrine System (Final Phase)

> **NOTE**: Implement AFTER all other ItemForge phases are complete and tested.

### Concept
Player can explicitly "Enshrine" any item (regardless of rarity) to permanently add it to the
game's item database. Like a trophy case — the player curates which items become part of the world.

### Planned Features
- UI: Right-click item → "Enshrine" option (or dedicated button in inventory)
- CLI: `/enshrine <instanceId>` command
- Enshrined items written to `data/item/forged/` with `enshrined: true` flag
- Enshrined items have higher weight in loot/shop pools than auto-cataloged items
- Visual indicator in inventory (star icon or border) for enshrined items
- Codex integration: enshrined items appear in a "Hall of Artifacts" codex page

---

# Summary of Files

## New Files (6)
| File | Phase | Purpose |
|------|-------|---------|
| `src/ruleset/data/ForgeConfig.ts` | B2 | All config tables (rarity weights, stat ranges, element pools, gold multipliers) |
| `src/ruleset/combat/ItemForgeEngine.ts` | B3 | Core forge engine (forgeItem, rollRarity, forgeWeapon, forgeArmor, forgeJewelry) |
| `cli/tests/test_itemforge.ts` | B7 | Comprehensive CLI test |

## Modified Files (7)
| File | Phase | Change |
|------|-------|--------|
| `src/ruleset/agents/NarratorService.ts` | A | Add rest/trade/talk guidance to system prompt |
| `src/ruleset/schemas/ItemSchema.ts` | B1 | Add rarity, itemLevel, isForged, magicalProperties fields + new modifier types |
| `src/ruleset/combat/LootEngine.ts` | B4 | Route drops through ItemForgeEngine; add biome parameter |
| `src/ruleset/combat/managers/CombatOrchestrator.ts` | B4 | Pass biome to LootEngine.processDefeat() |
| `src/ruleset/combat/EquipmentEngine.ts` | B5 | Apply ACBonus modifiers in recalculateAC() |
| `src/ruleset/combat/CombatResolutionEngine.ts` | B5 | Apply HitBonus/DamageAdd modifiers in attack resolution |
| `src/ruleset/agents/LoreService.ts` | B6 | Add nameForgedItem() for async LLM naming |
| `cli/repl.ts` | A | Add rest hint detection for CLI |

## Verification
| Test | What it verifies |
|------|-----------------|
| `npx tsx cli/tests/test_itemforge.ts` | Full forge pipeline: rarity distribution, stat ranges, element pools, schema validation, loot integration |
| `npx tsx cli/harness/harness.ts` | Existing scenarios still pass (backward compatibility) |
| Manual: defeat monster via CLI | Forged items appear in combatLoot with rarity/stats |

---

# Monster Type Coverage

All 325 monsters in `data/monster/` have a `type` field. Verified types present:

| Type | Example Monsters | Element Pool |
|------|-----------------|--------------|
| `humanoid` | Goblin, Bandit, Cultist | Any (looted from various sources) |
| `undead` | Skeleton, Zombie, Ghoul, Vampire | Necrotic, Cold, Radiant |
| `beast` | Wolf, Boar, Giant Spider | Poison |
| `giant` | Ogre, Hill Giant, Troll | Cold, Thunder, Lightning |
| `fiend` | (depends on dataset) | Fire, Necrotic, Poison |
| `dragon` | (depends on dataset) | Fire, Cold, Lightning, Acid, Poison |
| `monstrosity` | Owlbear, Basilisk | Poison, Acid |
| `construct` | Animated Armor | Force, Lightning, Thunder |
| `elemental` | (depends on dataset) | Fire, Cold, Lightning, Thunder |

The `ELEMENT_POOLS` config maps every known monster type. Unknown types fall through to `BIOME_ELEMENT_POOLS` as a biome-based fallback. If neither matches, no magical property is assigned (item stays non-magical even if the probability roll said "yes") — safe degradation.


## 24. Amendments Log (CLI Audit — 2026-03-30)

> Discovered and fixed during comprehensive CLI-based integration testing.

### A. Bugs Found & Fixed

| ID | Severity | Description | File | Fix |
|----|----------|-------------|------|-----|
| BUG-001 | **HIGH** | `/rest short` and `/rest long` produce NaN (parseInt('short') = NaN), silently failing with zero recovery | `GameLoop.ts:698` | Map 'short'→60, 'long'→480 before parseInt |
| BUG-002 | **HIGH** | Concentration check ignores CON modifier (`Dice.d20() + 0` hardcoded) | `SpellcastingEngine.ts:63` | Added `MechanicsEngine.getModifier(caster.stats.CON)` |
| BUG-003 | **MEDIUM** | `/cast` without arguments crashes (undefined spellName passed to SpellManager) | `GameLoop.ts:717` | Added guard: return usage string if `!args[0]` |
| BUG-004 | **LOW** | Travel animation `await setTimeout()` blocks CLI REPL for seconds | `GameLoop.ts:469,636` | Skip delay when `typeof window === 'undefined'` |

### B. CLI Infrastructure Added

| Item | Description |
|------|-------------|
| `.env` loading | `cli/bootstrap.ts` now reads `.env` from project root and sets `process.env` — enables LLM API keys without dotenv dependency |
| `/inventory` command | Wired to `InventoryRenderer.renderInventory()` |
| `/quests` command | Wired to `QuestRenderer.renderQuests()` |
| `/map [radius]` command | Wired to `MapRenderer.renderMap()` (default radius 3) |
| `/spells` command | Wired to `SpellHandler.renderSpells()` |
| `/equipment` command | Wired to `EquipmentHandler.renderPaperdoll()` |
| `/npcs` command | Lists NPCs in current hex from `state.worldNpcs` |
| `/codex` command | Displays discovered lore entries |
| `/history` command | Shows last 10 conversation turns |
| `/unequip <slot>` command | Wired to `InventoryManager.unequipFromSlot()` via GameLoop |
| Help menu | Expanded to show all new commands grouped by category |
| Integration test | `cli/test_integration.ts` — 44 assertions covering character creation, renderers, movement, rest, wait, combat, narrative, edge cases, save/load |

### C. Condition System Migration (2026-03-30)

**Full migration from `conditions: string[]` to `conditions: CombatConditionSchema[]`.**

| Action | Files Modified |
|--------|---------------|
| Schema: `conditions` field changed to `CombatConditionSchema[]` | `CombatSchema.ts`, `PlayerCharacterSchema.ts` |
| Schema: Added `deathSaves: { successes, failures }` to `CombatantSchema` | `CombatSchema.ts` |
| New utility: `ConditionUtils.ts` with `hasCondition`, `addCondition`, `removeCondition`, `tickConditions` | New file |
| Migrated 25 call sites across 11 files | `StandardActions.ts`, `DeathEngine.ts`, `InitiativeTracker.ts`, `CombatOrchestrator.ts`, `SpellManager.ts`, `EngineDispatcher.ts`, `ContextBuilder.ts`, `ConditionDisplay.tsx`, `CombatRenderer.ts`, `CharacterRenderer.ts`, `repl.ts` |
| `DeathEngine` rewritten: `rollDeathSave(combatant)` now tracks cumulative saves on the combatant, handles nat 1 (2 failures), nat 20 (revive at 1 HP), 3 successes (stabilize), 3 failures (dead) | `DeathEngine.ts` |
| `processStartOfTurn` now ticks condition durations and logs expirations | `CombatOrchestrator.ts` |
| Fixed AgentConfig model IDs (was `openai/gpt-oss-120b`, should be `gpt-oss-120b`) | `AgentConfig.json` |

**Test coverage:** `cli/test_phase4_5.ts` — 142 assertions (condition utils, death save accumulation across 100 trials, stabilize, revive, combat integration).

### D. Death Save UX + Flee Action (2026-03-30)

**Manual death save rolls, flee mechanic, and untargetable downed players.**

| Feature | Description |
|---------|-------------|
| **Manual death save** | Player must click "Roll Death Save" button (replaces action bar with pulsing red button when downed). No auto-rolling. |
| **Death save tracker** | UI shows green/red dots for successes/failures (3 each) on the button |
| **Stabilization = 1 HP** | After 3 successful saves, player gets 1 HP and can act (attack or flee) |
| **Flee action** | New permanent button in action bar (after Disengage). Contested Athletics/Acrobatics check vs best enemy. On success: enemies get opportunity attacks, then combat ends. On failure: opportunity attacks + turn wasted. |
| **Party flee** | In single player with allies, successful flee = whole party escapes |
| **Untargetable when downed** | CombatAI skips unconscious players as targets — only allies are valid |
| **LLM narrative** | Flee success triggers NarratorService summary mentioning near-death escape |
| **Combat log auto-scroll** | Fixed dependency to ensure new logs always scroll into view |
| **CLI support** | `death_save` and `flee` commands added to IntentRouter and CLI help |

**Files modified:** `CombatOrchestrator.ts`, `CombatManager.ts`, `CombatAI.ts`, `CombatActionBar.tsx`, `CombatActionBar.module.css`, `IntentRouter.ts`, `CombatLog.tsx`, `cli/repl.ts`

### E. Full CLI Command Wiring (2026-03-31)

**14 engines wired to CLI commands — 100% of game functionality now accessible.**

| Command | Engine | Description |
|---------|--------|-------------|
| `/levelup` | LevelingEngine | Level up when XP sufficient (HP increase, hit dice, proficiency) |
| `/addxp <n>` | LevelingEngine | Add XP (dev command) |
| `/prepare <spells>` | SpellbookEngine | Prepare spells for the day (casters only) |
| `/gather [nodeId]` | GatheringEngine | Gather resources from hex nodes (lists available if no arg) |
| `/craft <recipeId>` | DowntimeEngine | Craft items from recipes |
| `/factions` | FactionEngine | Display faction standings |
| `/check <ability> <skill> [dc]` | MechanicsEngine | Perform skill checks |
| `/export [sheet\|chronicle]` | ExportEngine | Export character sheet or chronicle as markdown |
| `/weather` | WeatherEngine | Display current weather |
| `/multiclass <class>` | MulticlassingEngine | Check multiclass prerequisites |
| `/stabilize <target>` | DeathEngine | Stabilize dying ally in combat (Medicine check DC 10) |

**Test coverage:** `cli/test_new_commands.ts` — 22 assertions, all pass.

### F. Outstanding Issues (Not Yet Fixed)

| ID | Severity | Description |
|----|----------|-------------|
| GAP-003 | **LOW** | No `/levelup` CLI command (LevelingEngine exists but not wired to any command) |
| GAP-004 | **LOW** | NPC dialogue requires LLM — no fallback if API is down |
| GAP-005 | **LOW** | `/survey` uses full ability score instead of modifier in check formula |
| GAP-006 | **LOW** | No reaction economy (Shield, Counterspell) beyond opportunity attacks |
| GAP-007 | **LOW** | No cover system, flanking, or ranged-in-melee disadvantage (Phase 13 items) |