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
| Drop/take equipped item from companion | `equipped` flag cleared, equipment slot cleared, AC recalculated; `reEvaluateEquipment()` promotes backup items |
| Quest XP awarded | `QuestEngine` calls `LevelingEngine.autoLevelCompanions()` — companions level if eligible |
| Narrative XP (EngineDispatcher `award_xp`) | `EngineDispatcher` calls `LevelingEngine.autoLevelCompanions()` — companions level if eligible |

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
pendingLevelUp?: {              // Set by autoLevelCompanions, cleared by UI after display
    oldLevel, newLevel,
    oldMaxHp, newMaxHp,
    oldAc, newAc,
    oldSpellSlots, newSpellSlots
}
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
| `give` | companionIndex, itemInstanceId | Give item from player to companion |
| `take` | companionIndex, itemInstanceId | Take item from companion (standing 20+ required) |
| `barter` | companionIndex, offerInstanceId, requestInstanceId | Swap items between player and companion (personality-driven acceptance) |

---

## Combat Integration

### Companion Combatant Type

Companions enter combat via `CombatFactory.fromPlayer(companion.character, id, 'companion')`:
- `type: 'companion'` (not `'player'`) — distinguishes from player in all combat logic
- `isPlayer: false` — companions are AI-controlled, not player-controlled
- Only following companions (`followState === 'following'`) enter combat; waiting companions stay at their hex

### Initiative Tracker UI

| Combatant Type | HP Bar Color | Cursor | Click Behavior |
|----------------|-------------|--------|----------------|
| Player | Green | Default | — |
| Companion/Ally | **Blue** | Context-menu | Right-click: order flyout |
| Enemy | Red | Pointer | Left-click: select as target |

- Enemy cards: GameTooltip "Left-click to target enemy"
- Ally cards: GameTooltip "Right-click to issue orders"
- Right-click on enemy/player: browser context menu suppressed (preventDefault)

### Friendly Fire Prevention

`CombatResolutionEngine.resolveAttack()` checks attacker vs target faction:
- Allies cannot attack allies, enemies cannot attack enemies
- Returns MISS with message: "X cannot attack Y — they are an ally!"
- Attack/Ranged buttons in CombatActionBar are **disabled** until an enemy target is selected

### Death Saves for Companions

- `applyCombatDamage()` triggers `DeathEngine.handleDowned()` for companions (not just player)
- Companions auto-roll death saves on their turn (player rolls manually via button)
- 3 failures = permanent death, companion removed from party
- 3 successes = stabilize (HP set to 1, Unconscious removed)
- Death check runs on both victory and flee sync paths

### Combat Memory

After combat ends (victory or flee), `recordCombatForCompanions()` appends:
- `biography.chronicles[]` — long-term biographical event: "Fought Goblin, Orc for 3 rounds and won."
- `meta.conversationHistory[]` — "[Battle memory] {narrative summary}" for dialogue awareness

Companions can reference shared battles in future dialogue via the enriched DialogueContext.

### Companion Auto-Leveling

Companion auto-leveling triggers from ALL XP paths, centralized via `LevelingEngine.autoLevelCompanions(playerLevel, companions)`:

| XP Source | Call Site |
|-----------|----------|
| Combat victory | `CombatOrchestrator` — after XP award |
| Quest completion | `QuestEngine` — after quest XP |
| Narrative XP | `EngineDispatcher` — after `award_xp` engine call |
| Level-up (exploration) | `GameLoop` — after player level-up check |

Companions level to `playerLevel - 1` (always one level behind the player). On level-up, `CompanionMeta.pendingLevelUp` is set with old/new stats (level, maxHp, AC, spell slots) so the UI can show a comparison badge.

---

## Starter Equipment

Companions receive role-based equipment at recruitment using the same item catalog and equipment system as the player.

### Role Equipment Sets

| Role | Main Hand | Off Hand | Armor | Extra Items |
|------|-----------|----------|-------|-------------|
| Guard/Fighter | Longsword | Shield | Chain Mail | — |
| Bandit/Scout | Shortsword | — | Leather Armor | Shortbow, Arrows |
| Hunter | Shortbow | — | Leather Armor | Shortsword, Arrows |
| Scholar | Quarterstaff | — | — | Component Pouch |
| Druid | Quarterstaff | — | Leather Armor | Herbalism Kit |
| Hermit (Cleric) | Mace | — | Leather Armor | Shield |
| Noble | Rapier | — | Leather Armor | — |
| Merchant | Dagger | — | — | Light Crossbow, Bolts |

### Item Key Corrections (Sprint B)

Item keys in `STARTER_EQUIPMENT` were corrected to match the actual data catalog:

| Corrected Key | Old (Broken) Key |
|---------------|-----------------|
| `leather` | `leather_armor` |
| `round_shield` | `shield` |
| `arrow` | `arrows_(20)` |
| `crossbow_light` | `crossbow,_light` |

### Equipment System

- Items added to `inventory.items[]` with unique `instanceId` (UUID)
- Equipped via `equipmentSlots.mainHand/offHand/armor = instanceId`
- AC calculated by `EquipmentEngine.recalculateAC()` — same system as player
- Weight/capacity rules apply: capacity = STR × 15 lbs
- `CombatFactory.calculatePlayerTactics()` reads equipped weapons for reach/range/damage

### Companion Attack Resolution

In `performAITurn()`, companions use a dedicated COMPANION branch (not monster data):
- Looks up equipped weapon via `equipmentSlots.mainHand` → `instanceId` → `DataManager.getItem()`
- Calculates stat modifier (STR or DEX for finesse/ranged)
- Adds proficiency bonus based on companion level
- Damage formula from weapon data (not hardcoded 1d4)

---

## Companion Spellcasting

### Spell Slot Assignment

On recruitment, caster companions receive spell slots via `buildSpellSlotsFromProgression()` — the same function used for player character creation in `LevelingEngine`.

### Known Spells by Class

| Class | Cantrips | Level 1 Spells | Level 2 Spells |
|-------|----------|----------------|----------------|
| Wizard | Fire Bolt, Mage Hand, Prestidigitation | Magic Missile, Shield, Mage Armor | Scorching Ray, Misty Step |
| Cleric | Sacred Flame, Guidance, Spare the Dying | Cure Wounds, Bless, Guiding Bolt | Spiritual Weapon, Hold Person |
| Druid | Produce Flame, Shillelagh, Guidance | Cure Wounds, Entangle, Thunderwave | Moonbeam, Barkskin |
| Warlock | Eldritch Blast, Minor Illusion | Hex | Hold Person, Misty Step |
| Bard | Vicious Mockery, Minor Illusion | Cure Wounds, Healing Word, Thunderwave | Hold Person, Shatter |
| Ranger | — | Cure Wounds, Hunter's Mark | Pass Without Trace |

### Spell Casting in Combat

CombatAI SUPPORT directive checks for healing spells and available spell slots:
- If wounded ally exists (below 50% HP) and companion has a `cure|heal|restore|mend` spell + slot → casts it
- Simplified resolution: consumes lowest available slot, heals 1d8 + WIS modifier
- If no healing needed or no slots, falls through to normal attack behavior

---

## Combat Tactical Directives

### Per-Companion Directives

Each companion can receive an individual tactical order stored in `CombatState.companionDirectives[companionId]`.

| Directive | AI Behavior |
|-----------|------------|
| **FOCUS** | Target the named enemy specifically, ignoring proximity |
| **AGGRESSIVE** | Target the weakest enemy (finish them off) |
| **DEFENSIVE** | Target enemies threatening the player. If below 30% HP: **Dodge** instead |
| **SUPPORT** | If wounded ally exists + has healing spell: **Cast heal**. Otherwise: attack normally |
| **PROTECT** | Target enemies nearest to the player (or named ally). "me"/"player" maps to player |

`CombatAI.decideAction()` reads per-companion directive first, falls back to global `partyDirective`.

### Right-Click Ally Context Menu

Right-clicking an ally card in the InitiativeTracker opens a styled flyout:

- **Focus Target** — uses the currently left-click-selected enemy. Shows enemy name if selected.
- **Protect Me** — companion prioritizes enemies threatening the player
- **Heal / Support** — companion heals wounded allies if able
- **Be Defensive** — companion guards player or dodges if low HP
- **Go Aggressive** — companion targets weakest enemy

A **directive badge** appears on the ally card (top-right) with colored icon:
- AGG = red flame, DEF = blue shield, SUP = green heart, FOC = red swords, PRT = purple shield-check

### Text Order Input

The text input field (right of End Turn button) accepts free-text orders:

**Global orders** (no names mentioned): apply to ALL companions
```
/directive both be defensive
/directive heal the party
/directive focus the orc
```

**Per-companion orders** (names mentioned): split and assigned individually
```
/directive Grimjaw be defensive, Lyra focus the orc
/directive Grimjaw protect me, Lyra heal
```

### Multi-NPC Order Resolution

1. Text scanned for companion first names, sorted by position
2. Text split into segments bounded by consecutive names
3. Each segment parsed independently via keyword matching
4. Unnamed companions get the global directive
5. Failed orders produce a random flavor message from `CombatNarrativePool`

### Combat Narrative Flavor Pools

`CombatNarrativePool.ts` provides varied messages for programmatic combat events (no LLM calls):

| Pool | Count | Example |
|------|-------|---------|
| Order failed | 10 | "The roar of battle drowned out Aldric's command before Grimjaw could hear it." |
| Order received | 5 | "Grimjaw nods sharply — understood." |
| Companion attacks (hit/miss) | 8 | "Grimjaw's weapon finds its mark on Goblin!" |
| Companion damaged | 4 | "Grimjaw grits their teeth as 8 damage lands!" |
| Companion dodges | 3 | "Grimjaw takes a defensive stance, ready to dodge." |
| Companion heals | 3 | "Lyra channels healing energy, restoring 6 HP to Aldric!" |
| Companion downed | 3 | "Grimjaw collapses, grievously wounded!" |
| Death save progress | 2 | "Grimjaw clings to life (1/3 successes, 2/3 failures)." |

---

## Rest Recovery

Companions receive the same rest benefits as the player:

| Rest Type | HP | Hit Dice | Spell Slots | Death Saves |
|-----------|----|----|-------------|-------------|
| **Long rest** (8h+) | Full recovery | All restored | All restored | Cleared |
| **Short rest** (<8h) | Auto-spend 1 hit die (avg + CON mod) | -1 spent | — | — |

Implemented in `GameLoop.completeRest()` — iterates all following companions and applies the same rules.

---

## Bartering System

**File:** `src/ruleset/combat/BarterEngine.ts`

### Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/give` | `/give <companion_index> <item_instanceId>` | Give an item to a companion (one-way transfer) |
| `/take` | `/take <companion_index> <item_instanceId>` | Take an item from a companion (requires standing 20+) |
| `/barter` | `/barter <companion_index> <offer_id> <request_id>` | Swap items; companion evaluates trade fairness |

### Personality-Driven Valuation

`evaluateItemValue()` scores items 0-100 for each companion based on:

- **Class preference**: Each class has preferred item types (e.g., Fighter wants weapons/armor/shields; Wizard wants scrolls/wands/components)
- **Trait modifiers**: Greedy +10, Humble/Helpful -10, Suspicious -5
- **Rarity bonus**: Rare +15, Very Rare/Legendary +30, Common -10
- **Standing bonus**: `floor(companionStanding / 10)` added to offer value (0-10 bonus)

Trade accepted if effective offer value >= 70% of what the companion gives up.

### Auto-Equip for Companions

After receiving an item (via give or barter), `tryAutoEquip()` attempts to equip it:

- Only fills **empty** slots — never replaces existing equipment
- **Class validation**: Casters (Wizard, Sorcerer, Warlock, Druid) cannot auto-equip martial weapons
- **Heavy armor check**: Wizard, Sorcerer, Warlock, Monk, Rogue, Ranger, Bard cannot equip heavy armor
- **Two-handed checks**: Two-handed weapons require both mainHand and offHand to be free; equipping a shield checks if mainHand weapon is two-handed
- AC recalculated after any equipment change

### Re-Evaluate Equipment

`BarterEngine.reEvaluateEquipment(char)` runs after taking an item from a companion:
- Scans mainHand, armor, offHand slots
- If any slot became empty, promotes an unequipped inventory item of matching type
- Ensures companions always use the best available gear

### Weight / Capacity Limits

- **Weight capacity**: STR * 15 lbs
- **Slot limit**: 20 inventory slots per companion
- Both checked on `/give`; rejected with message if exceeded

---

## Unconscious / Dead Companion Handling

### Status Display

PartyPanel shows:
- **"☠ Unconscious"** in red when `hp.current <= 0`
- Talk button **disabled** with tooltip "Unconscious — cannot talk"
- ConversationManager blocks dialogue: "X is unconscious and cannot respond."

### Movement Restriction

Player **cannot move to another hex** while a following companion is unconscious:
- Message: "You cannot travel while X is unconscious. Heal them or dismiss them from the party first."
- Player must either heal (rest/spell) or `/dismiss_companion` the downed member

### Contextual Greetings

`ConversationManager.buildGreetingContext()` creates situational greetings based on:
- Recent combat (checks conversation history for battle keywords)
- Companion HP status ("badly wounded" / "took some hits")
- Time of day ("late at night — tired or reflective")
- Last narrative event (snippet of what just happened)
- Prior conversation summary
- Instructs LLM: "React to the situation, don't just say hello."

---

## Key Files

| File | Purpose |
|------|---------|
| `schemas/CompanionSchema.ts` | Companion data model, cost calculation, role/class mappings, desertion threshold |
| `schemas/ConversationSchema.ts` | Conversation state, talk modes, speech bubbles, chatter constants |
| `schemas/CombatSchema.ts` | CombatState with companionDirectives and partyDirective fields |
| `combat/CompanionManager.ts` | Recruitment, dismissal, NPC conversion, starter equipment, spellcasting setup |
| `combat/CombatAI.ts` | AI decision engine with directive support, parseDirective keyword parser |
| `combat/CombatNarrativePool.ts` | Flavor message pools for combat narration (no LLM) |
| `combat/BarterEngine.ts` | Personality-driven item exchange (give/take/barter), auto-equip with class validation |
| `combat/ai/CompanionStrategy.ts` | Base companion AI strategy interface |
| `combat/ai/MartialStrategy.ts` | AI strategy for martial companions (Fighter, Barbarian, Paladin) |
| `combat/ai/SupportStrategy.ts` | AI strategy for support companions (Cleric, Bard) |
| `combat/ai/CasterStrategy.ts` | AI strategy for caster companions (Wizard, Sorcerer, Warlock) |
| `combat/ai/StealthStrategy.ts` | AI strategy for stealth companions (Rogue, Ranger) |
| `combat/ai/StrategyRegistry.ts` | Maps companion class to appropriate strategy |
| `combat/CombatFactory.ts` | fromPlayer() with companion type support |
| `combat/CombatResolutionEngine.ts` | Friendly fire prevention |
| `combat/EquipmentEngine.ts` | Shared AC recalculation (used by player and companions) |
| `combat/LevelingEngine.ts` | buildSpellSlotsFromProgression (used by player and companions) |
| `combat/managers/CombatOrchestrator.ts` | performAITurn with COMPANION/DODGE/SPELL branches, death saves, combat memory |
| `combat/managers/ConversationManager.ts` | Dialogue orchestration, chatter, context building, contextual greetings |
| `agents/NPCService.ts` | LLM dialogue with DialogueContext enrichment |
| `agents/NarratorService.ts` | Narrator receives conversation summary + party context |
| `ui/components/combat/InitiativeTracker.tsx` | Ally/enemy cards with right-click directive menu, badges, tooltips |
| `ui/components/combat/CombatActionBar.tsx` | Text directive input, target-required offensive actions |
| `ui/components/character/PartyPanel.tsx` | Party UI with talk modes, bubbles, context menu, unconscious state |
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

### Bartering Commands

```
/give 0 <item_instanceId>                         -- Give item to companion at index 0
/take 1 <item_instanceId>                         -- Take item from companion at index 1 (standing 20+)
/barter 0 <your_item_id> <their_item_id>          -- Propose swap with companion 0
```

### Item Data Quality

55 items enriched in the data catalog with corrected weights, types, properties, and rarity values. Validated by `test_item_data_quality.ts`.

### Combat Directives

```
/directive focus the orc            -- All companions focus the orc
/directive be defensive             -- All companions play defensive
/directive heal                     -- All companions prioritize healing
/directive Grimjaw be defensive, Lyra focus the orc  -- Per-companion orders
/set_companion_directive companion_0 FOCUS Goblin    -- Direct ID-based directive (UI uses this)
```

Or use right-click on ally cards in the InitiativeTracker for click-based orders.

### Testing Combat with Companions

```
1. /recruit_test Guard              -- Get a Fighter companion with longsword + chain mail
2. /recruit_test Scholar            -- Get a Wizard companion with quarterstaff + spells
3. Explore until combat triggers
4. Verify: ally HP bars are BLUE, enemy HP bars are RED
5. Left-click an enemy to select target (Attack button activates)
6. Right-click an ally → order flyout appears
7. Set "Focus Target" on one ally, "Protect Me" on another
8. Verify: directive badges appear on ally cards (colored icons)
9. Type in text input: "Grimjaw be defensive, Lyra heal"
10. Observe: companions behave differently based on their orders
11. If companion drops to 0 HP: auto-rolls death saves on their turn
12. After combat: right-click companion → Relationship → conversation count increased
```

### Testing Rest Recovery

```
1. After combat, note companion HP values
2. Use the Rest button → Short Rest
3. Verify: companion HP increased (hit die spent)
4. Use the Rest button → Long Rest (8 hours)
5. Verify: companion HP at full, spell slots restored
```

### Testing Unconscious Companion

```
1. After combat where companion reached 0 HP
2. Companion card shows "☠ Unconscious" in red
3. Talk button is disabled
4. Try to move (/move N) → blocked with message
5. /dismiss_companion <name> → removes unconscious companion
6. Movement works again
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
# Companion recruitment, dismissal, party management (30 checks)
npx tsx src/ruleset/tests/test_companion_system.ts

# Conversation logic: history, modes, matching, edge cases (30 checks)
npx tsx src/ruleset/tests/test_conversation_logic.ts

# Combat: rest recovery, friendly fire, death saves, movement blocking (24 checks)
npx tsx src/ruleset/tests/test_combat_companion_fixes.ts

# Combat directives: parsing, AI behavior per directive type (28 checks)
npx tsx src/ruleset/tests/test_directive_combat_live.ts

# Equipment, spellcasting, directive integration (25 checks)
npx tsx src/ruleset/tests/test_combat_sprint2.ts

# NPC trait system: generation, contradictions, names (7 tests)
npx tsx src/ruleset/tests/test_npc_traits.ts

# Live LLM dialogue scenarios (requires OPENROUTER_API_KEY in .env)
npx tsx src/ruleset/tests/test_conversation_live.ts

# Live LLM multi-turn NPC dialogue differentiation
npx tsx src/ruleset/tests/test_npc_dialogue_integration.ts

# Sprint A: combat XP → auto-level, barter give/take/trade, equipped state consistency
npx tsx src/ruleset/tests/test_sprint_a_integration.ts

# Sprint B: item key corrections, starter equipment, data catalog validation
npx tsx src/ruleset/tests/test_sprint_b_integration.ts

# Sprint D: centralized auto-level from all XP paths, quest/narrative XP triggers
npx tsx src/ruleset/tests/test_sprint_d_integration.ts

# Item data quality: validates 55 enriched items (weights, types, properties)
npx tsx src/ruleset/tests/test_item_data_quality.ts
```
