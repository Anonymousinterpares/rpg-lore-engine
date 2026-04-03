# Agentic Workflows Overview — RPG Lore Engine

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLAYER INPUT                             │
│                    (React UI / PlayerInputField)                │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTENT ROUTER                                │
│              IntentRouter.parse(input, inCombat)                │
│     ┌────────────┬───────────────┬──────────────┐              │
│     ▼            ▼               ▼              │              │
│  COMMAND    COMBAT_ACTION    NARRATIVE           │              │
└──┬───────────┬───────────────┬──────────────────┘              │
   ▼           ▼               ▼                                  
┌──────┐  ┌──────────┐  ┌─────────────────────────────────────┐  
│handle│  │Combat    │  │        LLM AGENT SWARM              │  
│Cmd() │  │Orchestr. │  │  ┌──────────┐  ┌───────────────┐   │  
└──────┘  └──────────┘  │  │ DIRECTOR │→│   NARRATOR    │   │  
                        │  │(every 5t)│  │  (every turn) │   │  
                        │  └──────────┘  └───────┬───────┘   │  
                        │       ┌────────────────┤           │  
                        │       ▼                ▼           │  
                        │  ┌─────────┐   ┌──────────────┐   │  
                        │  │  NPC    │   │   ENGINE     │   │  
                        │  │CONTRLR  │   │  DISPATCHER  │   │  
                        │  └─────────┘   └──────────────┘   │  
                        └─────────────────────────────────────┘  
                                         │                       
                           ┌─────────────┼─────────────┐        
                           ▼             ▼             ▼        
                     ┌──────────┐ ┌───────────┐ ┌──────────┐   
                     │  LORE    │ │  PROFILE  │ │  STORY   │   
                     │  KEEPER  │ │ EXTRACTOR │ │  SCRIBE  │   
                     └──────────┘ └───────────┘ │(every 20)│   
                                                └──────────┘   
```

---

## 1. THE FOUR LLM AGENTS

| Agent | File | Trigger | Temperature | Tokens | Purpose |
|-------|------|---------|-------------|--------|---------|
| **NARRATOR** | `NarratorService.ts` | Every exploration turn | 0.8 | 1500 | Story text + engine calls |
| **DIRECTOR** | `DirectorService.ts` | Every 5 turns | 0.7 | 500 | Pacing directives |
| **NPC_CONTROLLER** | `NPCService.ts` | Dialogue + post-narration | 0.9 | 800 | NPC speech & chatter |
| **LORE_KEEPER** | `LoreService.ts` | First encounter of entity | 0.7 | 2000 | Codex lore entries |

All agents are configurable via `AgentConfig.json` + `AgentManager.ts`, supporting OpenAI, Anthropic, Gemini, and OpenRouter.

---

## 2. NARRATION WORKFLOW

**Entry:** `NarratorService.generate()` — called from `GameLoop.processTurn()` on every free-text exploration turn.

**Flow:**
1. `ContextBuilder.build(state, hexManager, history)` assembles context (player HP, location, biome, weather, season, time-of-day, nearby hexes, local NPCs, story summary)
2. `constructSystemPrompt()` injects mode-specific instructions + optional Director directive
3. `LLMClient.generateCompletion()` calls the configured LLM with JSON response format
4. Response parsed into `NarratorOutput` (Zod-validated):
   ```
   { narrative_output, engine_calls[], world_updates }
   ```
5. Engine calls dispatched; narrative displayed in UI

**Specialized narration methods:**
- `summarizeCombat(logs)` — dramatic 1-paragraph battle recap (<100 words)
- `narrateRestCompletion(duration, type)` — atmospheric time-passage description
- `narrateAmbush(encounter, restType)` — tense 3-5 sentence ambush description
- `generateSaveSummary(state)` — 2-3 sentence save-slot description (<50 words)
- Opening scene: special `__OPENING_SCENE__` input on turn 0
- Resume scene: `isFirstTurnAfterLoad` flag adds recap instructions

---

## 3. TOOL CALLS (Engine Calls)

The Narrator's JSON output includes `engine_calls[]` — structured commands the LLM emits to modify game state. Defined in `ICPSchemas.ts`, executed by `EngineDispatcher.ts`.

**18 available engine call functions:**

| Function | Effect |
|----------|--------|
| `add_xp` | Award experience |
| `modify_hp` | Heal or damage |
| `add_item` / `remove_item` | Inventory changes |
| `modify_gold` | Currency adjustment |
| `set_condition` | Apply status (poisoned, stunned...) |
| `skill_check` / `saving_throw` | Dice roll vs DC |
| `start_combat` / `end_combat` | Combat transitions |
| `trigger_trap` | Trap activation |
| `discover_poi` | Unlock point of interest |
| `update_quest` | Quest progress |
| `set_faction_standing` | Reputation change |
| `advance_time` | World clock forward |
| `spawn_npc` | Create NPC at location |
| `set_npc_disposition` | Change NPC attitude |
| `level_up` | Character advancement |
| `turn_end` | No-op signal |

**Safety:** Each call is try-catch wrapped; failures log but don't crash. All inputs validated against Zod enum.

---

## 4. MEMORY SYSTEMS

### 4a. Conversation History
- **Where:** `GameState.conversationHistory[]` + `HistoryManager` (rolling 20-turn buffer)
- **What:** `{ role: player|narrator|system, content, turnNumber }`
- **Used by:** ContextBuilder feeds last 10 turns to Narrator prompt

### 4b. Story Summary (Context Compression)
- **Where:** `GameState.storySummary`
- **Engine:** `StoryScribe.ts` — runs every 20 turns
- **How:** LLM call (temp 0.3, 500 tokens) summarizes recent history into 1-2 paragraph condensed narrative
- **Used by:** Narrator system prompt, save summaries

### 4c. NPC Memory
- **Per-NPC conversation history:** `WorldNPC.conversationHistory[]` (speaker + text + timestamp)
- **Per-NPC relationship:** `WorldNPC.relationship.standing` (-100 to +100)
- **Profile evolution:** `ProfileExtractor.mergeNpcProfile()` — LLM (temp 0.1) extracts facts from narrative and merges into structured NPC profile (appearance, personality, background, occupation, relationships, quotes)
- **Stored in:** `codexEntries[]` with category `npcs`

### 4d. Entity Knowledge
- **Where:** `character.knownEntities.monsters[]` and `character.knownEntities.items[]`
- **Trigger:** First encounter → `LoreService.registerMonsterEncounter()` / `registerItemDiscovery()`
- **Result:** LLM-generated codex entry stored in `codexEntries[]`, marked `isNew` for UI notification

### 4e. Character Chronicles
- **Where:** `character.biography.chronicles[]` — `{ turn, event }` event markers
- **Purpose:** Long-term character history tracking

---

## 5. SAVING & LOADING

**Orchestrator:** `GameStateManager.ts` with pluggable `IStorageProvider`

| Provider | File | Environment |
|----------|------|-------------|
| `FileStorageProvider` | `FileStorageProvider.ts` | Node.js / server |
| `BrowserStorageProvider` | `BrowserStorageProvider.ts` | localStorage fallback |
| `NetworkStorageProvider` | `NetworkStorageProvider.ts` | Browser → Express API |

**Save flow:**
1. `GameStateManager.saveGame(state, slotName, narrativeSummary, thumbnail)`
2. Full state serialized to `{saveId}.json`
3. Metadata written to `save_registry.json`:
   ```
   { id, slotName, characterName, level, class, lastSaved, playTime,
     locationSummary, narrativeSummary, thumbnail }
   ```
4. `NarratorService.generateSaveSummary()` provides the narrative summary

**Load flow:**
1. `GameStateManager.loadGame(saveId)` reads JSON
2. Validates against `FullSaveStateSchema` (Zod)
3. Auto-migrates spell slots if missing
4. `NarratorService.isFirstTurnAfterLoad = true` triggers recap on next turn

**Save state includes:** Character, world map, NPCs, quests, factions, combat state, conversation history, story summary, codex entries, notifications, settings, world time/weather.

---

## 6. DIRECTOR (PACING) WORKFLOW

**Entry:** `DirectorService.evaluatePacing(state)` — every 5 turns

**Analyzes:** game mode, turns elapsed, HP status, active quests, and suggests one of:

| Directive Type | Purpose |
|----------------|---------|
| `PACING_EVENT` | Inject atmospheric/dramatic event |
| `XP_GAIN` | Award XP for achievement |
| `ITEM_EVAL` | Suggest checking found items |
| `SURPRISE_CHECK` | Trigger perception check |

The directive is injected into the Narrator's system prompt on the next turn, influencing the story naturally.

---

## 7. COMPLETE TURN LIFECYCLE

```
1. Player types input
2. IntentRouter classifies intent
3. If DIALOGUE mode → NPCService.generateDialogue() → done
4. If COMMAND → handleCommand() (mechanical) → done
5. If COMBAT → CombatOrchestrator.handleCombatAction() → done
6. If NARRATIVE (exploration):
   a. DirectorService.evaluatePacing()        [every 5 turns]
   b. NarratorService.generate()              [LLM call → JSON]
   c. NPCService.generateChatter()            [optional companion line]
   d. EngineDispatcher.dispatch(engine_calls)  [state mutations]
   e. ProfileExtractor.mergeNpcProfile()       [NPC knowledge update]
   f. unlockLoreCategories()                   [auto-discover codex]
   g. conversationHistory.push()               [memory]
   h. TimeManager.advanceTime(5 min)           [clock + encounter check]
   i. questEngine.checkDeadlines()             [quest deadlines]
   j. StoryScribe.processTurn()               [summary every 20 turns]
7. emitStateUpdate() → React re-renders
```

---

## 8. ERROR HANDLING & RESILIENCE

| Layer | Strategy |
|-------|----------|
| **JSON parsing** | Try parse → regex extract `narrative_output` → salvage raw text → fallback error message |
| **Engine dispatch** | Per-call try-catch; failures logged, game continues |
| **LLM timeout** | 30s safety timeout in `useGameState` hook |
| **Provider unavailable** | Graceful null return; no crash |
| **Schema validation** | Zod `safeParse`; partial data salvaged when possible |

---

## 9. KEY FILES QUICK REFERENCE

| System | Key File |
|--------|----------|
| Central orchestrator | `src/ruleset/combat/GameLoop.ts` |
| LLM transport | `src/ruleset/combat/LLMClient.ts` |
| Narrator agent | `src/ruleset/agents/NarratorService.ts` |
| Director agent | `src/ruleset/agents/DirectorService.ts` |
| NPC agent | `src/ruleset/agents/NPCService.ts` |
| Lore agent | `src/ruleset/agents/LoreService.ts` |
| Tool execution | `src/ruleset/agents/EngineDispatcher.ts` |
| Tool schemas | `src/ruleset/agents/ICPSchemas.ts` |
| Context assembly | `src/ruleset/agents/ContextBuilder.ts` |
| NPC profile merging | `src/ruleset/agents/ProfileExtractor.ts` |
| Story compression | `src/ruleset/combat/StoryScribe.ts` |
| Save/load | `src/ruleset/combat/GameStateManager.ts` |
| Agent config | `src/ruleset/agents/AgentManager.ts` |
| Intent parsing | `src/ruleset/combat/IntentRouter.ts` |
| Event bus | `src/ruleset/combat/managers/EventBusManager.ts` |
| Save state schema | `src/ruleset/schemas/FullSaveStateSchema.ts` |
