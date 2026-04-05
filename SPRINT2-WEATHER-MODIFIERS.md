# Sprint 2 — Weather Modifier Wiring

> **Status:** Not started  
> **Prerequisite:** Sprint 1 (front system) — ✅ complete  
> **Deferred:** `fireResistance` — awaits damage-type system sprint  
> **Tests:** Add to `src/ruleset/tests/test_weather_system.ts` when done  
> **Docs:** Update `src/ruleset/combat/docs/weather-system.md` Sprint 2 checklist when done

---

## Key architectural insight

`CompanionSchema.character` IS a `PlayerCharacterSchema` (CompanionSchema.ts:32).  
Adding `exhaustionLevel` to `PlayerCharacterSchema` **automatically propagates to companions** — no separate companion schema change needed.  
Companion exhaustion is accessed as `companion.character.exhaustionLevel`.

---

## Step 0 — Schema prerequisites (do first, everything else depends on these)

### 0-A. Add `exhaustionLevel` to `PlayerCharacterSchema`

**File:** `src/ruleset/schemas/PlayerCharacterSchema.ts`  
**After line 48** (after `statusEffects` field):

```typescript
exhaustionLevel: z.number().min(0).max(6).default(0),
```

This single addition gives both the player character AND every companion (via inheritance) their own exhaustion level.

### 0-B. Add `lastExhaustionCheckMinute` to `FullSaveStateSchema`

**File:** `src/ruleset/schemas/FullSaveStateSchema.ts`  
**Near the `weather` field (line 146):**

```typescript
lastExhaustionCheckMinute: z.number().default(0), // Tracks last hourly blizzard CON save
```

---

## Step 1 — `passivePerceptionPenalty` (Storm, 0–3)

**File:** `src/ruleset/combat/MechanicsEngine.ts`  
**Function:** `getPassivePerception()` — currently lines 152–175  
**Change:** Add `weather` parameter; subtract intensity-scaled penalty at end of function.

### Signature change

```typescript
// BEFORE:
public static getPassivePerception(actor: PlayerCharacter | Monster): number {

// AFTER:
public static getPassivePerception(actor: PlayerCharacter | Monster, weather?: Weather): number {
```

### Addition at end of function (before `return base`)

```typescript
// Storm reduces passive perception (noise, distraction, poor visibility)
if (weather?.type === 'Storm') {
    const penalty = Math.round((weather.intensity ?? 0) * 3); // 0–3
    base = Math.max(0, base - penalty);
}
return base;
```

### Callers to update (pass `state.weather` where available)

Search for all calls to `getPassivePerception(` in the codebase and add `state.weather` or `this.state.weather` as the second argument. Key callers likely in:
- `CombatOrchestrator.ts` (stalk DC calculation — line 726: `passivePerception || 12`)
- `EncounterDirector.ts`

---

## Step 2 — `perceptionHearing: 'disadvantage'` (Rain ≥ 0.40)

**File:** `src/ruleset/combat/MechanicsEngine.ts`  
**Function:** `resolveCheck()` — currently lines 55–120  

### Signature change

```typescript
// BEFORE:
public static resolveCheck(
    actor: PlayerCharacter | Monster,
    ability: AbilityScore,
    skill: SkillName | undefined,
    dc: number,
    advantage: 'none' | 'advantage' | 'disadvantage' = 'none'
): CheckResult {

// AFTER:
public static resolveCheck(
    actor: PlayerCharacter | Monster,
    ability: AbilityScore,
    skill: SkillName | undefined,
    dc: number,
    advantage: 'none' | 'advantage' | 'disadvantage' = 'none',
    weather?: Weather
): CheckResult {
```

### Addition before the d20 roll block (before line ~96)

```typescript
// Rain muffles sounds — disadvantage on hearing-based Perception checks
if (skill === 'Perception' && weather?.type === 'Rain' && (weather.intensity ?? 0) >= 0.40) {
    if (advantage !== 'advantage') advantage = 'disadvantage'; // advantage cancels it
}

// Exhaustion (levels 1, 3): disadvantage on ability checks
const exhaustionLevel = (actor as any).exhaustionLevel ?? 0;
if (exhaustionLevel >= 1 && advantage !== 'advantage') {
    advantage = 'disadvantage';
}
```

### Callers to update

All calls to `resolveCheck(...)` that can access `state.weather` should pass it as the 6th argument. Non-weather calls can omit it (parameter is optional).

---

## Step 3 — `stealthBonus` (Storm, 0–3)

Two separate callsites — both need to be updated.

### Callsite A: `MechanicsEngine.resolveCheck()`

In the addition from Step 2, also add after the disadvantage logic:

```typescript
// Storm masks movement sounds — bonus to Stealth checks
if (skill === 'Stealth' && weather?.type === 'Storm') {
    const stealthBonus = Math.round((weather.intensity ?? 0) * 3); // 0–3
    // Pass through as a contextual modifier — add to the modifier total
    // Store on local variable for use in total calculation below
}
```

The `stealthBonus` needs to be added to the `total` calculation. Find the line that reads:
```typescript
const total = d20 + modifier + profBonus;
```
And change it to:
```typescript
const weatherStealthBonus = (skill === 'Stealth' && weather?.type === 'Storm')
    ? Math.round((weather.intensity ?? 0) * 3)
    : 0;
const total = d20 + modifier + profBonus + weatherStealthBonus;
```

### Callsite B: Stalk mode in `CombatOrchestrator.ts` lines 724–746

The stalk stealth check bypasses `resolveCheck()` and rolls manually.  
**Line 739:** `const total = roll + mod + prof;`  
Change to:

```typescript
const stormStealthBonus = this.state.weather?.type === 'Storm'
    ? Math.round((this.state.weather.intensity ?? 0) * 3)
    : 0;
const total = roll + mod + prof + stormStealthBonus;
```

If bonus is non-zero, add it to the log line at ~743:
```typescript
this.addCombatLog(`${currentCombatant.name} stalks silently (Stealth ${total} vs DC ${dc}${stormStealthBonus > 0 ? `, +${stormStealthBonus} Storm` : ''}). Success! They are Unseen.`);
```

---

## Step 4 — `heavilyObscured` ranged disadvantage (Fog ≥ 0.55)

**File:** `src/ruleset/combat/managers/CombatOrchestrator.ts`  
**Location:** Before the `resolveAttack()` call (~line 599)

Find where `forceDisadvantage` is declared (around line 481) and add:

```typescript
// Heavy fog obscures targets — ranged attacks at disadvantage
if (isRanged && this.state.weather?.type === 'Fog' && (this.state.weather.intensity ?? 0) >= 0.55) {
    forceDisadvantage = true;
    this.addCombatLog(`Heavy fog obscures your target! Ranged attacks at disadvantage.`);
}
```

### Also update `VisibilityEngine.ts`

**File:** `src/ruleset/combat/VisibilityEngine.ts`  
**Function:** `getVisibilityEffect()` — currently lines 7–25

```typescript
// BEFORE signature:
public static getVisibilityEffect(
    observer: PlayerCharacter | Monster,
    currentLight: LightLevel
): { disadvantage: boolean; blinded: boolean } {

// AFTER signature:
public static getVisibilityEffect(
    observer: PlayerCharacter | Monster,
    currentLight: LightLevel,
    weather?: Weather
): { disadvantage: boolean; blinded: boolean } {
```

Add before the existing `if (currentLight === 'Darkness')` block:

```typescript
// Thick fog imposes disadvantage regardless of light level
if (weather?.type === 'Fog' && (weather.intensity ?? 0) >= 0.55) {
    return { disadvantage: true, blinded: false };
}
```

---

## Step 5 — `attackRangeLimit` + `visibilityLimit` ranged cap

Both modifiers cap `maxRangeCells`. Apply both in the same block.

**File:** `src/ruleset/combat/managers/CombatOrchestrator.ts`  
**Location:** After `maxRangeCells` is assigned (~lines 491–497), before the `if (distance > maxRangeCells)` check at line 499.

```typescript
// Fog reduces maximum ranged attack range (attackRangeLimit: 5–15 squares)
if (isRanged && this.state.weather?.type === 'Fog') {
    const fogRangeLimit = Math.round(5 + (1 - (this.state.weather.intensity ?? 0)) * 10);
    maxRangeCells = Math.min(maxRangeCells, fogRangeLimit);
}

// Snow/Blizzard reduces visibility and ranged range (visibilityLimit: 10–50 squares → cells)
if (isRanged && (this.state.weather?.type === 'Snow' || this.state.weather?.type === 'Blizzard')) {
    const visLimitSquares = Math.round(50 - ((this.state.weather.intensity ?? 0) * 40));
    const visLimitCells = Math.ceil(visLimitSquares / 5);
    maxRangeCells = Math.min(maxRangeCells, visLimitCells);
}
```

---

## Step 6 — `difficultTerrain` (Snow/Blizzard, combat movement)

**File:** `src/ruleset/combat/managers/CombatOrchestrator.ts`  
**Location:** Line 709, after `let costMultiplier = 1;`

```typescript
// Snow and Blizzard create difficult terrain — movement costs doubled
if ((this.state.weather?.type === 'Snow' || this.state.weather?.type === 'Blizzard')
    && (this.state.weather.intensity ?? 0) >= 0.35) {
    costMultiplier *= 2;
    // Note: stacks with press/stalk (press in blizzard = ×4 cost)
}
```

This stacks correctly with existing mode multipliers — press in a blizzard costs ×4, which is intentional.

---

## Step 7 — `difficultTerrain` (Snow/Blizzard, exploration travel)

**File:** `src/ruleset/combat/MovementEngine.ts`  
**Function:** `move()` — line 51

### Signature change

```typescript
// BEFORE:
public move(
    currentCoords: [number, number],
    input: HexDirection | [number, number],
    pace: TravelPace = 'Normal',
    hasRoadConnection: boolean = false
): MovementResult {

// AFTER:
public move(
    currentCoords: [number, number],
    input: HexDirection | [number, number],
    pace: TravelPace = 'Normal',
    hasRoadConnection: boolean = false,
    weather?: Weather
): MovementResult {
```

### Addition at lines 148–151 (after `speedMod` is applied, before pace adjustments)

```typescript
// After: let timeCost = Math.floor(baseTime / speedMod);
// Add weather difficult terrain:
if ((weather?.type === 'Snow' || weather?.type === 'Blizzard')
    && (weather.intensity ?? 0) >= 0.35) {
    timeCost = Math.floor(timeCost * 2); // Difficult terrain doubles travel time
}
```

### Caller update

Find all calls to `MovementEngine.move(...)` (likely in `GameLoop.ts` or wherever hex movement is processed) and pass `state.weather` as the 5th argument.

---

## Step 8 — `visibilityLimit` (Snow/Blizzard, exploration hex reveal)

**File:** `src/ruleset/combat/managers/ExplorationManager.ts`  
**Function:** `expandHorizon()` — lines 25–73

The function currently reveals neighbors (layer 1) and second-layer neighbors (layer 2) unconditionally. In heavy snow/blizzard, layer 2 should be suppressed.

### Change

After line 27 (`const centerHex = this.hexMapManager.getHex(centerKey);`), add:

```typescript
// Determine reveal radius based on weather visibility
// Normal: 2 layers. Heavy snow/blizzard: 1 layer only.
const intensity = this.state.weather?.intensity ?? 0;
const limitedVisibility = (
    (this.state.weather?.type === 'Snow' || this.state.weather?.type === 'Blizzard')
    && intensity >= 0.35
);
```

Then wrap the second-layer loop (the one expanding beyond immediate neighbors) with:

```typescript
if (!limitedVisibility) {
    // ... existing second-layer neighbor reveal loop
}
```

---

## Step 9 — `lightningHazard` (Storm, per-tick)

**File:** `src/ruleset/combat/managers/TimeManager.ts`  
**Location:** After the `WeatherEngine.advanceFront(...)` call, before `await this.emitStateUpdate()`

### Create a shared damage utility first

The `TimeManager` cannot call `CombatOrchestrator` methods directly. Create a small helper:

**New file (or add to `MechanicsEngine.ts`):**

```typescript
// In MechanicsEngine.ts or a new DamageUtils.ts
public static applyDamageToCharacter(character: PlayerCharacter, damage: number): void {
    character.hp.current = Math.max(0, character.hp.current - damage);
}
```

### Lightning check in `TimeManager.advanceFront` loop

```typescript
// Lightning hazard — only in outdoor Storm weather
if (this.state.weather.type === 'Storm' && this.state.mode === 'EXPLORATION') {
    const hazardChance = (this.state.weather.intensity ?? 0) * 0.015; // 0–1.5% per 30-min tick
    if (Math.random() < hazardChance) {
        const conMod = MechanicsEngine.getModifier(this.state.character.stats['DEX'] ?? 10);
        const saveRoll = Dice.d20();
        const dc = 12;
        if (saveRoll + conMod < dc) {
            const lightningDmg = Dice.roll('2d10');
            MechanicsEngine.applyDamageToCharacter(this.state.character, lightningDmg);
            // Narrator is made aware via state — the next narrative call will see reduced HP
            // Optionally: push a log entry that the narrator can pick up
            if (!(this.state as any).pendingWeatherEvents) (this.state as any).pendingWeatherEvents = [];
            (this.state as any).pendingWeatherEvents.push({
                type: 'lightning_strike',
                damage: lightningDmg,
                saved: false,
            });
        } else {
            (this.state as any).pendingWeatherEvents = (this.state as any).pendingWeatherEvents || [];
            (this.state as any).pendingWeatherEvents.push({ type: 'lightning_near_miss', saved: true });
        }
    }
}
```

### Narrator awareness of `pendingWeatherEvents`

In `NarratorService.ts`, wherever the system prompt is constructed for the next turn, check for `state.pendingWeatherEvents` and inject them into context, then clear the array.

---

## Step 10 — `exhaustionRisk` (Blizzard ≥ 0.72, hourly)

**File:** `src/ruleset/combat/managers/TimeManager.ts`  
**Location:** Same place as lightning check — after weather advancement, before emit

### Exhaustion check

```typescript
// Blizzard exhaustion — hourly CON save for player and all following companions
if (this.state.weather.type === 'Blizzard'
    && (this.state.weather.intensity ?? 0) >= 0.72
    && this.state.mode === 'EXPLORATION') {

    // Use totalTurns as a proxy clock — check at most once per 60 turns (≈ 60 min)
    const currentMinute = Math.floor(this.state.worldTime.totalTurns / 10); // 10 turns = 1 min
    const lastCheck = this.state.lastExhaustionCheckMinute ?? 0;

    if (currentMinute - lastCheck >= 60) {
        this.state.lastExhaustionCheckMinute = currentMinute;

        const dc = 10;
        const affected: string[] = [];

        // Player check
        const playerConMod = MechanicsEngine.getModifier(this.state.character.stats['CON'] ?? 10);
        if (Dice.d20() + playerConMod < dc) {
            this.state.character.exhaustionLevel = Math.min(6, (this.state.character.exhaustionLevel ?? 0) + 1);
            affected.push(`${this.state.character.name} (now Exhausted ${this.state.character.exhaustionLevel})`);
            if (this.state.character.exhaustionLevel >= 6) {
                this.state.character.hp.current = 0; // Level 6 = death
            }
        }

        // Companion checks (Option B — individual tracking)
        for (const companion of this.state.companions ?? []) {
            if (companion.meta?.followState !== 'following') continue;
            const compConMod = MechanicsEngine.getModifier(companion.character.stats['CON'] ?? 10);
            if (Dice.d20() + compConMod < dc) {
                companion.character.exhaustionLevel = Math.min(6, (companion.character.exhaustionLevel ?? 0) + 1);
                affected.push(`${companion.character.name} (now Exhausted ${companion.character.exhaustionLevel})`);
            }
        }

        if (affected.length > 0) {
            // Queue for narrator
            (this.state as any).pendingWeatherEvents = (this.state as any).pendingWeatherEvents || [];
            (this.state as any).pendingWeatherEvents.push({
                type: 'exhaustion_gained',
                affected,
                blizzardIntensity: this.state.weather.intensity,
            });
        }
    }
}
```

### Exhaustion effects application

**File:** `src/ruleset/combat/MechanicsEngine.ts`  
In `resolveCheck()` (covered by Step 2 addition above) and in `CombatResolutionEngine.resolveAttack()`.

**In `CombatResolutionEngine.resolveAttack()`** — find the `finalAdvantage` calculation block and add:

```typescript
// Exhaustion levels 1 and 3: disadvantage on attack rolls
const attackerExhaustion = (attacker as any).exhaustionLevel ?? 0;
if (attackerExhaustion >= 1) {
    if (finalAdvantage === 'advantage') {
        finalAdvantage = 'none'; // Advantage and disadvantage cancel
    } else {
        finalAdvantage = 'disadvantage';
    }
}
```

**Movement speed effects** — in `CombatOrchestrator.ts`, when initialising combatant movement at start of turn, apply exhaustion speed penalties:

```typescript
// At the point where movementRemaining is set from movementSpeed:
const baseMovement = combatant.movementSpeed * 5; // or however it's set
const exhaustion = (this.state.character.exhaustionLevel ?? 0); // for player
let effectiveMovement = baseMovement;
if (exhaustion >= 5) effectiveMovement = 0;
else if (exhaustion >= 2) effectiveMovement = Math.floor(effectiveMovement / 2);
// Level 4 halves max HP — applied separately to character.hp.max
```

### Long rest exhaustion recovery

**File:** `src/ruleset/combat/RestingEngine.ts`  
**After the status effect tick block (line 113)**:

```typescript
// Long rest removes one exhaustion level (D&D 5e standard)
if (durationMinutes >= 480 && (pc as any).exhaustionLevel > 0) {
    (pc as any).exhaustionLevel = Math.max(0, (pc as any).exhaustionLevel - 1);
}
```

---

## Step 11 — Narrator awareness (exhaustion + intensity label)

### 11-A. Update weather extraction in NarratorService

**File:** `src/ruleset/agents/NarratorService.ts`

Both `narrateRestCompletion()` (line 188) and `narrateAmbush()` (line 253) extract:
```typescript
const weather = state.weather?.type || 'Clear'; // old — just the type string
```

Change both to use the intensity label:
```typescript
import { WeatherEngine } from '../combat/WeatherEngine';
// ...
const weather = WeatherEngine.getIntensityLabel(state.weather) ?? state.weather?.type ?? 'Clear';
const weatherTrend = state.weather?.front?.trend ?? 'stable';
```

And inject trend into system prompts:
```typescript
- Weather: ${weather}${weatherTrend !== 'stable' ? ` (${weatherTrend})` : ''}
```

### 11-B. Inject `pendingWeatherEvents` into narrative context

In the main `generate()` system prompt construction (around line 305), add:

```typescript
const weatherEvents = (state as any).pendingWeatherEvents ?? [];
if (weatherEvents.length > 0) {
    prompt += `\n## RECENT WEATHER EVENTS\n`;
    for (const ev of weatherEvents) {
        if (ev.type === 'lightning_strike') {
            prompt += `- A lightning strike hit the party for ${ev.damage} damage!\n`;
        } else if (ev.type === 'lightning_near_miss') {
            prompt += `- Lightning struck nearby but the party avoided it.\n`;
        } else if (ev.type === 'exhaustion_gained') {
            prompt += `- Blizzard exhaustion: ${ev.affected.join(', ')} gained an exhaustion level.\n`;
        }
    }
    prompt += `Weave these naturally into your narration if relevant.\n`;
    // Clear after use:
    (state as any).pendingWeatherEvents = [];
}
```

---

## Step 12 — Frontend: Exhaustion UI

### 12-A. Exhaustion icon next to character name

**File:** `src/ui/components/character/UnifiedCharacterPage.tsx`  
**Location:** Line 141 (`<h1 className={styles.charName}>{pc.name}</h1>`)

Change to:
```tsx
<h1 className={styles.charName}>
    {pc.name}
    {(pc as any).exhaustionLevel > 0 && (
        <GameTooltip text={`Exhausted (Level ${(pc as any).exhaustionLevel}/6) — ${EXHAUSTION_EFFECTS[(pc as any).exhaustionLevel]}`}>
            <span className={styles.exhaustionIcon}>😓</span>
        </GameTooltip>
    )}
</h1>
```

Add constant near top of file:
```typescript
const EXHAUSTION_EFFECTS: Record<number, string> = {
    1: 'Disadvantage on ability checks',
    2: 'Movement speed halved',
    3: 'Disadvantage on attacks and saving throws',
    4: 'HP maximum halved',
    5: 'Movement speed = 0',
    6: 'Death',
};
```

### 12-B. Exhaustion in stats view

**File:** `src/ui/components/character/UnifiedCharacterPage.tsx`  
In the stats/metrics section (near the AC/HP/speed boxes), add a dedicated exhaustion metric box when `exhaustionLevel > 0`:

```tsx
{(pc as any).exhaustionLevel > 0 && (
    <div className={`${styles.metricBox} ${styles.exhaustionMetric}`}>
        <div className={styles.metricVal}>{(pc as any).exhaustionLevel}<span className={styles.metricMax}>/6</span></div>
        <div className={styles.metricLbl}>Exhaustion</div>
    </div>
)}
```

**CSS** (`UnifiedCharacterPage.module.css`): Add:
```css
.exhaustionIcon { font-size: 0.8em; margin-left: 6px; cursor: help; }
.exhaustionMetric { border-color: #8b4513; background: rgba(139, 69, 19, 0.1); }
```

### 12-C. Companion exhaustion display

Companions are shown somewhere in the party panel or sidebar. Wherever companion HP/status is rendered, add the same exhaustion icon pattern checking `companion.character.exhaustionLevel`.

---

## Summary — implementation order

Recommended order to minimise merge conflicts:

| Order | Step | File(s) | Risk |
|-------|------|---------|------|
| 1 | Schema: `exhaustionLevel` + `lastExhaustionCheckMinute` | PlayerCharacterSchema, FullSaveStateSchema | Low |
| 2 | `passivePerceptionPenalty` | MechanicsEngine | Low |
| 3 | `perceptionHearing` + exhaustion disadvantage in checks | MechanicsEngine | Low |
| 4 | `stealthBonus` (MechanicsEngine) | MechanicsEngine | Low |
| 5 | `stealthBonus` (CombatOrchestrator stalk) | CombatOrchestrator | Low |
| 6 | `heavilyObscured` + `attackRangeLimit` + `visibilityLimit` ranged | CombatOrchestrator | Medium |
| 7 | `difficultTerrain` combat | CombatOrchestrator | Low |
| 8 | `difficultTerrain` + `visibilityLimit` exploration | MovementEngine, ExplorationManager | Medium |
| 9 | `lightningHazard` | TimeManager + MechanicsEngine utility | Medium |
| 10 | `exhaustionRisk` check + effects | TimeManager, CombatResolutionEngine, RestingEngine | High |
| 11 | Narrator awareness | NarratorService | Medium |
| 12 | Exhaustion UI | UnifiedCharacterPage + CSS | Low |
| 13 | VisibilityEngine weather param | VisibilityEngine | Low |

---

## What is NOT in Sprint 2

| Feature | Reason | Future sprint |
|---------|--------|--------------|
| `fireResistance` (Rain) | Requires damage type system on weapons/spells | Damage Type Sprint |
| Exhaustion on enemies | Weather exhaustion is exploration-only; enemy exhaustion from abilities is separate | Monster Abilities Sprint |
| Exhaustion from forced march / starvation | Valid D&D mechanic but out of scope here | Survival Sprint |
| Companion exhaustion UI panel | Depends on where companions are visually rendered | Companion UI Sprint |

---

## Tests to write

Add to `src/ruleset/tests/test_weather_system.ts`:

1. `getPassivePerception` returns lower value in Storm vs Clear at same character level
2. `resolveCheck` Perception in Rain (intensity ≥ 0.40) produces `disadvantage`
3. `resolveCheck` Stealth in Storm adds bonus proportional to intensity
4. `resolveCheck` with exhaustion level ≥ 1 produces `disadvantage`
5. TimeManager tick in Blizzard ≥ 0.72 increments `exhaustionLevel` on CON save failure (mock dice)
6. Long rest reduces `exhaustionLevel` by 1 in RestingEngine
7. Long rest does not reduce `exhaustionLevel` below 0
8. Companion exhaustion tracked independently from player exhaustion
9. `maxRangeCells` is capped in Fog (attackRangeLimit check)
10. `maxRangeCells` is capped in Blizzard (visibilityLimit check)
11. `costMultiplier` is 2 in Snow at intensity ≥ 0.35
12. `costMultiplier` stacks to 4 for press-mode in Blizzard
13. Travel timeCost is doubled in Snow/Blizzard at intensity ≥ 0.35
14. `pendingWeatherEvents` is populated on lightning strike
15. `pendingWeatherEvents` is cleared after narrator consumes it
