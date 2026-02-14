# GameLoop Analysis & Audit

> [!NOTE]
> This document details the features, dependencies, and algorithm flows of the current `GameLoop.ts` to ensure 100% feature parity during refactoring.

## 1. Feature Registry
**Legend**: [C] Combat, [E] Exploration, [S] System, [N] Narrative

1.  **Orchestration**
    - [S] `initialize()`: Bootstraps HexMap, Factions, NPCs, and initial state sync.
    - [S] `processTurn(input)`: Main entry point. Routes `COMMAND` vs `COMBAT_ACTION`.
    - [S] `emitStateUpdate()`: Triggers autosave and notifies UI listeners.
    - [N] `applyNarratorEffects()`: Dispatches mechanical changes suggested by LLM.

2.  **Exploration & Movement**
    - [E] `expandHorizon(coords)`: Programmatic hex discovery (Distance 0, 1, and 2).
    - [E] `handleCommand('move')`: Directional movement (N, NE, etc.), weight check, and time cost.
    - [E] `handleCommand('look')`: Inspects current hex.
    - [E] `handleCommand('pace')`: Toggles travel pace.
    - [E] `seedCoastline()`: Procedural generation trigger.

3.  **Combat Mechanics**
    - [C] `initializeCombat(encounter)`: Sets up grid, combatants, initiative.
    - [C] `handleCommand('attack' / 'combat')`: Manual triggers for combat.
    - [C] `processCombatQueue()`: **THE CORE LOOP**. Orchestrates turn bands, AI delays, and action resets.
    - [C] `handleCombatAction(intent)`: Processes player tactical choices (Attack, Dodge, Hide, Use, Move).
    - [C] `performAITurn(actor)`: Simple AI logic (Move -> Attack).
    - [C] `checkCombatEnd()`: Win/Loss condition evaluation.
    - [C] `endCombat(victory)`: XP, Loot, Level Up, and State Transition.
    - [C] `getTacticalOptions()`: **Public API**. Returns context-aware combat actions for the UI.

4.  **Spellcasting & Abilities**
    - [C] `castSpell(name, target)`: Dedicated entry point for UI spellcasting.
    - [C] `handleCast()`: Combat logic (Targets, Range, Slots, Damage, Concentration).
    - [C] `handleExplorationCast()`: Out-of-combat utility (Heal, Summon).
    - [C] `useAbility()`: Feature usage (Action Surge, Second Wind).
    - [C] `executeSummon()`: Spawns new `summon` type combatants.

5.  **Inventory & Economy**
    - [E] `pickupItem()`: Weight checks, inventory addition.
    - [E] `dropItem()`: Inventory removal, location addition.
    - [E] `equipItem()`: Slot management and AC recalculation.
    - [C] `pickupCombatLoot()`: Post-combat looting logic.
    - [S] `handleCommand('item_add')`: Dev command for item spawning.

6.  **Time & World**
    - [S] `advanceTimeAndProcess()`: Advances clock, triggers Weather, checks Encounters.
    - [S] `completeRest()`: Short/Long rest logic + Ambush checks.
    - [S] `trackTutorialEvent()`: Updates tutorial quest objectives.
    - [N] `unlockLoreCategories()`: Scans narrative text for Codex keywords.

## 2. Dependency Graph

```mermaid
graph TD
    GameLoop --> IntentRouter
    GameLoop --> GameStateManager
    GameLoop --> HexMapManager
    GameLoop --> MovementEngine
    GameLoop --> CombatManager
    GameLoop --> StoryScribe
    GameLoop --> EncounterDirector
    GameLoop --> WorldClockEngine
    GameLoop --> WeatherEngine
    GameLoop --> MechanicsEngine
    GameLoop --> CombatResolutionEngine
    GameLoop --> CombatGridManager
    GameLoop --> DataManager
    GameLoop --> NarratorService
    GameLoop --> NPCService
    GameLoop --> CombatAnalysisEngine
```

## 3. Algorithm Flow: `processTurn`

```mermaid
flowchart TD
    A[UI Sends processTurn input] --> B{Mode == COMBAT?}
    B -- Yes --> C[IntentRouter.parse isCombat=true]
    B -- No --> D[IntentRouter.parse isCombat=false]

    C & D --> E{Intent Type}

    %% COMMAND PATH
    E -- COMMAND --> F[handleCommand]
    F --> F1{Command Type}
    F1 -- move --> F2[Movement / Tactical Move]
    F1 -- attack --> F3[initializeCombat]
    F1 -- rest --> F4[RestingEngine / advanceTime]
    F1 -- cast --> F5[castSpell]
    F1 -- item --> F6[equip/pickup/drop]
    F --> Z[Return System String]

    %% COMBAT ACTION PATH
    E -- COMBAT_ACTION --> G[handleCombatAction]
    G --> G1[Validate Turn & Resources]
    G1 --> G2{Action Type}
    G2 -- Attack --> G3[CombatResolutionEngine.resolveAttack]
    G2 -- Cast --> G4[handleCast]
    G2 -- Dodge/Hide --> G5[Apply Status Effect]
    G2 -- Move --> G6[CombatManager.moveCombatant]
    G --> G7[Log Action & Emit Update]
    G --> H{End Turn?}
    H -- Yes --> I[advanceCombatTurn -> processCombatQueue]
    H -- No --> Z

    %% AGENT PATH (Exploration Only)
    E -- NARRATIVE --> J[Director.checkEncounter]
    J -- Hit --> K[initializeCombat & Return]
    J -- Miss --> L[NarratorService.generate]
    L --> M[State Update & History Push]
    M --> N[applyNarratorEffects]
    N --> O[advanceTimeAndProcess]
    O --> P[Scribe.processTurn]
    P --> Z
```

## 4. Algorithm Flow: `processCombatQueue` (The "Hidden" Loop)

```mermaid
flowchart TD
    Start[processCombatQueue Called] --> Check{Combat Active & Not Processing?}
    Check -- No --> Exit
    Check -- Yes --> SetLock[Set turnProcessing = true]
    
    LoopStart{Loop: While Combat Active & Not Ended}
    SetLock --> LoopStart
    
    LoopStart -- Ended --> Cleanup[turnProcessing = false]
    LoopStart -- Active --> GetActor[Get Current Combatant]
    
    GetActor --> Reset[Reset Resources Action/Move]
    Reset --> Banner[Update Active Banner]
    Banner --> Ticks[processStartOfTurn Effects]
    Ticks --> IsPlayer{Is Player?}
    
    IsPlayer -- Yes --> Unlock[turnProcessing = false] --> Exit
    
    IsPlayer -- No --> Wait[Wait 2000ms AI Delay]
    Wait --> AI[performAITurn]
    AI --> Log[Add Logs & Narrative]
    Log --> Wait2[Wait 1000ms Pacing]
    Wait2 --> Advance[CombatManager.advanceTurn]
    Advance --> LoopStart
```
