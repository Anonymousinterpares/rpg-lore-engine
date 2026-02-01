# Master Architecture: LLM-Orchestrated RPG Engine

**Version:** 2.0 (Modular Refactor)
**Status:** Architecture Active

## 1. Project Overview
A hybrid text-based RPG engine using a Multi-Agent System (MAS) for infinite narrative creativity, constrained by a strict, deterministic Mechanics Core.
**Philosophy:** "The AI describes the world; The Code rules the world."

## 2. Directory Structure & References
The engine follows a **"Code/Schema as Source"** (VibeCoding) strategy. See [ARCHITECTURE.md](file:///d:/coding/rpg_NEW/ARCHITECTURE.md) for technical implementation details.

### 2.1 Mechanics & Data (Strict Source)
*   **[Schemas](file:///d:/coding/rpg_NEW/src/ruleset/schemas/):** Zod definitions for all entities.
*   **[Data Library](file:///d:/coding/rpg_NEW/data/):** Validated JSON objects for Spells, Monsters, Items, etc.

### 2.2 Documentation (Views)
*   **[Rules Engine](docs/Mechanics/Rules_Engine.md):** High-level combat and movement logic.
*   **[Content Index](docs/Content/):** Modular Markdown views of the game data.

## 3. System Architecture
### 3.1 Hub-and-Spoke Model
*   **UI (Frontend):** User input/output.
*   **Core (Python):** Central router. Connects UI, DB, Logic, and Agents.
*   **Logic Layer:** Python modules implementing rules from `docs/Mechanics`.
*   **Agent Swarm:** LLMs handling narrative.

### 3.2 Agent Roles
1.  **Narrator (DM):** Describes scenes/outcomes. *Constraint:* Cannot modify HP/XP directly. Must invoke Tools.
2.  **NPC Controller:** Simulates party members.
3.  **Director:** Monitors Pacing/Fun. Injects encounters.
4.  **Scribe:** Summarizes logs into permanent history.

## 4. Internal Communication Protocol (ICP)
LLM responses must return structured JSON for the Engine to process.

```json
{
  "narrative_output": "The text the player sees.",
  "engine_calls": [
    { "function": "add_xp", "args": {"amount": 50, "reason": "combat"} },
    { "function": "apply_condition", "args": {"target": "player", "condition": "poisoned"} }
  ],
  "world_updates": {
    "hex_discovery": "forest_02"
  }
}
```

## 5. Logic Flow
1.  **Input:** Player sends text.
2.  **Intent Router:** Classifies Action vs Speech.
3.  **Resolution:** 
    *   If Action: Engine calculates Outcome (Hit/Miss, Dmg) using `Rules_Engine.md`.
    *   If Speech: Passed to Agent.
4.  **Narration:**
    *   Narrator receives: [Result: Success. Damage: 12. State: Enemy Dead].
    *   Narrator outputs: "You swing your axe and sever the goblin's head!"
5.  **State Update:** Engine updates JSON DB.
