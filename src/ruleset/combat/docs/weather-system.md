# Weather System

> **Sprint status:** Sprint 1 complete (front simulation). Sprint 2 (modifier wiring) pending.

---

## Overview

The weather system simulates realistic atmospheric fronts that evolve over time based on season, biome, and time of day. A continuous `intensity` field (0.0–1.0) drives all display and gameplay decisions; the familiar `WeatherType` enum (`Clear`, `Rain`, `Storm`, `Fog`, `Snow`, `Blizzard`) is **derived** from intensity and temperature ranges rather than rolled directly.

Key properties:
- Weather moves through a **lifecycle of 8 phases** (pre-front clear → building → peak → clearing)
- Each front has a **velocity** (minutes per phase step) shaped by season and biome
- Type and display label update automatically as intensity changes within a phase
- Old saves without front data are **bootstrapped silently** on the first tick

---

## Architecture

### Data model (`BaseSchemas.ts`)

```
Weather {
  type:            WeatherType          // Derived display/game type — used by all callsites
  intensity:       number  (0.0–1.0)   // Continuous driver for effects and labels
  durationMinutes: number               // Countdown to next phase tick
  front?:          WeatherFront         // Optional — absent on old saves, bootstrapped on tick
}

WeatherFront {
  category:    'Precipitation' | 'Fog' | 'Dry'
  phase:       0–7                      // Lifecycle position
  velocity:    number                   // Minutes per phase step
  temperature: number  (0.0–1.0)       // Arctic → tropical; season + biome combined
  moisture:    number  (0.0–1.0)
  trend:       'building' | 'stable' | 'clearing'
}
```

### Files changed

| File | Change |
|------|--------|
| `WeatherEngine.ts` | Full rewrite — front system, type mapping, icon/label helpers |
| `BaseSchemas.ts` | Added `WeatherFrontSchema`; `intensity` now 0–1; `front` optional |
| `TimeManager.ts` | Calls `WeatherEngine.advanceFront(clock, weather, biome)` every 30-min tick |
| `EncounterDirector.ts` | Intensity-scaled encounter multiplier (was discrete Storm/Blizzard only) |
| `CombatAnalysisEngine.ts` | Charge disabled at `intensity ≥ 0.5` for cold precip (was type check) |
| `ContextBuilder.ts` | Weather context now includes `{ type, label, intensity, trend }` |
| `TimeDisplay.tsx` | Uses `getWeatherIconKey()` and `getIntensityLabel()`; shows trend arrow |

---

## Front lifecycle (phases 0–7)

| Phase | Intensity | Description | Trend |
|-------|-----------|-------------|-------|
| 0 | 0.00 | Pre-front clear sky | building |
| 1 | 0.10 | Approaching — thin cloud / pressure drop | building |
| 2 | 0.28 | Overcast / light onset | building |
| 3 | 0.52 | Moderate | building |
| 4 | 0.72 | Heavy | building |
| 5 | 0.90 | Peak intensity | stable |
| 6 | 0.48 | Clearing showers | clearing |
| 7 | 0.10 | Clearing out → **triggers new front roll** | clearing |

Small Gaussian noise (±0.04) is applied on each tick so intensity feels organic between steps.

---

## Type mapping (intensity + category → WeatherType)

| Category | Temperature | Intensity | WeatherType |
|----------|-------------|-----------|-------------|
| Dry | any | any | `Clear` |
| Fog | any | < 0.30 | `Clear` (thin mist) |
| Fog | any | ≥ 0.30 | `Fog` |
| Precipitation | ≥ 0.35 (warm) | < 0.22 | `Clear` (drizzle) |
| Precipitation | ≥ 0.35 (warm) | 0.22–0.62 | `Rain` |
| Precipitation | ≥ 0.35 (warm) | > 0.62 | `Storm` |
| Precipitation | < 0.35 (cold) | < 0.22 | `Clear` (flurries) |
| Precipitation | < 0.35 (cold) | 0.22–0.62 | `Snow` |
| Precipitation | < 0.35 (cold) | > 0.62 | `Blizzard` |

Temperature is `seasonal baseline + biome offset` (clamped 0–1).

---

## Multi-factor front generation

When a front completes (phase 7 → new roll), `WeatherEngine.generateFront()` considers:

### 1. Seasonal baseline temperature (`getSeasonalBaseline(month)`)

| Month | Temp | Precip% | Fog% |
|-------|------|---------|------|
| 1 Hammer | 0.15 | 38% | 8% |
| 3 Ches | 0.35 | 48% | 14% |
| 6 Kythorn | 0.75 | 36% | 6% |
| 7 Flamerule | 0.85 | 32% | 5% |
| 9 Eleint | 0.65 | 44% | 18% |
| 10 Marpenoth | 0.50 | 48% | 20% |
| 12 Nightal | 0.15 | 40% | 10% |

### 2. Biome temperature offset (added to seasonal baseline)

| Biome | Offset |
|-------|--------|
| Tundra | −0.40 |
| Mountain_High | −0.35 |
| Mountains | −0.25 |
| Coast_Cold | −0.15 |
| Desert | +0.35 |
| Volcanic | +0.30 |
| Jungle | +0.25 |
| Urban | +0.05 (heat island) |

### 3. Biome moisture multiplier (scales precipitation chance)

| Biome | Multiplier |
|-------|-----------|
| Desert | 0.10× |
| Jungle | 2.00× |
| Swamp, Ocean | 1.50× |
| Coast | 1.30× |
| Mountains | 1.20× |
| Plains | 1.00× |
| Volcanic, Tundra | 0.70× |

### 4. Time-of-day modifiers (`getTimeOfDayModifiers(hour, month)`)

| Time window | Effect |
|-------------|--------|
| Morning (05–10) | Fog probability +0.22 (spring/autumn), +0.10 (other seasons) |
| Afternoon (12–18) | Storm probability +0.20 in summer; fog probability −0.15 |
| Night (21–05) | Fog +0.15; storm dissipation −0.15 |

### 5. Previous weather continuity

| Previous type | Effect on next front |
|---------------|---------------------|
| `Blizzard` | Temperature −0.10 residual cold carried forward |
| `Precipitation` | +15% precipitation category weight bonus |
| `Fog` | +10% fog category weight bonus |

---

## Front velocity (minutes per phase step)

Longer velocity = slower-moving front = more gradual weather changes.

| Condition | Range (min/phase) |
|-----------|------------------|
| Summer convective storm | 45–90 |
| Winter synoptic front | 120–360 |
| Fog front | 60–180 |
| Default (spring/autumn) | 90–240 |

Biome multipliers on top:
- `Mountain_High` ×0.50 (orographic blocking — slowest)
- `Mountains` ×0.60
- `Ocean` ×1.25, `Coast` ×1.20 (maritime — fastest)
- `Desert` ×1.30 (dry air, quick passage)

Minimum phase duration is always 30 minutes.

---

## Display: icons and labels

### Icon naming scheme (`WeatherEngine.getWeatherIconKey()`)

Assets must be placed at `/assets/weather/{key}.png`.

| Key | Condition |
|-----|-----------|
| `clear` | Clear sky (dry front, phase 0 or 3–6) |
| `clear_cloudy` | Clear but cloud cover present (phase 1, 2, or 7) |
| `rain_light` | Rain, intensity < 0.40 |
| `rain` | Rain, intensity 0.40–0.62 |
| `storm` | Storm, intensity 0.62–0.80 |
| `storm_heavy` | Storm, intensity > 0.80 |
| `fog_light` | Fog (Mist), intensity < 0.55 |
| `fog` | Fog (Thick), intensity ≥ 0.55 |
| `snow_light` | Snow, intensity < 0.40 |
| `snow` | Snow, intensity 0.40–0.62 |
| `blizzard` | Blizzard, intensity 0.62–0.80 |
| `blizzard_heavy` | Blizzard, intensity > 0.80 |

The UI falls back to the base type icon (e.g. `rain.png`) if an intensity variant is not yet present.

### Intensity labels (`WeatherEngine.getIntensityLabel()`)

| WeatherType | Intensity range | Label |
|-------------|----------------|-------|
| Clear | phase 1–2 | Overcast |
| Clear | phase 7 | Clearing |
| Clear | other | Clear |
| Rain | < 0.32 | Drizzle |
| Rain | 0.32–0.40 | Light Rain |
| Rain | ≥ 0.40 | Rain |
| Storm | < 0.80 | Storm |
| Storm | ≥ 0.80 | Violent Storm |
| Fog | < 0.55 | Mist |
| Fog | ≥ 0.55 | Thick Fog |
| Snow | < 0.32 | Flurries |
| Snow | 0.32–0.40 | Light Snow |
| Snow | ≥ 0.40 | Snow |
| Blizzard | < 0.80 | Heavy Snow |
| Blizzard | ≥ 0.80 | Blizzard |

A trend arrow is appended in the UI: `↑` (building), `↓` (clearing), nothing (stable).

---

## Gameplay effects (Sprint 1 state)

### Encounter probability (`EncounterDirector`)

Intensity-scaled multiplier applied on top of base encounter chance:
- `Storm`, `Blizzard`, `Fog`, `Snow`: `1.0 + (0.6 × intensity)` → range 1.0×–1.6×
- `Rain`: `1.0 + (0.25 × intensity)` → range 1.0×–1.25×
- `Clear`: 1.0×

### Combat tactics (`CombatAnalysisEngine`)

- **Charge** disabled when `(Snow or Blizzard) AND intensity ≥ 0.5` (difficult terrain threshold)
- **Vanish/hide** option enabled in `Fog` or `Storm` (unchanged from before)

### Lighting (`ContextBuilder`)

- `Fog` → Dim light (daytime)
- `Storm` → Dim light (daytime), Darkness (night)
- Otherwise hour-driven

### LLM narrative context

The narrator and NPC dialogue receive `{ type, label, intensity, trend }` so they can reference "a light drizzle building into a storm" rather than just "Rain".

---

## Modifier definitions (Sprint 2 — NOT YET WIRED)

> **TODO (Sprint 2):** The modifiers below are computed by `WeatherEngine.getWeatherEffects()`
> but are **not yet applied** to dice rolls, movement costs, or combat resolution.
>
> Before wiring, a full audit is required across at minimum:
> `MechanicsEngine`, `CombatOrchestrator`, `EncounterDirector`, `RestingEngine`,
> `DamageResolver`, and all command handlers touching skill checks or movement.
> The codebase has grown significantly — undocumented callsites are likely.

| Modifier key | Weather | Value | Intended effect |
|---|---|---|---|
| `perceptionHearing` | Rain ≥ 0.40 | `'disadvantage'` | Disadvantage on hearing-based Perception checks |
| `fireResistance` | Rain ≥ 0.30 | `true` | Halve incoming fire damage |
| `stealthBonus` | Storm | `0–3` (intensity-scaled) | Bonus to Stealth / Hide checks |
| `passivePerceptionPenalty` | Storm | `0–3` (intensity-scaled) | Subtract from passive Perception |
| `lightningHazard` | Storm | `0–0.015` per tick | Chance per 30-min tick of a lightning strike (DEX save) |
| `heavilyObscured` | Fog ≥ 0.55 | `true` | Ranged attacks at disadvantage; treated as heavily obscured |
| `attackRangeLimit` | Fog | `5–15 squares` | Maximum effective range for ranged attacks |
| `difficultTerrain` | Snow ≥ 0.35, Blizzard | `true` | Movement cost ×2 |
| `visibilityLimit` | Snow | `25–50 squares` | Exploration reveal radius; ranged attack range cap |
| `visibilityLimit` | Blizzard | `10–18 squares` | As above, tighter |
| `exhaustionRisk` | Blizzard ≥ 0.72 | `true` | CON save (DC 10) each hour outdoors; fail = +1 exhaustion level |

---

## Tests

```
npx tsx src/ruleset/tests/test_weather_system.ts
```

106 assertions covering:
1. Phase progression (0–7) produces correct types and trends
2. Type mapping: all intensity × category × temperature combinations
3. Biome influence: Desert vs Jungle front category distribution (200 samples)
4. Temperature correctness: Mountain_High/winter never produces Rain; Desert/summer never produces Snow
5. Front continuity: blizzard cold carry, precipitation streak bonus
6. Time-of-day modifiers: morning fog, afternoon storm, night dissipation
7. Icon key and label accuracy at all intensity thresholds
8. Front velocity bounds and mountain blocking vs ocean speed
9. Backward compatibility: old saves without `front` field bootstrap correctly
10. Long simulation: 48 ticks (24h) — weather changes, intensity stays bounded, type stays valid

---

## Sprint 2 checklist (modifier wiring)

Update this document when Sprint 2 is complete.

- [ ] Audit all callers of `WeatherEngine.getWeatherEffects()`
- [ ] Wire `perceptionHearing: 'disadvantage'` → Perception roll resolver
- [ ] Wire `passivePerceptionPenalty` → passive Perception calculation
- [ ] Wire `stealthBonus` → Stealth / Hide check resolver
- [ ] Wire `fireResistance` → fire damage application
- [ ] Wire `lightningHazard` → TimeManager 30-min tick hazard check
- [ ] Wire `heavilyObscured` → ranged attack resolver
- [ ] Wire `attackRangeLimit` → ranged attack range validation
- [ ] Wire `difficultTerrain` → combat movement cost calculation
- [ ] Wire `visibilityLimit` → exploration reveal radius + ranged attack cap
- [ ] Wire `exhaustionRisk` → TimeManager hourly CON save
- [ ] Update this document to reflect Sprint 2 completion
