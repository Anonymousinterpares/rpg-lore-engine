# Comprehensive Technical Specification: Spatial-Enhanced Movement & Skill Expansion

## 1. Vision & Executive Summary

### 1.1 Current State ("As-Is")
Currently, movement in the RPG is abstract and visual-only. When a player selects a target hex, the `MovementEngine` calculates a time cost based on a global `TravelPace` (Slow, Normal, Fast) and a basic biome check. The `HexMapView` then renders a randomized, transient Bezier curve "wiggle" to animate the player marker. This path has no persistence; if a player travels between the same two points multiple times, the animation is re-randomized, and there are no mechanical benefits to traversing familiar or developed territory. Biomes are treated as isolated data points with no inter-hex infrastructure or logical connectivity.

### 1.2 The Goal ("To-Be")
Transform the world map into a persistent, interconnected landscape where travel is a core strategic gameplay loop. We aim to implement an infrastructure layer where roads and paths are generated procedurally but persist permanently once discovered. Movement should "lock" to these physical lines, providing significant speed and safety bonuses. This system will force players to make meaningful choices: taking the fast, safe road (longer route) vs. the dangerous, slow wilderness (shortcut). Travel becomes a layer where resource management (ink, parchment, spell slots) and skill proficiency (Survival, Cartography) determine the efficiency of the expedition.

---

## 2. Geographical & Biome Constraints (The "Logic of the Land")

### 2.1 Current State
Biomes are generated via the `ExplorationManager` and stored in `HexData`. While `StaticData.ts` defines `travelSpeedModifier` values for each biome, these are not currently utilized to their full potential by the `MovementEngine`. There is no logic for determining population-based infrastructure or topographical obstacles during road generation.

### 2.2 The Goal
Establish a strict hierarchy where the presence and quality of infrastructure are dictated by biome population density and topography.

### 2.3 The Infrastructure Hierarchy
Roads and Paths are metadata connections between hexes, strictly constrained by biome type and population density to ensure verisimilitude.

*   **ROADS (Thick, Solid/Stone Lines):**
    *   **Allowed Biomes:** `Urban`, `Farmland`, `Plains`.
    *   **Logic:** These represent maintained trade routes, patrolled by guards or local militia.
    *   **Modifiers:** 
        *   **Speed:** 2.0x (Travel takes 50% of base time).
        *   **Safety:** 0.3x Encounter Probability (Bandits/Tax Collectors only).
    *   **Visuals:** Rendered as a 4px wide solid line (color: `#5d4037` or `#8d6e63`).

*   **PATHS (Thin, Faint/Dashed Lines):**
    *   **Allowed Biomes:** `Forest`, `Swamp`, `Hills`, `Jungle`.
    *   **Logic:** These represent game trails, hunter tracks, or muddy rural routes used by locals.
    *   **Modifiers:** 
        *   **Speed:** 1.5x (Travel takes 75% of base time).
        *   **Safety:** 0.7x Encounter Probability (Wildlife/Scavengers).
    *   **Visuals:** Rendered as a 2px wide dashed line (dash-array: `4,4`, color: `#a1887f`).

*   **EXCLUDED ZONES (No Infrastructure):**
    *   **Aquatic:** `Ocean`, `Coast` (All 3 variants). No roads, bridges, or ferries exist in these zones for this expansion. The generator simply *stops* roads at the water's edge.
    *   **Mountains:** `Mountain`, `Mountain_High`. Standard roads/paths cannot be generated here naturally. (See **Hidden Paths** in Section 5.2).

### 2.4 Topographical Flow & Transitions
The generator must respect the difficulty of the terrain. A road cannot simply "blast through" a hill without changing character.

*   **The Downgrade Rule:** If a `ROAD` (originating from an `Urban` hex) crosses into a `Hills` hex, it automatically **downgrades** to a `PATH` for that specific segment.
*   **The Upgrade Rule:** If a `PATH` (winding through `Forest`) enters an `Urban` or `Farmland` hex, it automatically **upgrades** to a `ROAD` to signify approaching civilization.
*   **The Termination Rule:** If a road/path vector points into an `Ocean` or `Mountain` hex, the connection is **terminated** at the border. It does not continue.
*   **Volcanic Constraint:** Road stubs pointing into `Volcanic` or `Desert` biomes should be rendered as "Disappearing Paths" (tapering opacity) rather than abrupt cut-offs.

---

## 3. Data Architecture & Persistence Strategy

### 3.1 Current State
The `HexData` object in `src/ruleset/schemas/FullSaveStateSchema.ts` is the primary record for map state, but it lacks any fields for connectivity or permanent infrastructure. There is currently no way to save inter-hex relationships.

### 3.2 The Goal
Implement a highly compact connectivity model that allows for thousands of permanent roads across the map without bloating save file sizes or impacting loading performance.

### 3.3 Compact Connectivity Vectors
To optimize save file size and performance, roads are not stored as full objects but as **Connectivity Vectors** within the `HexData` schema.

*   **Schema Extension:**
    ```typescript
    interface HexData {
        // ... existing fields ...
        connections?: string; // Compact encoding of all infrastructure
    }
    ```

*   **Encoding Format:** A comma-separated string representing neighbor indices (0-5) and connection types.
    *   `Format:` `"SideIndex:Type:DiscoveredFlag"`
    *   `Example:` `"0:R:1,3:P:0"`
        *   `0:R:1` -> Neighbor at Side 0 (North-East) is connected via a **Road** (R), and it is **Discovered** (1).
        *   `3:P:0` -> Neighbor at Side 3 (South-West) is connected via a **Path** (P), but it is **Hidden/Undiscovered** (0).

*   **Deterministic Reconstruction:** 
    *   The `HexMapView` does NOT store Bezier coordinates. 
    *   Upon loading, the engine uses a **Deterministic Seed** (`HexID + NeighborID`) to reconstruct the Bezier `controlPoint` offsets. 
    *   **Math:** `controlOffset = (pseudoRandom(seed) * 0.4) - 0.2`.
    *   **Result:** The road curve looks *exactly the same* every time the game loads, without storing heavy float coordinates. This is critical for visual consistency in an AAA-grade experience.

---

## 4. Movement Engine: "The Rail System"

### 4.1 Current State
`MovementEngine.ts` calculates travel time using a simple `TravelPace` and a global biome check. The path drawing in `HexMapView` is randomized for every move, making it impossible to "follow" a road. Encounters are rolled based on a static probability that doesn't account for terrain development.

### 4.2 The Goal
Implement a "Snap-to-Rail" system where movement follows pre-defined infrastructure. The engine must recognize roads as "Bypasses" for terrain obstacles (like cliffs) and provide explicit narrative feedback to the player.

### 4.3 Snap-to-Road Logic
When `MovementEngine.move(startHex, targetHex)` is called, the engine performs a "Connectivity Check":

1.  **Check:** Does `startHex.connections` contain an entry for `targetHex`?
2.  **Case A: Connected (Road/Path):**
    *   **Forced Pathing:** The `travelAnimation` MUST use the static `controlPoint` calculated from the infrastructure seed. The player is "locked" to the road visual.
    *   **Narrative:** The output text updates: `"You follow the [Old Stone Road / Forest Path] toward [TargetBiome]."` This narrative sync is essential for world immersion.
    *   **Speed Calc:** `BaseTime * BiomeMod * (Type == 'R' ? 0.5 : 0.75)`.
    *   **Encounter Calc:** `BaseChance * (Type == 'R' ? 0.3 : 0.7)`.
    *   **Blocker Bypass:** If `HexMapManager` lists a side as impassable (e.g., `traversable_sides`), a Road connection overrides this block, allowing passage.

3.  **Case B: Wilderness (No Connection) OR Stealth Mode:**
    *   **User Agency:** The UI includes a **"Travel Stance" Toggle** (Normal / Stealth).
    *   **Stealth Mode Logic:** Even if a Road exists, the player can choose to travel "Off-Road" to avoid attention.
    *   **Effect:** The engine ignores the connection's Speed and Safety bonuses. Movement treats the hex as wild terrain.
    *   **Dynamic Wiggle:** The engine generates a purely random, transient `controlPoint` for the animation (visualizing the deviation).
    *   **Narrative:** `"You strike out into the wild [Biome], forging your own path."` OR `"You skirt the edge of the road, moving through the trees to avoid detection."`
    *   **Speed Calc:** `BaseTime * BiomeMod` (Slow).
    *   **Encounter Calc:** `BaseChance * 1.0` (Normal) OR `Stealth Check` vs Biome Awareness.

---

## 5. Skill System: Physical vs. Mathematical Navigation

### 5.1 Current State
Skills are defined in `src/data/codex/skills.json` and utilized for generic checks in `MechanicsEngine.ts`. However, skills like `Survival` have no specific engine hooks for map exploration. `Cartography` is not yet implemented as a system-integrated skill.

### 5.2 The Goal
Elevate skills into active navigation tools that interact with the map data and require physical resources. Differentiate clearly between the "Intuition" of Survival and the "Technical Draftsmanship" of Cartography.

### 5.3 Cartography (New Skill - INT/WIS Hybrid)
**Definition:** The mathematical registration of the world. It governs the ability to create permanent records of discoveries.

*   **Formula:** `Cartography Check = 1d20 + (INT + WIS / 2) + ProficiencyBonus`.
*   **Passive Benefits:**
    *   **Precision (INT):** Increases the "Reveal Radius" for resource nodes. Identifies "Road Stubs" (outgoing connections) 1 hex deeper into the Fog of War.
    *   **Intuition (WIS):** Improves the success rate of active survey actions.

*   **Active Ability: "Survey Area"**
    *   **Trigger:** Player clicks "Survey Area" in the Utility Menu.
    *   **Requirement:** Must possess `Cartographer's supplies` in inventory.
    *   **Cost:** Consumes **1x Ink Charge** and **1x Parchment** (removed from inventory).
    *   **Resource Note:** `Ink` items now possess a `charges` attribute (Default: 10). This prevents the frustration of "consuming a whole bottle" for one map.
    *   **Check:** `INT (Cartography)` vs DC 12 (Plains) / DC 15 (Forest) / DC 18 (Swamp).
    *   **Technical Implementation of "Passive Discovery":** 
        *   *How it works:* When `HexMapManager` generates a new hex, it creates the `connections` string immediately (e.g., `"0:R:0"`). The `0` flag means "Physically there, but Player hasn't seen it."
        *   *Passive Effect:* High Passive Cartography allows the UI to check this hidden metadata. If a hidden road exists, the UI flashes a prompt: *"You notice faint tracks leading [Direction]..."*.
    *   **Success:** Permanently sets the `DiscoveredFlag` to `1` for all connections in the current hex and adjacent hexes. The roads become visible on the map forever.
    *   **Failure:** Resources consumed, but the map remains "sketchy" (foggy).

*   **Acquisition & Gear:**
    *   **Character Creation:** If `Cartography` is selected as a starting skill, the character starts with **Cartographer's supplies**, **1x Ink (10 Charges)**, and **10x Parchment**.
    *   **Loot & Shops:** These items are added to `Scholar`, `Library`, and `Ruins` loot tables. Shops in `Urban` centers sell them for gold.

### 5.4 Survival (Existing Skill - WIS)
**Definition:** The physical intuition of the wild. It governs the ability to traverse untamed lands safely.

*   **Mechanic: Hidden Path Discovery**
    *   **Trigger:** Entering a `Mountain` or `Forest` hex (where roads are rare/impossible).
    *   **Check:** Auto-roll `Wisdom (Survival)` vs **Biome-Scaled DC**.
        *   *Forest/Hills:* **DC 14**
        *   *Swamp/Jungle/Mountain:* **DC 16**
        *   *Volcanic/Deadly:* **DC 18+**
    *   **Success:** A **Hidden Path** is revealed for that specific hex edge.
    *   **Benefit:** The player can traverse that edge without the "Impassable" penalty (for Mountains) or at `PATH` speed (1.5x) instead of the slow biome speed. This represents the character finding a narrow ledge or animal trail.
    *   **Visual:** Rendered as a faint, dotted line (opacity 0.5).

*   **Anti-Attrition:**
    *   High Survival proficiency reduces the probability of "Travel Fatigue" (a mechanic where HP/Stamina drains during multi-hex journeys) by 10% per proficiency tier.

---

## 6. Spell System: Exploration Divination

### 6.1 Current State
`SpellManager.ts` handles spellcasting primarily for combat. Exploration-mode casting is limited to healing or summoning, with most utility spells (like `Find the Path` or `Teleport`) having only basic text outputs without engine hooks. Spell slots are tracked, but there are no consequences for failing high-tier utility magic.

### 6.2 The Goal
Integrate high-tier Divination and Transmutation magic into the world-map engine. Spells should provide "supernatural" navigation advantages while carrying the risk of "Divination Blindness" to maintain balance.

### 6.3 Casting Rules & "Divination Fumble"
To prevent spamming, powerful navigation magic carries a risk.

*   **Casting Check:** `1d20 + (INT/WIS/CHA Mod) + Proficiency` vs **DC 16**.
*   **Success:** The spell activates normally.
*   **Failure (The Fumble):** 
    *   The Spell Slot is consumed.
    *   The caster suffers **"Exploration Blindness"**: They cannot cast *any* Divination/Navigation spell of **Level 3 or higher** (e.g., *Arcane Eye*, *Find the Path*) or Rituals until they complete a **Long Rest**.
    *   *Clarification:* This does **NOT** block combat-focused Divination spells like *Hunter's Mark*, *True Strike*, or *See Invisibility*.
*   **Long Rest Definition:** Strictly defined as **8 Hours** of game time (e.g., spending 2 "Wait" cycles).

### 6.4 Spell: Find the Path (Tier 6)
A high-tier spell that trivializes navigation for a short window.

*   **Duration:** 8 Hours (Matching a standard travel day cycle).
*   **Effect 1: The Golden Thread:** 
    *   A unique, glowing **Gold Bezier Curve** is rendered in `HexMapView`. 
    *   It bypasses Fog of War, drawing a line from the Player to the Target (even if the target is 20 hexes away in the black).
*   **Effect 2: Road Manifestation:**
    *   The spell magically smooths the terrain. The player's `travelAnimation` ALWAYS uses "Road" logic (2.0x Speed, 0.3x Encounter), even if walking through a Swamp or Mountain.
*   **Effect 3: Ancient Discovery:**
    *   Reveals `ANCIENT_ROAD` connections—magical shortcuts (e.g., portals, ley lines) through Mountains that are invisible to non-magical skills.

### 6.5 Other Navigation Spells (Utility Menu)
The engine must support the following spells in exploration mode:
*   **Teleport / Teleportation Circle:** Allows instant travel to known "Anchor" hexes (Cities/Towns). Requires anchor registration.
*   **Word of Recall:** Instant return to a designated "Sanctuary" hex (e.g., a Home Base).
*   **Transport via Plants / Tree Stride:** Allows "Forest-to-Forest" teleportation. Tree Stride allows short hops between adjacent forest hexes at zero time cost.
*   **Arcane Eye / Scrying:** Reveals the Fog of War in a distant radius (2-5 hexes) without moving there.

---

## 7. UI/UX: The Compass Utility Menu

### 7.1 Current State
The exploration UI (`LocationPanel.tsx`, `HexMapView.tsx`) focuses on displaying current location data and movement. There is no central hub for non-combat actions, forcing players to use slash commands (e.g., `/cast`) for exploration spells, which is unintuitive and lacks visual feedback on resource availability.

### 7.2 The Goal
Provide a unified, intuitive "Exploration Hub" that consolidates skills and spells into a single, clean interface. The menu should dynamically reflect the character's capabilities and resource state.

### 7.3 Access & Layout
A new **Compass Icon** is added to the `LocationPanel` (top-right). Clicking it opens the **Navigation Modal**.

*   **Section 1: Skills**
    *   `Survey Area (Cartography)`
        *   *State:* **Active** if Player has the skill, Cartographer's supplies, Ink, and Parchment.
        *   *State:* **Greyed Out** (with tooltip: "Missing Cartographer's supplies/Ink/Parchment") if any requirement is missing.
    *   `Search for Tracks (Survival)`
        *   *State:* **Active** if Player has the skill.
        *   *State:* **Greyed Out** if the character is not proficient.

*   **Section 2: Spells**
    *   Dynamically lists all known exploration spells (`Find the Path`, `Teleport`, etc.).
    *   *State:* **Active** if Player has a valid Spell Slot and any required components.
    *   *State:* **Greyed Out** if Slots are empty.
    *   *State:* **LOCKED (Red)** if the player is currently suffering from "Divination Blindness."

---

## 8. Rendering: Centroid Stitching & Performance

### 8.1 Current State
`HexMapView.tsx` renders all discovered hexes and a single temporary player trail. It does not support persistent vector layers or complex intersections, leading to "Spaghetti" overlaps if multiple lines were drawn over the same hex.

### 8.2 The Goal
Ensure AAA-grade visual polish for the infrastructure layer. Roads should intersect seamlessly at junctions, and the renderer must handle hundreds of persistent lines without impacting frame rates.

### 8.3 Centroid Stitching Algorithm
To ensure roads intersect perfectly (where 3+ roads meet):
1.  **Junction Detection:** The `InfrastructureManager` flags a hex as a "Junction" if `connections.length > 2`.
2.  **Centroid Calculation:** 
    *   Calculate the average `(x,y)` of all incoming connection endpoints.
    *   Apply a **Deterministic Jitter** (`seed = hex.id`) to offset the center slightly (prevents artificial, perfectly straight "star" patterns).
3.  **Visual Hub:** 
    *   Draw a specific "Junction Graphic" (e.g., a cobblestone circle for Roads or a cleared dirt patch for Paths) at the centroid.
    *   **Stitching:** All incoming road Bezier curves are modified to terminate exactly at this Centroid, creating a seamless, organic intersection.

### 8.4 Performance: Distance Culling
To maintain 60FPS on the world map:
*   **Culling:** Only connections within the player's "Known World" and within a certain radius of the viewport (e.g., 10 hexes) are rendered as high-fidelity SVG paths.
*   **Level of Detail (LOD):** Distant roads are rendered as simple, un-curved straight lines or are hidden entirely until the player zooms in or moves closer.
