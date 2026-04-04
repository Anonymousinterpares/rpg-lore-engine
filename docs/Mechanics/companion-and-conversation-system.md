# Companion & Conversation System

## Overview

The companion system allows NPCs to join the player's party, travel with them, fight alongside them in combat, and engage in multi-modal conversations. The conversation orchestration layer provides private, normal, and group talk modes with background inter-party dynamics.

---

## Companion Lifecycle

### Recruitment

NPCs can be recruited through dialogue when the player expresses intent. The LLM emits `recruit_companion` as an engine call, which is validated by a mechanistic gate:

| Gate Check | Requirement |
|------------|-------------|
| Standing | >= 10 (Friendly minimum) |
| Party size | < MAX_PARTY_SIZE (default 3) |
| Gold | Player must have enough GP |

**Gold cost formula:**
- Base cost by role: Guard/Mercenary 50gp, Merchant 100gp, Scholar/Druid 0gp, others 25gp
- Level premium: +10gp per NPC level above 1
- Standing discount: -10% per 10 standing above threshold; 50+ = half; 75+ = free
- Faction discount: -25% if player has good faction standing

**Files:** `CompanionSchema.ts` (cost calculation), `CompanionManager.ts` (recruitment logic), `EngineDispatcher.ts` (engine call handler)

### NPC-to-Companion Conversion

`CompanionManager.convertNpcToCompanion()` creates a `Companion` object:
- `character`: Full `PlayerCharacter` with class (mapped from role via `ROLE_CLASS_MAP`), HP, AC, stats (role-modified), equipment
- `meta`: Source NPC ID, original traits/role/faction, follow state, conversation history, companion standing

The original WorldNPC is removed from `state.worldNpcs` and all hex NPC lists.

### Dismissal

`CompanionManager.dismiss()` converts the companion back to a WorldNPC and places them at the current hex. Standing is preserved at minimum 25 (friendly).

### Desertion

If `companionStanding` drops below `DESERTION_THRESHOLD` (-30) through negative dialogue interactions, the companion automatically leaves the party. This triggers:
- Removal from active conversation
- Conversion back to WorldNPC at current hex
- Speech bubble: "I've had enough of this. I'm leaving."
- Narrative notification

**File:** `ConversationManager.applyRelationshipDelta()`

---

## Companion Following (Skyrim Model)

- `followState: 'following'` — companion is at the player's hex (implicit, no separate position tracking)
- `followState: 'waiting'` — companion stays at `waitHexId`
- Following companions auto-move when the player moves hexes
- Only following companions enter combat

Commands: `/companion_wait <name>`, `/companion_follow <name>`, `/dismiss_companion <name>`

---

## Combat Integration

- Companions enter combat via `CombatFactory.fromPlayer(companion.character, id, 'companion')`
- Type is set to `'companion'` (not `'player'`) with `isPlayer: false`
- Companions are AI-controlled using `CombatAI.decideAction()` — same AI as enemies but targeting enemies
- HP and spell slots sync back after combat (victory and flee)
- Death: companions roll death saves. 3 failures = permanent death, removed from party after combat

**Files:** `CombatManager.ts` (initialization), `CombatOrchestrator.ts` (HP sync), `CombatFactory.ts` (type fix)

---

## Conversation System

### ConversationManager

**File:** `src/ruleset/combat/managers/ConversationManager.ts`

Extracted from GameLoop (~134 lines removed). Centralizes all dialogue orchestration.

### Talk Modes

| Mode | Who Hears | Commentary | Eavesdrop |
|------|-----------|-----------|-----------|
| **PRIVATE** | Only player + primary NPC | No | Other companions roll passive Perception vs DC 12 (logged to debugLog, hidden from player) |
| **NORMAL** | All party members | 30% chance per exchange | N/A |
| **GROUP** | All participants | 70% chance per exchange | N/A |

### Talk Mode Flow

```
Player clicks Talk on companion card
  -> Dropdown: "Talk Normally" / "Talk Privately"
  -> ConversationManager.startTalk(npcId, mode)
  -> Narrator PAUSED (isInTalkMode() blocks narrator pipeline)
  -> TalkModeIndicator banner appears above NarrativeBox
  -> All player input routes to processDialogueInput()

Player clicks "End Talk" (or active Talk button again)
  -> ConversationManager.endTalk()
  -> LLM generates conversation summary
  -> Summary stored in conversationState.lastConversationSummary
  -> Narrator RESUMES with summary in context
```

### Adding Participants

`/add_to_conversation <name>` adds a companion to the active conversation:
- If mode was PRIVATE: auto-transitions to NORMAL with notification
- New participant receives conversation-so-far as context
- LLM generates a contextual join greeting from the new participant

### Discussion Orchestrator

Inside `processDialogueInput()`:

1. **Name matching** — `resolveNpcFromInput()` uses:
   - Exact first name match (punctuation-stripped)
   - Substring containment
   - Levenshtein distance <= 2 for typos
2. **Personality resonance** — `pickResponderByResonance()`:
   - Matches input keywords against `TRAIT_TOPIC_KEYWORDS` map
   - Scholar traits resonate with knowledge words, Guard with danger words, etc.
   - Local computation — no LLM call
3. **Routing priority**: explicit name > personality resonance > primary NPC

---

## LLM Context Enrichment

### NPCService.generateDialogue — DialogueContext

Every dialogue call receives an optional `DialogueContext` with:

| Field | What It Provides |
|-------|-----------------|
| `mode` | PRIVATE/NORMAL/GROUP — system prompt explains implications |
| `participants` | Names, roles, traits of others in this conversation |
| `partyMembers` | Full party roster (companions not in conversation) |
| `recentExchanges` | Last 5 messages from ALL participants (cross-participant awareness) |
| `backgroundKnowledge` | Summaries of private NPC-NPC conversations this NPC had |
| `priorConversationSummary` | Summary from last talk session |

### NarratorService — Post-Conversation Context

After `endTalk()`, the narrator's system prompt includes:
```
## RECENT PARTY CONVERSATION
The player just had a conversation: <summary>
Take this into account in your narrative.
```

This ensures the narrator knows what was discussed and can reference it in subsequent exploration narration.

### Conversation History Persistence

Companion dialogue history is stored in `CompanionMeta.conversationHistory[]` — a shared reference used by `resolveCompanionAsNpc()`. This means:
- NPCService pushes to the same array across multiple talk sessions
- History persists across saves (stored in CompanionSchema)
- Last 5 exchanges are included in the NPC's system prompt

---

## Background Chatter System

### Speech Bubbles

`tickBackgroundChatter()` runs at end of each exploration turn:

- Max 1 bubble per turn, NPC cooldown of `CHATTER_COOLDOWN_TURNS` (3)
- Selection weighted by personality: Gossip/Charismatic = 2x, Loner/Stoic = 0.3x
- Token budget: max `MAX_TURN_TOKEN_BUDGET` (800) per turn for all conversation activities
- Bubbles auto-dismiss after `SPEECH_BUBBLE_DURATION_MS` (8000ms)
- Player can manually close with X button

### Background NPC-NPC Conversations

- 15% chance per turn (`BACKGROUND_CONVO_CHANCE`)
- Two random companions exchange 2-3 lines (LLM-generated)
- Stored in `conversationState.backgroundConversations[]`
- NOT shown to the player
- When player talks to a participant: NPC's system prompt includes "You privately discussed X with Y" in `backgroundKnowledge`

---

## Edge Case Handling

| Scenario | Handling |
|----------|---------|
| Combat starts during talk | `forceEndTalk('interrupted by combat')` — synchronous cleanup, mechanical summary |
| Companion dismissed during talk | `removeParticipant(npcId)` — if primary, ends talk |
| All participants leave | `forceEndTalk('ended — participant left')` |
| Empty input | Returns "You stay silent." |
| Save during conversation | Full `ConversationState` persists in schema |
| Companion dies in combat | Removed from party; orphaned background conversations cleaned |
| Relationship deteriorates below -30 | Companion auto-leaves party (desertion) |

---

## UI Components

### PartyPanel (`src/ui/components/character/PartyPanel.tsx`)

Located in left sidebar between CharacterPanel and InventoryGrid.

- **Talk button**: Split dropdown (Normal/Private). Active state shows green glow, text changes to "End Talk"
- **Speech bubbles**: Positioned above companion card, multi-line with close button
- **Add to Conversation**: Appears when active conversation exists
- **Party Discussion**: Global button in header, triggers GROUP talk
- **Right-click context menu**: View Details / View Stats / Relationship
- **Tooltips**: All buttons use GameTooltip (app-styled, not native)

### TalkModeIndicator (`src/ui/components/narrative/TalkModeIndicator.tsx`)

Thin banner above NarrativeBox showing: NPC name, mode badge (Private/Open/Party Discussion), participant count, End Conversation button.

### MainViewport Integration

- TalkModeIndicator inserted above NarrativeBox
- PlayerInputField placeholder is talk-mode-aware:
  - PRIVATE: "Say something privately to {name}..."
  - NORMAL: "Say something to {name} (party can hear)..."
  - GROUP: "Address the party..."

---

## Data Model

### ConversationState (persisted in FullSaveStateSchema)

```
conversationState?: {
  activeConversation: ActiveConversation | null
  backgroundConversations: BackgroundConversation[]
  speechBubbles: SpeechBubble[]
  chatterCooldowns: Record<npcId, lastTurn>
  lastBackgroundChatterTurn: number
  lastConversationSummary: string
  tokenBudgetUsedThisTurn: number
}
```

### CompanionMeta Extensions

```
companionStanding: number       // -100 to 100, desertion at -30
conversationHistory: {speaker, text, timestamp}[]  // Persistent across sessions
```

### EventBus Events

- `CONVERSATION_START` — { npcId, mode, participants }
- `CONVERSATION_END` — { npcId, summary, durationTurns }
- `CONVERSATION_PARTICIPANT_ADDED` — { npcId, conversationPrimaryId }
- `SPEECH_BUBBLE` — { npcId, text, isInterParty }
- `BACKGROUND_CHATTER` — { participants, topic }

---

## Engine Calls

| Call | Args | Description |
|------|------|-------------|
| `recruit_companion` | npcId/npcName | Recruit NPC (gate-checked) |
| `dismiss_companion` | companionName/index, stayAtCurrentHex | Dismiss to world NPC |
| `companion_wait` | companionName | Set to wait at current hex |
| `companion_follow` | companionName | Resume following |

---

## Key Files

| File | Purpose |
|------|---------|
| `schemas/CompanionSchema.ts` | Companion data model, cost calculation, role mappings |
| `schemas/ConversationSchema.ts` | Conversation state, talk modes, speech bubbles, constants |
| `combat/CompanionManager.ts` | Recruitment, dismissal, NPC conversion |
| `combat/managers/ConversationManager.ts` | Dialogue orchestration, chatter, context building |
| `agents/NPCService.ts` | LLM dialogue with DialogueContext enrichment |
| `agents/NarratorService.ts` | Narrator receives conversation summary |
| `ui/components/character/PartyPanel.tsx` | Party UI with talk modes, bubbles, context menu |
| `ui/components/narrative/TalkModeIndicator.tsx` | Talk mode banner |

---

## Dev Commands Reference

All commands are typed into the player input field prefixed with `/`. These are for dev/LLM use — players interact via UI buttons.

### Quick Test Setup

```
/recruit_test Guard        -- Force-recruit a random Guard companion (free, standing 75)
/recruit_test Scholar      -- Force-recruit a random Scholar companion
/recruit_test Bandit       -- Force-recruit a random Bandit companion
/recruit_test              -- Force-recruit a random role companion
```

### Companion Management

```
/companion_wait Grimjaw       -- Grimjaw stays at current hex
/companion_follow Grimjaw     -- Grimjaw resumes following (must be at same hex)
/dismiss_companion Grimjaw    -- Dismiss Grimjaw from party (returns as world NPC)
```

### Conversation Commands

```
/talk Grimjaw                 -- Start NORMAL talk with Grimjaw (party hears)
/talk_private Grimjaw         -- Start PRIVATE talk (others don't hear)
/endtalk                      -- End current conversation (generates summary)
/group_talk                   -- Start group discussion with ALL following companions
/add_to_conversation Lyra     -- Add Lyra to the current conversation
```

### Typical Dev Test Flow

```
1. /recruit_test Guard          -- Get a Guard companion
2. /recruit_test Scholar        -- Get a Scholar companion
3. Click Talk on Guard          -- Dropdown appears: Normal / Private
4. Choose "Talk Normally"       -- Talk mode activates, green glow on card
5. Type: "What do you think about Lyra?"  -- Guard responds with party awareness
6. Click "+" on Scholar card    -- Scholar joins conversation with greeting
7. Type: "Lyra, any lore about this place?"  -- Lyra responds (name routing)
8. Click "End Talk" on Guard    -- Summary generated, narrator resumes
9. Right-click any companion    -- Context menu: Details / Stats / Relationship
```

### Testing Background Chatter

Background chatter triggers automatically during exploration turns. To see it:

```
1. /recruit_test Guard
2. /recruit_test Scholar
3. Type several exploration commands (e.g., "I look around", "I examine the area")
4. After 3+ turns, speech bubbles may appear on companion cards
5. Check browser console for "[ConversationManager] Background conversation:" logs
```

### Testing Desertion

```
1. /recruit_test Guard
2. /talk <guard_name>
3. Be extremely rude/hostile repeatedly (relationship delta accumulates)
4. If companionStanding drops below -30, companion auto-leaves
5. Check console for "[ConversationManager] ... has had enough and leaves the party!"
```

### Running Automated Tests

```bash
# Dry logic tests (no LLM, fast)
npx tsx src/ruleset/tests/test_conversation_logic.ts

# Live LLM scenario tests (requires OPENROUTER_API_KEY in .env)
npx tsx src/ruleset/tests/test_conversation_live.ts

# NPC trait system tests
npx tsx src/ruleset/tests/test_npc_traits.ts

# Companion recruitment/combat tests
npx tsx src/ruleset/tests/test_companion_system.ts
```
