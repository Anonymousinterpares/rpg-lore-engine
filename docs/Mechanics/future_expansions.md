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
