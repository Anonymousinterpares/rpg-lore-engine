# RPG Lore Engine — Future Expansions & Improvement Backlog

## Remaining TODO Items

### High Priority

- [ ] **Skill proficiency assignment for companions** — Companions have empty `skillProficiencies[]`. Need class-based auto-assignment (e.g., Fighter gets Athletics, Rogue gets Stealth/Perception). Enables party skill checks where companion proficiency helps the group.

- [ ] **Inter-party NPC-NPC relationships (standing matrix)** — NPCs only have player-facing standing. No NPC-to-NPC opinions. Adding a relationship map between companions would enable: alliances, tensions, arguments during group talk, personality-driven conflicts.

### Medium Priority

- [ ] **Resurrection spells for dead companions** — Dead companions can only be dismissed. Resurrection spells (Revivify, Raise Dead, Resurrection) aren't wired. Need: spell resolution that restores dead companion from removed state, material component cost, time limit since death.

- [ ] **Player overhearing NPC-NPC private conversations** — Eavesdrop mechanic exists for player→NPC private talk, but player can't overhear NPC↔NPC background conversations based on Perception. Would add depth to the "party feels alive" vision.

- [ ] **Companion equipment management UI in paperdoll** — Currently companions can only trade via the barter overlay. A dedicated paperdoll-style equipment screen for companions would allow drag-drop equipping, slot visualization, and AC preview.

- [ ] **Full party pulse system (Phase 2-3 of inter-party dynamics)** — Realistic periodic inter-party exchanges: private scheming between NPCs, alliance forming, player awareness mechanics based on Perception. Chat bubbles with personality-driven frequency already work (Phase 1 done).

### Low Priority

- [ ] **Companion TTS / custom voices** — Each companion with distinct voice for speech bubbles. Mentioned in original vision. Would require TTS integration and voice profile per companion.

- [ ] **Companion gold economy** — Companions start with 5-19gp but have no way to earn or spend gold independently. Could add: companions finding loot, spending gold at merchants, gold-based dialogue options.

- [ ] **F4: Consolidate EquipmentEngine/InventoryManager equip paths** — Two independent equip code paths exist with slightly different behavior. EquipmentEngine.equipItem() is a backup path, InventoryManager is the primary UI path. Should be unified into a single path to prevent future divergence.

- [ ] **Companion subclass selection** — Auto-leveling sets `_pendingSubclass` flag but never resolves it for companions. Could auto-pick based on role/traits or let player choose.

- [ ] **Companion feat selection** — Same as subclass — feats are flagged but not auto-assigned. Could default to role-appropriate feats.

### Design Ideas (Not Started)

- [ ] **Party morale system** — Aggregate party mood based on: recent combat outcomes, relationship standings, companion HP, time since rest. Low morale = companions complain more, perform worse in combat. High morale = better combat AI, positive chatter.

- [ ] **Companion personal quests** — Each companion has a personal goal tied to their backstory/traits. Completing it raises standing significantly and unlocks a unique ability or dialogue branch.

- [ ] **Companion memory of specific player actions** — Beyond combat memory and conversation history: companion remembers if player stole, lied, helped NPCs, etc. Affects long-term relationship and dialogue.

- [ ] **Party formation presets** — Pre-configured tactical formations (phalanx, spread, ambush) that set companion directives automatically at combat start based on formation choice.

- [ ] **Companion inventory auto-management** — AI-driven equipment optimization: companion automatically equips the best available gear from their inventory based on class/role/stats without player intervention.

---

## Phase 2: Conversation Enhancements (After NPC-NPC Relations)

The following features require the inter-party NPC-NPC relationship matrix to be implemented first. They extend the `calculateImportanceScore()` group conversation routing system.

### NPC-NPC Relationship-Driven Conversation Signals

These signals cannot be implemented until each companion has standing values toward every OTHER companion (not just the player):

- [ ] **Inter-NPC disagreement trigger (+3 importance)** — When Companion A says something, Companion B who DISAGREES (opposing traits, low NPC-NPC standing) gets an importance boost to respond next. Example: Lawful companion responds when Chaotic companion suggests theft. Requires: NPC-NPC standing matrix + trait opposition map.

- [ ] **Alliance signaling (+2 importance)** — Companion supports their ally's point when NPC-NPC standing is > 50. "I agree with Grimjaw — we should press on." Requires: NPC-NPC standing > 50 check.

- [ ] **Rivalry interruption (+3 importance)** — Companion interrupts a rival (NPC-NPC standing < -20) to contradict or one-up them. Creates natural tension and drama. Requires: NPC-NPC standing < -20 check + detection that rival just spoke.

- [ ] **Pack behavior** — When two aligned NPCs (NPC-NPC standing > 30) both want to respond, the one who spoke less recently goes first, and the other gets a boosted commentary chance. Creates "we're on the same side" feel. Requires: NPC-NPC standing + recent speaker tracking.

### Emotional Memory System

These features require a per-companion emotional state tracker (beyond current trait/standing system):

- [ ] **Emotional memory (+4 importance for triggered topics)** — Companion remembers being embarrassed, praised, insulted, or scared in recent conversations. If a topic touches that memory, emotional urgency overrides normal routing. Example: companion who was mocked about their cooking stays silent on food topics but gets angry if pressed. Requires: emotional event log per companion with decay over time.

- [ ] **Mood state** — Running mood modifier (happy/neutral/angry/scared/reflective) influenced by: recent combat outcome, relationship deltas, time since rest, weather. Affects: extroversion factor (angry = more vocal), response tone, willingness to help. Requires: mood calculation function called each turn.

- [ ] **Grudge/gratitude persistence** — If player helped a companion in combat (healed them, protected them), that companion is more eager to respond positively for several turns. If player let them take damage without helping, they become sulky. Requires: combat event attribution tracking (who healed whom, who tanked for whom).

### Secret Knowledge and Private Context

- [ ] **Secret knowledge relevance (+5 importance)** — When a topic in player's question relates to something a companion learned in a private NPC-NPC background conversation, they score high because they have insider knowledge. They can hint at it without revealing the private nature. Requires: topic matching against `backgroundConversations[].topic`.

- [ ] **Whispered aside** — After a group conversation turn, two allied NPCs may have a quick private exchange (speech bubbles only to each other, player sees "[whispers to X]" but not content). Requires: NPC-NPC standing > 40 + recent controversial topic.

### Advanced Turn-Taking

- [ ] **Interruption mechanics** — High-urgency companion (importance > 7) can interrupt mid-response with a speech bubble, even if someone else is speaking. Visual: speech bubble appears on the interrupting companion's card while main narrative shows the primary speaker's text. Requires: parallel importance check during response generation.

- [ ] **Comfortable silence** — If all companions score < 2 importance, nobody responds. A brief system message like "*The group falls silent, each lost in their own thoughts.*" plays instead. More natural than forcing a response. Requires: silence threshold check after scoring.

- [ ] **"Everyone responds" mode** — For big revelations or party-wide questions ("We need to decide: do we enter the dungeon?"), each companion gives a brief opinion sequentially (1 sentence each). Triggered by importance variance being low (everyone cares equally). Requires: batch LLM calls or sequential quick responses.

---

## Voice & Language Systems

### Text-to-Speech (TTS)

- [ ] **ElevenLabs TTS integration** — Each companion gets a distinct voice mapped from personality traits + sex. `TTSEngine.ts` wraps ElevenLabs API with voice assignment, audio caching, and streaming. Plays after dialogue text appears in chat. Settings: TTS on/off, volume, speed. Cost: ~100-300 chars per response, ElevenLabs free tier covers ~10k chars/month.

- [ ] **Voice-personality mapping** — `VOICE_PROFILE_MAP` maps trait combinations → ElevenLabs voice ID. Male + Guard + Stoic → deep gruff voice. Female + Scholar + Inquisitive → articulate measured voice. Player can override per companion in settings.

- [ ] **Narrator TTS** — Optional TTS for narrator output (exploration narration, combat summaries). Separate voice from companion voices. Toggle independent from companion TTS.

### Speech-to-Text (STT)

- [ ] **Browser-native STT (free)** — Web Speech API (`SpeechRecognition`) for zero-cost voice input. Mic button next to text input field in talk mode. "Listening..." intermediate state. Auto-submits transcription as dialogue input.

- [ ] **Whisper API STT (paid, higher quality)** — OpenAI Whisper at $0.006/min as premium alternative. Better accuracy, supports 50+ languages. Toggle between browser-native and Whisper in settings.

### Multi-Language Support

- [ ] **LLM dialogue language** — System prompt injection: "All dialogue and narration must be in {language}." Works with modern LLMs out of the box. Language dropdown in game settings. Saved in `CampaignSettings` / localStorage for auto-load on startup.

- [ ] **UI localization (i18n)** — Translation JSON files per language for all UI strings (buttons, labels, tooltips, menus). `i18n.ts` translation loader with English fallback. Hundreds of strings to translate — labor-intensive but not technically complex. Font considerations for CJK/Arabic.

---

## World & Exploration

- [ ] **Ocean crossing / boat system** — Ocean biome currently blocks all movement. Need boat/ship mechanic to enable oceanic exploration. `MovementEngine.ts` line 123 has TODO placeholder.

- [ ] **Survival passive discovery (Phase 3)** — Tier-based Survival skill: T3+ auto-discovers hidden paths. Higher tiers may need additional implementation. `GameLoop.ts` line 588.

- [ ] **Infrastructure generation expansion (Phase 3)** — Roads, structures, and infrastructure on hex generation. Partially implemented in `ExplorationManager.ts`. May need expansion for trade routes, bridges, ruins.

- [ ] **Cartography skill system** — Map-related skill for discovering/revealing hexes, marking POIs, creating player maps. Designed but not implemented.

---

## Combat & Magic Systems

- [ ] **Concentration DC completion** — SpellcastingEngine has concentration tracking but DC calculation is incomplete (missing CON modifier application).

- [ ] **Area of Effect spell handling** — SpellcastingEngine does basic single-target damage only. Missing AoE spell resolution (Fireball, Thunderwave, etc.).

- [ ] **Unarmed combat bonuses** — `CombatOrchestrator.ts` has TODO for unarmed-specific bonuses beyond STR + proficiency. Monk unarmed strikes especially.

- [ ] **spawn_npc engine call** — Defined in ICPSchemas but stubbed in EngineDispatcher. Narrator can emit it but nothing happens. Need: NPC creation at current location from engine call args.

- [ ] **skill_check engine call improvements** — Basic dice roll exists but result isn't communicated back to narrator. Need: result passed to next narrator context so LLM knows if check succeeded.

---

## Data & Content Quality

- [ ] **Magical item properties** — Schema supports magical properties but limited content. Need more magical weapons/armor with varied effects.

- [ ] **Crafting system expansion** — Currently 6 recipes with basic framework. Need more recipes, material gathering, crafting UI.

- [ ] **Weather intensity variation** — `WeatherSchema` has intensity field (0-1.0) but no game logic uses it for variable effects (rain intensity, storm severity, visibility reduction).

- [ ] **Forged item persistence** — Rare+ forged items persist to disk but integration into future session loot generation may be incomplete.

- [ ] **Completed quests storage** — Save routine lacks explicit completed quests array. Currently relies on activeQuests with COMPLETED status. Needs migration to separate completed quests array for better query performance.

---

## Visual & UX Enhancements

- [ ] **Ambient animation effects** — Particle effects, floating damage numbers enhancement, environmental animations (rain, fog, fireflies). Currently minimal.

- [ ] **Atmospheric visual design** — Background art, ambient textures, decorative elements. Currently functional but plain.

- [ ] **Multiplayer support** — Schemas and basic WebRTC scaffolding exist only. Full implementation requires: session management, turn synchronization, shared state, player-to-player communication.

---

## Architecture & Code Quality

- [ ] **Consolidate EquipmentEngine / InventoryManager equip paths** — Two independent equip code paths with slightly different behavior. Should be unified into single authoritative path.

- [ ] **GameLoop size reduction** — Currently ~2000 lines. More command handlers could be extracted into dedicated managers (bartering, companion management already partially extracted).

- [ ] **Story Scribe overflow handling** — HistoryManager buffer trim is functional but Scribe overflow summarization for very long sessions may need enhancement.

- [ ] **Profile extraction enhancement** — ProfileExtractor works but could be extended with: grudge/gratitude tracking, emotional state persistence, secret knowledge logging from background conversations.

---

## Mixed Encounter Composition System

### Current Problem

`EncounterDirector.generateEncounter()` picks ONE monster type and fills the encounter with copies. "Pack of Goblins" = 4× Goblin. No mixed groups, no leader/minion composition, no thematic variety. A goblin warband should be 1 Hobgoblin Captain + 3 Goblins + 1 Bugbear, not 5 identical goblins.

### Architecture (4 modular files)

```
src/ruleset/combat/encounters/
├── MonsterFamilies.ts       — Which monsters naturally group together
├── EncounterTemplates.ts    — Composition patterns (patrol, warband, boss, etc.)
├── EncounterComposer.ts     — Runtime composition (picks template + fills with monsters)
└── EncounterNaming.ts       — Generates thematic encounter names
```

### MonsterFamilies.ts — 25 Creature Families

Each family defines members sorted by CR, with role hints inferred from CR position:

| Family | Minions (low CR) | Soldiers (mid CR) | Leaders (high CR) |
|--------|-----------------|-------------------|-------------------|
| **Goblinoids** | Goblin (0.25) | Hobgoblin (0.5) | Bugbear (1), Goblin Boss (1), Hobgoblin Captain (3) |
| **Bandits** | Bandit (0.125) | Thug (0.5), Scout (0.5) | Bandit Captain (2), Spy (1) |
| **Cultists** | Cultist (0.125) | Acolyte (0.25) | Cult Fanatic (2), Priest (2) |
| **Orcs** | Orc (0.5) | Orc Warrior (1) | Orc War Chief (4), Orc Eye of Gruumsh (2) |
| **Gnolls** | Gnoll (0.5) | — | Gnoll Pack Lord (2), Gnoll Fang of Yeenoghu (4) |
| **Kobolds** | Kobold (0.125) | Winged Kobold (0.25) | Kobold Scale Sorcerer (1), Kobold Inventor (1/4) |
| **Drow** | Drow (0.25) | Drow Elite Warrior (5) | Drow Priestess of Lolth (8) |
| **Wolves** | Wolf (0.25) | Dire Wolf (1), Worg (0.5) | Winter Wolf (3) |
| **Spiders** | Spider (0), Giant Wolf Spider (0.25) | Giant Spider (1), Ettercap (2) | Phase Spider (3) |
| **Undead Low** | Skeleton (0.25), Zombie (0.25) | Ghoul (1), Shadow (0.5), Ghast (2) | Wight (3), Mummy (3) |
| **Undead High** | Vampire Spawn (5) | Wraith (5) | Vampire (13), Mummy Lord (15), Lich (21) |
| **Devils** | Lemure (0), Imp (1) | Bearded Devil (3), Barbed Devil (5) | Chain Devil (8), Horned Devil (11) |
| **Demons** | Dretch (0.25), Quasit (1) | Vrock (6), Hezrou (8) | Glabrezu (9), Marilith (16) |
| **Giants** | Ogre (2) | Ettin (4), Hill Giant (5), Troll (5) | Stone/Frost/Fire Giant (7-9) |
| **Bears** | Black Bear (0.5) | Brown Bear (1), Polar Bear (2) | Cave Bear (2) |
| **Snakes** | Poisonous Snake (0.125) | Giant Poisonous Snake (0.25) | Giant Constrictor Snake (2) |
| **Rats** | Rat (0), Swarm of Rats (0.25) | Giant Rat (0.125) | — |
| **Hags** | — | Sea Hag (2), Green Hag (3) | Night Hag (5) |
| **Elementals** | Mephits (0.25-0.5) | Azer (2), Gargoyle (2) | Air/Earth/Fire/Water Elemental (5) |
| **Oozes** | Gray Ooze (0.5) | Gelatinous Cube (2), Ochre Jelly (2) | Black Pudding (4) |
| **Lizardfolk** | Lizardfolk (0.5) | — | Lizardfolk Shaman (2), Lizardfolk King (4) |
| **Sahuagin** | Sahuagin (0.5) | — | Sahuagin Priestess (2), Sahuagin Baron (5) |
| **Chromatic Dragons** | Wyrmlings (2-4) | Young (6-10) | Adult (13-17), Ancient (20-24) |
| **Metallic Dragons** | Wyrmlings (1-3) | Young (6-10) | Adult (13-17), Ancient (20-24) |
| **Lycanthropes** | Wererat (2), Werewolf (3) | Wereboar (4), Weretiger (4) | Werebear (5) |

### EncounterTemplates.ts — Composition Patterns

| Template | Structure | When Used | Example |
|----------|-----------|-----------|---------|
| **PATROL** | 2-4× same creature | Low XP budget, single-type family | 3 Wolves |
| **WARBAND** | 1 leader + 3-6 minions | Mid budget, has leader variant | 1 Hobgoblin + 4 Goblins |
| **RAIDING_PARTY** | 1 leader + 2-3 soldiers + 1-2 minions | High budget | 1 Bandit Captain + 2 Thugs + 3 Bandits |
| **BOSS_AND_MINIONS** | 1 boss (2+ CR tiers above minions) + 2-4 minions | Boss encounter | 1 Bugbear + 3 Goblins |
| **LONE_PREDATOR** | 1 powerful creature | Budget fits single strong creature | 1 Owlbear |
| **PACK** | 4-8× same beast | Animal encounters | 6 Wolves |
| **AMBUSH** | 2-3 stealth types + 1-2 ranged | Forests, swamps | 2 Goblins + 1 Bugbear (surprise) |
| **LAIR** | 1 boss + environmental hazards + 1-3 minions | Dungeon encounters | 1 Phase Spider + 2 Giant Spiders + webs |

### EncounterComposer.ts — Runtime Logic

```
Input: biome, XP budget, party size
1. Get available monster families for this biome (from biome_monster_mapping)
2. Pick a family (weighted by biome affinity)
3. Pick a template based on XP budget:
   - Budget < 200: PATROL or LONE_PREDATOR
   - Budget 200-500: WARBAND or PACK
   - Budget 500-1000: RAIDING_PARTY or BOSS_AND_MINIONS
   - Budget > 1000: BOSS_AND_MINIONS with high-CR leader
4. Fill template slots from family members within XP budget
5. Role assignment: highest CR = leader, lowest = minions, mid = soldiers
6. Return Encounter with mixed monsters[]
```

### EncounterNaming.ts — Thematic Names

Based on template + family:
- WARBAND goblinoids → "Goblin War Party"
- BOSS_AND_MINIONS undead → "Wight and its Skeletal Servants"
- LONE_PREDATOR beast → "Prowling Owlbear"
- PACK wolves → "Hungry Wolf Pack"
- AMBUSH bandits → "Highway Ambush"
- RAIDING_PARTY orcs → "Orc Raiding Party"

### Missing Leader Variants Needed

To enable mixed encounters for all families, these monster JSON files need to be created (D&D 5e SRD-accurate):

| Monster | CR | Type | Family | Role |
|---------|------|------|--------|------|
| Goblin Boss | 1 | humanoid | Goblinoids | Leader |
| Hobgoblin Captain | 3 | humanoid | Goblinoids | Leader |
| Bugbear Chief | 3 | humanoid | Goblinoids | Leader |
| Orc War Chief | 4 | humanoid | Orcs | Leader |
| Orc Eye of Gruumsh | 2 | humanoid | Orcs | Shaman |
| Orc Blade of Ilneval | 5 | humanoid | Orcs | Champion |
| Gnoll Pack Lord | 2 | humanoid | Gnolls | Leader |
| Gnoll Fang of Yeenoghu | 4 | humanoid | Gnolls | Elite |
| Winged Kobold | 1/4 | humanoid | Kobolds | Variant |
| Kobold Scale Sorcerer | 1 | humanoid | Kobolds | Caster |
| Kobold Inventor | 1/4 | humanoid | Kobolds | Specialist |
| Lizardfolk Shaman | 2 | humanoid | Lizardfolk | Caster |
| Lizardfolk King/Queen | 4 | humanoid | Lizardfolk | Leader |
| Sahuagin Priestess | 2 | humanoid | Sahuagin | Caster |
| Sahuagin Baron | 5 | humanoid | Sahuagin | Leader |
| Drow Elite Warrior | 5 | humanoid | Drow | Soldier |
| Drow Priestess of Lolth | 8 | humanoid | Drow | Leader |
| Drow Mage | 7 | humanoid | Drow | Caster |
| Gnoll Witherling | 1/4 | undead | Gnolls | Minion |
| Orc Nurtured One of Yurtrus | 1/2 | humanoid | Orcs | Specialist |
| Hobgoblin Devastator | 4 | humanoid | Goblinoids | Caster |
| Hobgoblin Iron Shadow | 2 | humanoid | Goblinoids | Stealth |
