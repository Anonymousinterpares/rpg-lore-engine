  1. Context Management Per Agent

  ┌─────────────────────┬────────────────────┬─────────────────────────────────────────────────────┬──────┬────────┐
  │        Agent        │   History Window   │                   Context Fields                    │ Temp │ Tokens │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │                     │ Last 5 turns (from │ Player stats, location, biome, weather, season,     │      │        │
  │ NARRATOR            │  20-turn buffer)   │ time-of-day, hex neighbors (D1+D2), local NPCs,     │ 0.8  │ 1500   │
  │                     │                    │ story summary, director directive, encounter data   │      │        │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │ DIRECTOR            │ None               │ Only metrics: mode, total turns, HP ratio, quest    │ 0.7  │ 500    │
  │                     │                    │ count                                               │      │        │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │ NPC_CONTROLLER      │ Last 5             │                                                     │      │        │
  │ (dialogue)          │ NPC-specific       │ NPC traits, relationship standing, merchant flag    │ 0.8  │ 800    │
  │                     │ exchanges          │                                                     │      │        │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │ NPC_CONTROLLER      │ Last 3             │                                                     │      │        │
  │ (chatter)           │ NPC-specific       │ NPC traits, location name, mode, player HP          │ 0.8  │ 800    │
  │                     │ exchanges          │                                                     │      │        │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │ LORE_KEEPER         │ None               │ Only the entity being documented (name + data)      │ 0.7  │ 2000   │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │ PROFILE_EXTRACTOR   │ None               │ New narrative text + existing NPC profile JSON      │ 0.1  │ 800    │
  ├─────────────────────┼────────────────────┼─────────────────────────────────────────────────────┼──────┼────────┤
  │ STORY_SCRIBE        │ All available (no  │ Full history + previous summary                     │ 0.3  │ 500    │
  │                     │ trim)              │                                                     │      │        │
  └─────────────────────┴────────────────────┴─────────────────────────────────────────────────────┴──────┴────────┘

  Key observations:
  - Narrator is the richest context consumer but aggressively trims to 5 turns from a 20-turn rolling buffer
  (HistoryManager)
  - Director sees zero narrative — only game metrics. Its output is injected as a text directive into the Narrator's
  next prompt
  - NPC dialogue is completely isolated per-NPC. Each NPC has its own conversationHistory[] on the WorldNPC object —
  NPCs never know about each other's conversations
  - Profile Extractor uses temp 0.1 (near-deterministic) for factual precision
  - Story Scribe is the only agent that sees full untrimed history; it compresses it every 20 turns into
  state.storySummary, which then feeds back into Narrator context

  ---
  2. NPC Management

  Personality System

  - Static traits: 2-3 randomized from NPC_TRAITS registry at creation (NPCFactory.ts), stored as npc.traits[]. These
  never change.
  - Evolving profile: ProfileExtractor.mergeNpcProfile() uses LLM (temp 0.1) to extract facts from narrative text and
  merge into a structured npcProfile:
  { appearance, personality, background, occupation, relationships, notableQuotes[] }
  - Called after dialogue (GameLoop.ts:238) and after narrative generation when NPCs are present (GameLoop.ts:345)
  - Merge rules: only explicit facts, never delete unless contradicted, deduplicate, max 5 quotes

  Relationship Management

  Player-NPC: Implemented
  - npc.relationship.standing (-100 to +100) with full interactionLog[]
  - Modified by ShopEngine.updateRelationship() during trade interactions
  - Standing affects shop prices:
    ▎ = 75 (Exalted): 20% discount
    - 25-74 (Friendly): 10% discount
    - -24 to 24 (Neutral): no effect
    - -75 to -25 (Unfriendly): 30% markup
    - <= -75 (Hostile): 100% markup, shop closes
  - set_npc_disposition exists in ICP schema but is NOT implemented in EngineDispatcher — the Narrator can emit it but
  nothing happens
  - set_faction_standing IS implemented and modifies faction-level reputation

  NPC-NPC: Not implemented — no inter-NPC relationship tracking, no relationship graph, just flat player-facing standing
   numbers.

  Persistence

  Everything persists across saves: traits, profile, relationship (standing + interaction log), conversation history,
  shop state, movement behavior, stats, codex entries. All serialized via FullSaveStateSchema.

  Intent/Semantic Identification

  Structural only, not semantic. IntentRouter.ts does keyword matching:
  - /talk, /trade, /endtalk → COMMAND
  - Free text in dialogue mode → routes to NPCService.generateDialogue() as-is
  - No semantic parsing of player dialogue intent (trade request, threat, befriend, quest inquiry). The LLM handles
  interpretation implicitly but the engine doesn't classify it.

  ---
  3. Where & How Player Meets NPCs

  Spawning

  1. HexGenerator.generateHex() rolls against SPAWN_TABLES[biome].chance to spawn 0-1 NPCs per new hex
  2. NPC IDs stored in hex.npcs[], full NPC objects in state.worldNpcs[]
  3. ExplorationManager pushes spawned NPCs into world state when hex is discovered

  Discovery Flow

  Player moves to hex
    → GameLoop calls registerNpcEncounter() for each NPC in hex
    → Codex entry created (category: 'npcs')
    → Merchant inventory populated if applicable
    → Notification pushed ("New NPC Profile: [Name]")
    → LocationPanel in sidebar updates with NPC list

  UI Display

  - LocationPanel (Sidebar.tsx:58-68, LocationPanel.tsx:147-225) shows per-hex NPC cards with:
    - Name, Role, Faction
    - Relationship indicator (Allied/Friendly/Neutral/Wary/Hostile)
    - Talk and Trade buttons

  Interaction Commands

  - /talk [name] → sets activeDialogueNpcId, generates greeting via LLM, enters dialogue mode
  - In dialogue mode: all free text routes to NPCService.generateDialogue()
  - /endtalk or any /command exits dialogue
  - /trade [name] → sets activeTradeNpcId, opens shop commands (/buy, /sell, /haggle, /intimidate, /deceive, /buyback)

  NPC Movement

  5 behavior types in NPCMovementEngine.ts: STATIONARY, TRADE_ROUTE, PATROL, WANDER, HOSTILE. NPCs move between hexes on
   configurable intervals (e.g., 24 turns for merchants). Arrivals/departures from player's hex are narrated.

  ---
  4. Hiring / Convincing NPCs to Follow

  Current State: ~15-20% implemented (skeleton only)

  What EXISTS:
  - companions: PlayerCharacter[] array in FullSaveStateSchema.ts:43
  - Combat integration works — companions are added as combatants with type 'companion', roll initiative, take turns,
  HP/spell slots synced after combat (CombatManager.ts:53-61, CombatOrchestrator.ts:853-865)
  - Narrator mentions companions in party description (NarratorService.ts:257-260)

  What's COMPLETELY MISSING:

  ┌─────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┐
  │           Feature           │                                      Status                                       │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ /recruit or /hire command   │ Not implemented                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Persuasion/gold-based       │ Not implemented                                                                   │
  │ recruitment                 │                                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Quest reward → companion    │ Not implemented                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ inParty / following flag on │ Not in schema                                                                     │
  │  WorldNPC                   │                                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Companion movement with     │ Not implemented                                                                   │
  │ player                      │                                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ UI party panel / companion  │ Not built                                                                         │
  │ management                  │                                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Companion data in           │ Not passed to LLM                                                                 │
  │ ContextBuilder              │                                                                                   │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │                             │ Stub code only — generateChatter() tries to find companions via chronicle text    │
  │ Companion dialogue/chatter  │ parsing ("Joined party") but nothing ever creates those entries, so it always     │
  │                             │ returns null                                                                      │
  └─────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘

  What would be needed to make it work:

  1. Schema: Add recruited: boolean or similar flag to WorldNPC
  2. Command: /recruit [npc] handler in GameLoop with persuasion check + optional gold cost
  3. Conversion: Logic to create a PlayerCharacter from a WorldNPC (stats mapping, equipment, class assignment)
  4. Movement: Companion auto-follow when player moves hexes
  5. Context: ContextBuilder needs to pass companion data to Narrator
  6. Chatter: Fix NPCService.generateChatter() to actually find companions
  7. UI: Party panel showing companion HP, equipment, status
  8. Persistence: Already handled — companions array is in the save schema

  The combat side is ready; everything else from recruitment through exploration is missing.