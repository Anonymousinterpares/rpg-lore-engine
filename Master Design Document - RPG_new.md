# LLM-Orchestrated RPG Engine: Master Design Document

Version: 1.0
Status: Approved for Implementation

## 1. Project Overview

Concept: A text-based Role-Playing Game engine that utilizes a Multi-Agent System (MAS) to provide infinite narrative creativity (via LLM) constrained by strict, deterministic game mechanics (via Code).
Core Philosophy: "The AI describes the world; The Code rules the world."

## 2. System Overview

### 2.1. Key Features

Hybrid Intelligence: LLM for narrative/NPCs; Python for dice/state/inventory.

Dynamic Modes: Supports Single Player (1 Human + 5 NPCs) to Multiplayer (6 Humans) with seamless drop-in/drop-out.

Permanent World: Procedural generation of map hexes that become permanent once discovered.

Living History: An "Append-Only" character biography and a growing "Storyline Document" maintained by a Scribe Agent.

Strict Progression: XP, Leveling, and Perks are defined in configuration files, not hallucinated by AI.

### 2.2 Technology Stack

Language: Python 3.10+

Frontend: Streamlit (Recommended for rapid prototyping of Chat + Sidebar UI) or React (for advanced visual hex maps).

Data Storage: JSON Files (Local flat-file database for transparency and easy editing).

AI Provider: OpenAI API (GPT-4o) or Anthropic API (Claude 3.5 Sonnet).

Orchestration: LangChain (optional) or raw Python API calls (recommended for control).

### 2.3 System Architecture: Hub-and-Spoke

The system relies on a central Engine Core that mediates communication between the User Interface, the State Database, and the Agent Swarm.

graph TD
    User[Player Inputs] --> UI[Frontend Interface]
    UI --> Core[Engine Core (Python)]
    
    subgraph "Data Layer (JSON)"
        DB_Char[Character Sheets]
        DB_Map[Map Registry]
        DB_Rules[Rules Config]
        DB_Story[Story Database]
    end
    
    subgraph "Logic Layer (Deterministic)"
        Logic_Dice[Dice Roller]
        Logic_XP[XP Calculator]
        Logic_Inv[Inventory Manager]
    end
    
    subgraph "Agent Swarm (LLM)"
        Agent_Narrator[The Narrator (DM)]
        Agent_Director[The Director (Pacing)]
        Agent_NPC[NPC Controller]
        Agent_Scribe[The Scribe (Summarizer)]
    end

    Core <--> DB_Char
    Core <--> DB_Map
    Core <--> Logic_Dice
    Core <--> Agent_Narrator
    Core --> Agent_Scribe


## 3. Data Schemas (The Source of Truth)

Strict adherence to these schemas is required to ensure data integrity.

### 3.1 The Character Sheet (characters.json)

Supports the "Living History" requirement and expandable sections.

{
  "char_id": "uuid_v4_string",
  "player_type": "HUMAN", // or "NPC"
  "is_active": true, // If false, character is in "camp"
  "profile": {
    "name": "Valerius",
    "race": "Human",
    "class": "Rogue",
    "specialty": "Assassin", // Optional, can be null
    "level": 3,
    "current_exp": 3450
  },
  "stats": {
    "str": 12, "dex": 18, "con": 14, "int": 10, "wis": 13, "cha": 8
  },
  "saving_throws": {
    "str": 2, "dex": 5, "con": 2, "int": 0, "wis": 1, "cha": -1
  },
  "skills": {
    "acrobatics": { "score": 0, "proficient": false, "ability": "dex" },
    "animal_handling": { "score": 0, "proficient": false, "ability": "wis" },
    "arcana": { "score": 0, "proficient": false, "ability": "int" },
    "athletics": { "score": 0, "proficient": false, "ability": "str" },
    "deception": { "score": 0, "proficient": false, "ability": "cha" },
    "history": { "score": 0, "proficient": false, "ability": "int" },
    "insight": { "score": 0, "proficient": false, "ability": "wis" },
    "intimidation": { "score": 0, "proficient": false, "ability": "cha" },
    "investigation": { "score": 0, "proficient": false, "ability": "int" },
    "medicine": { "score": 0, "proficient": false, "ability": "wis" },
    "nature": { "score": 0, "proficient": false, "ability": "int" },
    "perception": { "score": 0, "proficient": false, "ability": "wis" },
    "performance": { "score": 0, "proficient": false, "ability": "cha" },
    "persuasion": { "score": 0, "proficient": false, "ability": "cha" },
    "religion": { "score": 0, "proficient": false, "ability": "int" },
    "sleight_of_hand": { "score": 0, "proficient": false, "ability": "dex" },
    "stealth": { "score": 0, "proficient": false, "ability": "dex" },
    "survival": { "score": 0, "proficient": false, "ability": "wis" }
  },
  "modifiers": [
    { "source": "Blessing of Shadow", "effect": "+2 Stealth", "duration_turns": 10, "type": "positive" },
    { "source": "Broken Leg", "effect": "-50% Movement", "duration_turns": "permanent", "type": "negative" }
  ],
  "inventory": {
    "gold": 150,
    "capacity_slots": 20,
    "items": [
      { "item_id": "wpn_dagger_01", "name": "Rusty Dagger", "equipped": true, "slot": "main_hand" },
      { "item_id": "pot_heal_01", "name": "Minor Health Potion", "equipped": false, "quantity": 3 }
    ]
  },
  "background_story": {
    "original_bio": "Born in the slums of Oakhaven...",
    "chronicles": [ // Append-only list of events
      { "turn": 50, "event": "Slew the Goblin King." },
      { "turn": 120, "event": "Lost left eye in the trap room." }
    ]
  },
  "notes": "Hates spiders. Secretly collecting shiny rocks."
}


### 3.2 The Hex Map (map_registry.json)

Defines the world. Once a Hex is generated, it is saved here forever.

{
  "grid_id": "world_01",
  "hexes": {
    "0,0": {
      "coordinates": [0, 0],
      "biome": "Forest",
      "name": "The Whispering Woods",
      "description": "A dense forest where the wind sounds like voices.",
      "traversable_sides": {
        "N": true, "S": true, "E": false, "W": true, "NE": true, "NW": true
      },
      "interest_points": [
        { "id": "poi_01", "name": "Ancient Shrine", "discovered": false },
        { "id": "poi_02", "name": "Bandit Camp", "discovered": true }
      ],
      "visited": true
    },
    "0,1": {
      "coordinates": [0, 1],
      "generated": false // Triggers generation if player enters
    }
  }
}


### 3.3 Rules Configuration (rules.json)

Defines the strict mechanics so the LLM doesn't guess.

{
  "xp_table": {
    "1": 0, "2": 300, "3": 900, "4": 2700, "5": 6500,
    "6": 14000, "7": 23000, "8": 34000, "9": 48000, "10": 64000,
    "11": 85000, "12": 100000, "13": 120000, "14": 140000, "15": 165000,
    "16": 195000, "17": 225000, "18": 265000, "19": 305000, "20": 355000
  },
  "proficiency_bonus": {
    "1-4": 2, "5-8": 3, "9-12": 4, "13-16": 5, "17-20": 6
  },
  "xp_rewards": {
    "combat_kill_minion": 50,
    "combat_kill_boss": 500,
    "skill_success_easy": 10,
    "skill_success_hard": 50,
    "discovery_poi": 100
  },
  "class_perks": {
    "Rogue": {
      "level_2": "Cunning Action",
      "level_5": "Uncanny Dodge"
    }
  }
}

### 3.4 Master Compendium (compendium.json)

This document serves as the "Lore Truth." No entity can exist without a base archetype defined here.

{
  "races": {
    "Human": { "traits": ["Versatile: +1 Skill, +10% XP"] },
    "Elf": { "traits": ["Fey Ancestry", "Trance"] },
    "Dwarf": { "traits": ["Poison Resilience", "Stonecunning"] }
  },
  "classes": {
    "Fighter": { "hit_die": "d10", "primary_stat": "str/dex", "specialties": ["Champion", "Battle Master"] },
    "Wizard": { "hit_die": "d6", "primary_stat": "int", "specialties": ["Evoker", "Abjurer"] }
  },
  "magic_schools": {
    "Evocation": { "description": "Blasts and Heals", "spells": ["Fireball", "Cure Wounds"] },
    "Abjuration": { "description": "Wards and Banishing", "spells": ["Shield", "Dispel Magic"] }
    // ... all 8 schools
  },
  "weapon_archetypes": {
    "Longsword": { "base_die": "1d8", "type": "Slashing", "properties": ["Versatile"] },
    "Dagger": { "base_die": "1d4", "type": "Piercing", "properties": ["Finesse", "Thrown"] }
  }
}

## 4. The Agent Swarm (LLM Modules)

### 4.1 The Narrator (DM)
Role: Primary interface. Describes the scene, outcomes of actions, and general atmosphere.

Input: Chat History (Last 10 turns), Current State (Location + Active Party Status), Logic Result (Success/Fail).

Output: Narrative text.

Constraint: Cannot change HP/XP directly. Must issue "Function Calls" if narrative dictates a change (e.g., "The trap triggers!").

### 4.2 The NPC Controller
Role: Simulates companions.

Behavior: Dynamic injection. If 3 NPCs are in the party, this agent generates 3 distinct responses based on their background and traits.

Multiplayer Logic: In a 6-player game, this agent is dormant. In a 1-player game, it controls 5 slots.

### 4.3 The Director (Pacing Engine)
Role: Monitors "Fun".

Logic: Analyses the last 20 turns. If no combat/risk occurred, it injects an event from the Encounters table.

Output: System Directive to Narrator (e.g., [DIRECTIVE: Suddenly, a storm begins. Force a survival check.]).

### 4.4 The Scribe (Context Compactor)
Role: Memory Management.

Frequency: Runs every N turns (Configurable, e.g., 20).

Input: Raw chat logs of the last 20 turns.

Output: A concise paragraph appended to story_summary.md.

Action: Truncates the active token window, keeping only the summary + last 5 turns.

## 5. Logic Core & Workflows

### 5.1 The Game Loop (Turn Lifecycle)

**Input Phase:**

Single Player: Player inputs text.

Multiplayer: System waits for End Turn signal from all active humans.

**Intent Analysis (Router):**

System checks: Is this a command (/inventory, /stats) or narrative action?

If Action: 
1. Check Action Economy (Standard Action, Bonus Action, Move).
2. Is it a Skill Check, Attack, or Cast Spell?

**Logic Execution (Rulekeeper):**

Combat: roll_d20() + modifiers. Compare vs Target AC. Calculate Damage.

Movement: Check map_registry. Is the target hex side traversable?

If New Hex: Trigger "Hex Generation" routine (LLM creates description -> Saved to DB).

**State Update:**

Apply damage, consume items, move coordinates.

Smart XP Attribution: If target_hp <= 0, Rulekeeper looks up xp_rewards and calls add_xp(party_ids, amount).

**Narrative Generation:**

Engine constructs prompt: [Result: Success. Damage: 12. Enemy: Dead. Location: Forest.]

Narrator Agent generates text: "With a swift strike, you sever the goblin's head..."

**Post-Processing:**

Check Scribe trigger.

Check Director trigger.

Update UI.

### 5.2 XP & Leveling Logic
Trigger: Whenever add_xp() is called.

Check: if current_exp >= rules.xp_table[current_level + 1]

Event: LevelUp.

System prompts Player: "You reached Level X! Choose a Perk." (if applicable).

Update stats and max_hp in JSON.

Add entry to background_story.chronicles: "Reached Level X in [Location]."

### 5.3 Map Discovery System
Player attempts to move North.

Logic checks current_hex data: traversable_sides.N == true?

Logic calculates new coordinate: (0, 1).

Logic checks map_registry:

Case A (Exists): Load description and poi. Pass to Narrator.

Case B (Null):

Read biome of surrounding hexes.

Prompt LLM: "Generate a new hex biome/description/POIs compatible with neighbor [Forest]."

Save result to map_registry.

Pass to Narrator.

### 5.5 Resting & Recovery
### 5.5 Resting & Recovery
*   **Short Rest (1 hour):** Player can spend Hit Dice to recover HP. Refreshes Warlock spell slots, Monk Ki, Fighter Action Surge/Second Wind, Druid Wild Shape.
*   **Long Rest (8 hours):** Full HP recovery. Regain half of max Hit Dice. Refreshes all Spell Slots and Long Rest abilities. Reduces Exhaustion by 1 level.

### 5.6 Saving Throws & DCs
*   **Mechanic:** d20 + Ability Mod + Proficiency (if proficient) vs Difficulty Class (DC).
*   **DC Calculation:**
    *   Spell Save DC = 8 + Proficiency + Casting Mod.
    *   Environment DC = Set by Rulekeeper (Easy 10, Medium 15, Hard 20).
*   **Usage:** Used to resist poisons, spells, traps, and hazards.

### 5.7 Combat Mechanics & Conditions
*   **Armor Class (AC):** 10 + DEX Mod (Unarmored). Armor replaces this base calculation (see Compendium). Shield adds +2.
*   **Proficiency:** Bonus applies to Attack Rolls, Saving Throws, and Skills where proficient.
*   **Conditions:**
    *   **Blinded:** Disadv on attacks, Enemy has Adv. Fail vision checks.
    *   **Charmed:** Can't attack charmer. Charmer has Adv on social checks.
    *   **Deafened:** Fail hearing checks.
    *   **Frightened:** Disadv on checks/attacks while source visible. Can't move closer.
    *   **Grappled:** Speed 0.
    *   **Incapacitated:** No Actions/Reactions.
    *   **Invisible:** Adv on attacks, Enemy has Disadv. Heavy Obscured.
    *   **Paralyzed:** Incapacitated. Auto-fail STR/DEX saves. Enemy attacks within 5ft are Crits.
    *   **Petrified:** Incapacitated. Resistance to all dmg.
    *   **Poisoned:** Disadv on attacks/checks.
    *   **Prone:** Crawler only. Disadv on attacks. Enemy has Adv within 5ft, Disadv > 5ft.
    *   **Restrained:** Speed 0. Disadv on attacks. Enemy has Adv. Disadv on DEX saves.
    *   **Stunned:** Incapacitated. Fails STR/DEX saves. Enemy has Adv.
    *   **Unconscious:** Incapacitated. Drops objects. Prone. Fails STR/DEX saves. Enemy within 5ft Crit.

### 5.4 Procedural Modifier Injection

When the LLM generates a narrative item (e.g., "A rusty sword"), the Engine processes it before updating the inventory:

Detection: Engine scans narrative_output for Item Keywords + Adjectives.

Lookup: Engine finds "Sword" in compendium.json.

Modification: Engine calculates the modifier based on the adjective (see 8.5) and creates a unique instance_id.

Final State: The item is saved to characters.json with its specific math, e.g., Sword (Rusty): 1d8-2.

## 6. Implementation Roadmap for Coding

### Phase 1: The Foundation (Data & State)

Create the file structure (data/, src/, logs/).

Implement GameStateManager.py: Functions to Load/Save all JSON schemas.

Implement RulesEngine.py: Functions for XP calculation and Dice Rolling (no LLM yet).

### Phase 2: The Interface (UI)

Build the Streamlit layout.

Left Column: Chat History.

Right Column: Tabs for Character Sheet, Inventory, Map Info.

Bottom: Input Field.

### Phase 3: The Brain (LLM Integration)

Implement AgentInterface.py.

Connect to OpenAI/Anthropic.

Create the "System Prompt" templates for the Narrator and NPC personas.

### Phase 4: The Loop (Game Flow)

Connect UI input -> Logic Layer -> Agent Layer -> UI Output.

Implement the "Intent Router" (Is this a roll or just talk?).

### Phase 5: Advanced Features

Implement MapGenerator.py (Procedural Hex creation).

Implement TheScribe.py (Summarizer).

Implement MultiplayerSync (Turn management).

## 7. Sample System Prompts (For Reference)

### 7.1 Narrator System Prompt:

"You are the Game Master of a high-fantasy RPG. Your goal is to describe the world vividly but concisely. IMPORTANT: You do not decide the outcome of actions. The System will tell you if an action Succeeded or Failed. You only describe how it happened. CONTEXT: The party is in [HEX_NAME]. PLAYERS: [LIST_OF_NAMES]. INPUT: [Player said: 'I hit him'] [System Result: Success, 12 dmg, Enemy Died]. RESPONSE: Describe the lethal blow."

### 7.2 NPC System Prompt:

"You are acting as [NPC_NAME]. Your personality is [TRAITS]. You are currently traveling with [PLAYER_NAMES]. Respond to the current situation as your character would. Keep it under 50 words unless monologuing."


### 7.3 Director: Smart XP & Item Evaluator

"You are the Director. Your task is to review the last turn.
If the player was exceptionally clever or stayed in character, output {"type": "XP_GAIN", "amount": 25, "reason": "Roleplay"}.
If the player finds loot, choose an archetype from the Compendium and apply an adjective (e.g., 'Rusty', 'Fine', 'Mythic'). Do not calculate the math; just provide the name."

## 8. Technical Logic Supplements

### 8.1 The Internal Communication Protocol (ICP)

Every LLM call to the Narrator must return a structured JSON object to ensure the Python Engine can update the state accurately.

Format:

```json
{
  "narrative_output": "The text the player sees.",
  "engine_calls": [
    { "function": "add_xp", "args": {"amount": 50, "reason": "clever_dialogue"} },
    { "function": "set_condition", "args": {"target": "player_1", "condition": "exhausted"} }
  ],
  "world_updates": {
    "hex_discovery": null, 
    "poi_unlocked": "poi_01"
  }
}
```


### 8.2 Attribute Resolution Order

To prevent "hallucinated stats," the Engine must follow this calculation order before the LLM is even called:

Base Stat (from character.json)

Item Modifiers (sum of all equipped: true items)

Active Status Effects (modifiers list in character.json)

Final Value -> Passed to LLM as "The Truth."

### 8.3 NPC Slot Management

The "Buddy" Logic: NPCs are stored in characters.json with player_type: "NPC".

Dynamic Context: The engine only sends NPC profiles to the LLM for characters marked is_active: true.

Promotion: If a human player joins, an NPC can be toggled to is_active: false (stays at camp) or "Promoted" to player_type: "HUMAN".

### 8.4 Map Adjacency Logic (The Hex Rule)

The Engine (not the LLM) calculates coordinates.

A move "North" from (0,0) results in (0,1).

If (0,1) does not exist in map_registry.json, the Engine initiates the MapGenerator.py routine.

The LLM is given the Biome of the current hex and must generate a "logical neighbor" (e.g., a "Deep Forest" next to a "Forest," not a "Volcano" next to a "Tundra").

### 8.5 Adjective-to-Modifier Resolution Table

To ensure deterministic math, adjectives generated by the LLM are mapped to fixed integers in the Rules Engine:

Mythic / Godly: +3 to Dice Result.

Magical (+1): +1 to hit/dmg.

Standard: +0.

Rusty / Poor: -1 to hit/dmg.

Broken: -3 to hit/dmg (Crit fail destroys item).

### 8.6 Damage Type Interaction

The Engine handles damage calculation based on Compendium types:
Physical: Slashing, Piercing, Bludgeoning.
Elemental: Fire, Cold, Lightning, Acid, Thunder.
Exotic: Force, Poison, Psychic.
Divine: Radiant, Necrotic.

Note: If a player uses a 'Fireball' (Evocation) against a 'Fire Elemental', the Engine (not the LLM) overrides the damage to 0 (Immunity).

## 9. Standard Fantasy Content Seed

### 9.1 Default Races
Human, Elf (High/Wood/Drow), Dwarf (Hill/Mountain), Halfling (Lightfoot/Stout), Gnome (Forest/Rock), Half-Elf, Half-Orc, Tiefling, Dragonborn.

### 9.2 Magic & Spell Schools
The system supports the 8 standard schools:
Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation.