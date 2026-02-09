# Master Design Document: Spatial-Enhanced Text-Based Combat & Environment System

# 1. Introduction
This document outlines the comprehensive design for a text-based RPG engine that merges vivid narrative with deep, deterministic simulation. The system introduces an **invisible spatial layer** (20x20 grid) to combat, ensuring that positioning, range, and environmental features matter without requiring a distinct visual interface. It replaces random chance with a **Simulationist Model** where Time, Weather, Biome, and Magic directly dictate gameplay outcomes.

# 2. Core Pillars
1.  **Spatial Depth**: Combat occurs on a simulated grid with Cover, LOS, and Flanking, narrated to the player.
2.  **Environmental Determinism**: Weather (Blizzards, Storms) and Time (Night/Day) hard-modify combat stats and travel safety.
3.  **Tactical Navigation**: Movement is Click-to-Move only, preventing narrative hallucinations. Pacing choices (Stealth vs Fast) matter.
4.  **Strategic Recovery**: "Resting" is distinct from "Waiting". Resting carries a high risk of Ambush unless mitigated by Magic or Sentries.
5.  **Arcane Supremacy**: Spells are not just damage; they are mechanical overrides (e.g., *Tiny Hut* = 100% Safety).

---

# 3. The Environmental Foundation

## 3.1 Advanced Weather System
The `WeatherEngine` simulates dynamic weather based on the current Season and Biome.

### Weather Types & Effects
| Weather | Visual/Narrative | Mechanical Effects |
| :--- | :--- | :--- |
| **Clear/Sunny** | Bright, far visibility. | Base state. No modifiers. |
| **Rain** | Gray sheets, wet ground. | **Disadvantage** on Perception (Hearing). Extinguishes non-magical fires. |
| **Storm** | Thunder, lightning flashes. | **-2 Passive Perception**. Loud noise masks movement (Stealth Advantage). Risk of Lightning Strike (1% per turn). |
| **Fog/Mist** | Thick, obscuring air. | **Heavily Obscured**: Disadvantage on Attacks > 5ft. Range limits. |
| **Snow/Blizzard** | Whiteout, biting cold. | **Difficult Terrain** (Half Speed). Visibility reduced to 15ft. **Future**: Constitution Check vs Exhaustion (DC 10 + 1 per hour). |

### Seasonal Logic
*   **Winter**: High probability of Snow (40%) and Blizzards (10%).
*   **Summer**: High probability of Rain (30%) and Storms (15%).
*   **Transition**: Varies by month.
*   **Duration**: Weather states persist for `1d6` hours before re-rolling.

### UI Implementation Strategy
*   **Display Location**: Integrated into the **Top Header TimeDisplay** (Center).
*   **Visuals**: Small 24x24 or 32x32 icon (Weather Type) + Text Label (e.g., "Blizzard").
*   **Asset Source**: Images loaded from `/public/assets/weather/{weather_type}.png`.
*   **Reasoning**: Keep the background black for maximum text legibility (Accessibility). The Header is the "Dashboard" of World State.

### LLM Context Update
The `ContextBuilder` **MUST** inject the current weather state into the Prompt Context for every narrative generation.
*   **Format**: `[Current Weather: Heavy Rain - Visibility Low - Sound Masked]`
*   **Requirement**: The Narrator must describe the sensory details (sound of rain, cold wind) in every travel/combat description.

---

# 4. Navigation & Exploration

## 4.1 Robust Click-to-Move
To ensure absolute state consistency, Narrative Movement ("I go north") is processed via the exact same engine logic as clicking the Map.

1.  **Input**: Player clicks target Hex OR types "move north".
2.  **Validation**: Engine checks `HexMapManager.canTraverse(current, target)`.
3.  **Execution**:
    *   Update `GameState` coordinates.
    *   Deduct Time based on **Travel Pace**.
    *   Narrator describes the visual transition.
    *   **Encounter Check** runs immediately.

## 4.2 Travel Pacing ($M_{activity}$)
Players can toggle their Travel Pace, trading speed for safety.

| Pace | Speed | Time/Hex | Encounter Mod | Mechanical Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Slow (Stealth)** | 0.5x | 8 hours | **0.5x** | Engine makes a **Stealth Check** vs Biome Passive Perception. Success = Avoid non-scripted encounters. |
| **Normal** | 1.0x | 4 hours | **1.0x** | Baseline. Standard Passive Perception. |
| **Fast** | 1.33x | 3 hours | **1.5x** | **-5 Penalty** to Passive Perception. High risk of Ambush (Surprise Round). |

### Future Mechanics: Stealth Depth
*   **Current Iteration**: Stealth Check vs Fixed Biome DC (e.g., Forest = 12).
*   **Future Goal**: Stealth Check vs **Specific Monster Passive Perception**. Logic: The Director pre-rolls the "Potential Encounter" (e.g., Owlbear, PP 15) *before* the check. If Player Stealth < 15, Encounter triggers.

---

# 5. Encounter Mechanics & Probability

## 5.1 The Probability Formula
Encounters are checked every **30 minutes** of game time.

$$ P_{encounter} = (P_{base} \times M_{biome} \times M_{time} \times M_{activity}) - P_{cleared} $$

*   **Base Chance ($P_{base}$)**: 5% per 30 minutes (0.05).
*   **Time Modifier ($M_{time}$)**:
    *   Day (Sunrise-Sunset): **1.0x**
    *   Night (Sunset-Sunrise): **2.0x** (Nocturnal predators).
*   **Cleared Hex Logic ($P_{cleared}$)**:
    *   Victorious combat triggers "Zone Control".
    *   **Safety Duration**: 4 Hours.
    *   Effect: Probability reduced by **90%** during this window.

## 5.2 Biome Danger Tiers ($M_{biome}$)

| Tier | Biomes | Multiplier | Passive Perception (DC) |
| :--- | :--- | :--- | :--- |
| **Safe** | *Urban*, *Farmland*, *Roads (Future)* | **0.5x** | 10 (City Watch) |
| **Standard** | *Plains*, *Coast*, *Hills*, *Forest* | **1.0x** | 12 (Wildlife) |
| **Dangerous** | *Swamp*, *Mountain*, *Desert*, *Ocean*, *Tundra*, *Jungle* | **2.0x** | 14 (Predators) |
| **Deadly** | *Volcanic*, *Ruins* | **3.0x** | 16 (Monsters) |

## 5.3 Magic & Safety Overrides
Spells provide hard mechanical overrides to these probabilities.

| Spell | Level | Duration | Encounter Effect | Combat Effect (If Encounter Occurs) |
| :--- | :--- | :--- | :--- | :--- |
| **Alarm** | 1 | 8h | None (Normal chance) | **Prevents Surprise**. Party wakes up fully armed/armored. |
| **Rope Trick** | 2 | 1h | **0% Chance** | Perfect safety for Short Rest (Extradimensional). |
| **Tiny Hut** | 3 | 8h | **0% Chance** | Impenetrable dome. Long Rest safe haven. |
| **Invisibility** | 2 | 1h | **0.5x Chance** | Harder to spot, but smell/sound remain. |
| **Sanctum** | 7 | 24h | **0% Chance** | Invisible, hidden mansion. Absolute safety. |

---

# 6. Resting & Recovery System

The "Rest" interaction is split into two distinct modes with separate UI flows.

## 6.1 WAIT (Pass Time)
*   **Purpose**: Await a specific time (e.g., Nightfall) or meet an NPC.
*   **UI**: Time Slider (10m to 24h).
*   **Logic**:
    *   Time advances.
    *   Weather checks run.
    *   **Encounter Checks** run normally.
    *   **No HP/Resource Recovery**.

## 6.2 REST (Recovery)
*   **Purpose**: Recover HP/Slots (Short/Long Rest logic).
*   **UI**: Toggle [Short Rest (1h)] or [Long Rest (8h)].
*   **Logic**:
    *   Time advances (1h or 8h).
    *   **High Risk Activity**: Campfire smoke/light attracts attention (**1.5x Encounter Chance**).
*   **The Ambush System**:
    *   If an encounter generates during a Rest, it is an **Ambush**.
    *   **Surprise Round**: Enemy takes a full turn before Player.
    *   **Counter-Measures**:
        *   *Alarm* spell negates Surprise.
        *   **Sentry Duty**: Player assigns a watcher. Sentry makes a Perception Check vs Enemy Stealth. Success = No Surprise.

---

# 7. Spatial Combat System (The Invisible Grid)

## 7.1 The Simulation
*   **Grid**: 20x20 abstract units.
*   **Zones**:
    *   *Player Start*: 3x5 area (Bottom Center).
    *   *Enemy Start*: Opposite edge or Surrounding (if Ambush).
*   **Terrain**: Procedurally generated obstacles (Trees, Rocks, Lava) based on Biome.

## 7.2 Turn Structure
1.  **Situation Report**: Narrator describes range and cover.
2.  **Player Choice**:
    *   **Standard Actions**: Attack, Cast, Dash, Disengage.
    *   **Contextual Maneuvers**: "Dash to Boulder (Cover)", "Flank Orc B".
3.  **Resolution**: Engine monitors grid state -> Calculates Hit/Damage -> Narrates outcome.
4.  **Enemy AI**: Logic scaled by Level (Low=Aggressive, High=Tactical).

## 7.3 Combat Orchestration (Technical Rule)
**Strict Phase Control**: The Narrator output must complete fully (animation finished) before the User Input UI unlocks. This preserves the "Turn-Based" pacing and prevents text spam.

---

# 8. Enemy Artificial Intelligence
Enemies rely on the same spatial data as players.

*   **Low Level (Beasts/Zombies)**: Charge nearest target. Ignore cover.
*   **Mid Level (Bandits/Soldiers)**: Seek Cover if HP < 50%. Flank if possible. Focus fire.
*   **High Level (Mages/Bosses)**:
    *   Use Environment (Push player into Lava).
    *   Kiting (Shoot & Move).
    *   Setup Ambushes (Hide behind obstacles).

---

# 9. Implementation Roadmap

## Phase 1: Environment & Logic (Weeks 1-2)
*   [ ] **WeatherEngine**: Implement seasonal probabilities and effect states.
*   [ ] **Encounter Probability 2.0**: Code the formula.
*   [ ] **Resting Overhaul**: Split UI into Wait/Rest tabs. Implement Ambush logic.
*   [ ] **Weather UI**: Add icon/text to `TimeDisplay` header.

## Phase 2: Navigation & Safety (Week 3)
*   [ ] **Click-to-Move**: Enforce strict engine validation for all movement.
*   [ ] **Pacing UI**: Add Slow/Normal/Fast toggle to map screen.
*   [ ] **Magic Integrations**: Add `CampState` to track active safety spells (*Tiny Hut*, etc.).

## Phase 3: Spatial Combat Core (Month 2)
*   [ ] **Grid Data Structure**: Create the 20x20 simulation class.
*   [ ] **Procedural Deployment**: logic for obstacle scattering and zone assignment.
*   [ ] **Contextual Menu**: Generate dynamic move options based on grid analysis.

## Phase 4: Future Expansions
*   [ ] **Advanced Weather Effects**: Implementation of Constitution checks for extreme weather (Heat/Cold).
*   [ ] **Specific Monster Stealth**: Migrating from Biome DC to specific Monster Sheet Stealth stats for checks.
*   [ ] **Global Road System**: Defining "Road" hexes with distinct safety tiers.
