# Terminal CLI Implementation Plan
**Status:** Pending Approval
**Goal:** 100% gameplay through terminal — full parity with browser UI minus visuals

---

## Why

The RPG Lore Engine has 21+ game engines and 930+ data files but can only be played in a browser. This blocks:
- **LLM-driven testing** — Claude cannot interact with the game to verify mechanics
- **Automated regression testing** — no test harness exists
- **Headless operation** — no CI/CD game simulation possible

The core `GameLoop.processTurn(input) → string` is already text-in/text-out. We just need to wire it to a terminal.

---

## Architecture

```
┌───────────────────────────────────────────────┐
│              cli/repl.ts (REPL)               │
│   readline loop → processTurn() → render      │
├───────────────────────────────────────────────┤
│           cli/renderer/ (Text Output)         │
│   Character · Location · Inventory · Quests   │
│   Map (ASCII hex) · Combat (ASCII grid)       │
├───────────────────────────────────────────────┤
│           cli/bootstrap.ts (Node.js shim)     │
│   DataManagerCLI (fs-based data loading)      │
│   localStorage shim · path resolution         │
├───────────────────────────────────────────────┤
│        Existing Engine (UNCHANGED)            │
│   GameLoop · IntentRouter · All 21 engines    │
│   CharacterFactory · GameStateManager         │
│   FileStorageProvider (already Node.js)       │
└───────────────────────────────────────────────┘
```

**Zero modifications to existing engine files.** The CLI is purely additive.

**Critical blocker solved:** `DataManager` uses Vite's `import.meta.glob()`. We bypass this by monkey-patching the static fields at startup with `fs`-loaded data.

---

## Phase 1: Foundation — Node.js Data Loading
**Deliverables:** `cli/bootstrap.ts`, `cli/DataManagerCLI.ts`
**Test:** `npx tsx cli/tests/test_phase1_data_loading.ts`

| What | Details |
|------|---------|
| `DataManagerCLI.ts` | Reads all JSON from `data/` via `fs.readdirSync` + `JSON.parse`. Patches `DataManager` private statics with same key normalization as original (name, lowercase, underscore variants). |
| `bootstrap.ts` | `localStorage` shim on `globalThis` + calls `patchDataManagerForNode()`. Exports `bootstrapCLI(projectRoot)`. |
| Test verifies | 13 races, 12 classes, 6 backgrounds, 255 items, 319 spells, 325 monsters, biome mapping all load correctly with lookup functions working |

**Success:** All data loads. `DataManager.getItem('Dagger')`, `DataManager.getSpell('Magic Missile')`, `DataManager.getMonster('Goblin')` all return correct objects.

---

## Phase 2: Character Creation CLI
**Deliverables:** `cli/creation.ts`
**Test:** `npx tsx cli/tests/test_phase2_creation.ts`

| What | Details |
|------|---------|
| Interactive wizard | `node:readline/promises` — Name → Sex → Race (numbered list) → Class → Background → Point-buy abilities (27 pts, 8-15) → Skills → Cantrips/Spells (casters) → Confirm |
| Engine call | `CharacterFactory.createNewGameState(options)` — produces full `GameState` with starting hex, tutorial quest, inventory |
| Persistence | Saves via `GameStateManager` + `FileStorageProvider` |
| Test verifies | All 12 classes create valid states; background equipment resolves; caster spells populated; save/load round-trip; schema validation passes |

**Success:** `npx tsx cli/creation.ts` walks through character creation and produces a playable save file.

---

## Phase 3: Core Game Loop REPL
**Deliverables:** `cli/repl.ts`, `cli/CLIConfig.ts`
**Test:** `npx tsx cli/tests/test_phase3_repl.ts`

| What | Details |
|------|---------|
| Main menu | `[1] New Game  [2] Load Game  [3] Quit` |
| REPL loop | Mode-aware prompt (`[EXPLORATION] >`) → `processTurn()` → print response |
| CLI commands | `/save`, `/quit`, `/status`, `/help` (handled before engine) |
| Auto-save | Every 10 turns (configurable) |
| Test verifies | `/look` returns text, `/move N` changes coordinates, `/wait 30` advances time, `/pace Stealth` changes pace, `/rest long` restores HP, save/load works |

**Success:** Full exploration gameplay loop works — move, look, rest, wait, pace changes.

---

## Phase 4: State Renderer
**Deliverables:** `cli/renderer/` (6 files)
**Test:** `npx tsx cli/tests/test_phase4_renderer.ts`

| Renderer | Output Example |
|----------|---------------|
| **CharacterRenderer** | `Thorn [Lv3 Human Fighter] HP [########--] 24/30  AC 16` + ability grid + conditions |
| **LocationRenderer** | `Plains — Initial Landing Site  Day 1, 09:00 (Hammer, 1489)  Weather: Clear` |
| **InventoryRenderer** | Gold display + item table with Qty/Wt/Equipped + weight capacity |
| **QuestRenderer** | `The First Step [ACTIVE]  [X] Move to a neighboring hex (1/1)  [ ] Master the Booklet (2/5)` |
| **MapRenderer** | ASCII hex grid: `Pl` Plains, `Fo` Forest, `??` unvisited, `@` player |
| **StateRenderer** | Compact one-liner after each turn + full `/status` command |

**REPL update:** Adds `/status`, `/map`, `/inventory`, `/quests` commands. Shows compact status after every turn.

---

## Phase 5: Combat Interface
**Deliverables:** `cli/renderer/CombatRenderer.ts`, `cli/combat.ts`
**Test:** `npx tsx cli/tests/test_phase5_combat.ts`

| What | Details |
|------|---------|
| Initiative display | Ordered combatant list: `> Thorn [24/30 HP, AC 16]  Goblin A [7/7 HP, AC 13]` |
| ASCII grid | `@` player, `1-9` enemies, `#` walls, `T` trees, `.` open — with coordinate headers |
| Tactical options | Numbered list from `getTacticalOptions()` — type `1` to execute first option |
| Combat log | Last N entries with hit/miss/damage |
| Test verifies | `/combat Goblin 2` starts combat, grid renders, attack produces result, enemy AI takes turns, combat resolves to EXPLORATION |

**REPL update:** Auto-displays grid + tactical options when in COMBAT mode. Numbered input maps to option commands.

---

## Phase 6: Advanced Systems
**Deliverables:** `cli/systems/` (6 handlers) + `cli/renderer/TradeRenderer.ts`
**Test:** `npx tsx cli/tests/test_phase6_systems.ts`

| System | Commands | Test |
|--------|----------|------|
| **Trading** | `/trade`, `/buy`, `/sell`, `/haggle`, `/intimidate`, `/deceive`, `/closetrade` | Open/close trade, verify state |
| **Dialogue** | Free text when `activeDialogueNpcId` set, `/endtalk` | Detect dialogue mode |
| **Rest** | Enhanced display for `/rest short`, `/rest long` | HP restore to max |
| **Save/Load** | `/saves`, `/save [name]`, `/load`, `/delete` | Round-trip integrity |
| **Spells** | `/spells`, `/prepare`, `/unprepare` | List spells for Wizard |
| **Equipment** | `/equip`, `/unequip`, `/paperdoll` | Equip weapon, verify slot |

---

## Phase 7: Automated Test Harness
**Deliverables:** `cli/harness/` (4 files)
**Run:** `npx tsx cli/harness/harness.ts`

| Scenario | Steps | Assertions |
|----------|-------|------------|
| ALL_CLASSES_CREATION | Create 12 characters | All valid GameStates |
| FULL_EXPLORATION | Move 3 dirs, look, wait, rest | Coordinates change, time advances, HP restores |
| COMBAT_TO_COMPLETION | Start combat, fight 20 rounds max | Combat resolves, mode returns to EXPLORATION |
| TRADE_FLOW | Inject merchant, open/close trade | State transitions correct |
| SAVE_LOAD_INTEGRITY | Save, modify, load | State reverts |

**Output:** `5/5 scenarios passed (42.3s)` with per-step details on failure.

---

## File Tree
```
cli/
├── bootstrap.ts                     # Phase 1 — Node.js shim + data loading
├── DataManagerCLI.ts                # Phase 1 — fs-based data loader
├── CLIConfig.ts                     # Phase 3 — auto-save interval, etc.
├── creation.ts                      # Phase 2 — interactive character wizard
├── repl.ts                          # Phase 3 — main REPL (updated in 4/5/6)
├── combat.ts                        # Phase 5 — combat input mapping
├── renderer/
│   ├── StateRenderer.ts             # Phase 4 — compact + full view composer
│   ├── CharacterRenderer.ts         # Phase 4 — HP bar, stats, conditions
│   ├── LocationRenderer.ts          # Phase 4 — hex info, time, weather
│   ├── InventoryRenderer.ts         # Phase 4 — items, gold, weight
│   ├── QuestRenderer.ts             # Phase 4 — objectives with progress
│   ├── MapRenderer.ts               # Phase 4 — ASCII hex grid
│   ├── CombatRenderer.ts            # Phase 5 — initiative, grid, options
│   └── TradeRenderer.ts             # Phase 6 — merchant inventory
├── systems/
│   ├── TradeHandler.ts              # Phase 6
│   ├── DialogueHandler.ts           # Phase 6
│   ├── RestHandler.ts               # Phase 6
│   ├── SaveLoadHandler.ts           # Phase 6
│   ├── SpellHandler.ts              # Phase 6
│   └── EquipmentHandler.ts          # Phase 6
├── harness/
│   ├── StateAssertions.ts           # Phase 7 — deep path + operators
│   ├── ScriptRunner.ts              # Phase 7 — scenario executor
│   ├── TestScripts.ts              # Phase 7 — 5 pre-built scenarios
│   └── harness.ts                   # Phase 7 — main runner
└── tests/
    ├── test_phase1_data_loading.ts
    ├── test_phase2_creation.ts
    ├── test_phase3_repl.ts
    ├── test_phase4_renderer.ts
    ├── test_phase5_combat.ts
    ├── test_phase6_systems.ts
    └── test_phase7_harness.ts
```

## Workflow Per Phase
1. I implement the phase
2. I run `npx tsx cli/tests/test_phaseN_*.ts`
3. I write a short report: what passed, what failed, what was fixed
4. You confirm before I proceed to the next phase

---

*Total estimated new files: ~27. Total existing files modified: 0.*
