# NPC & Companion System — Future Expansions

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
