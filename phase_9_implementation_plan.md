Plan: Phase 9 — Item Identification, Uniqueness, and Shop Integration

 Context

 Forged items (Phases 1-7 + 4.5) are created during combat, persist to disk if Rare+, and have rarity-scaled
 stats/pricing. Now we need three interconnected features before forged items appear in shops:

 1. Identification system — Rare+ forged items drop as "unidentified", hiding true name, rarity, and magical properties
  until examined
 2. Uniqueness — Named forged items are unique in the game world (no duplicates)
 3. Shop integration — Merchants stock forged items from catalog, with cap + level gate

 Implementation order: Identification first (shops must respect ID status), then uniqueness, then shop integration.

 ---
 Phase 9A: Item Identification System

 Core Logic

 When a forged item of Rare+ rarity is created, it starts unidentified. The player sees a "downgraded" version:

 ┌─────────────┬──────────────────────────┬─────────────────────────────────────────────────────────────┐
 │ True Rarity │       Perceived As       │                           Hidden                            │
 ├─────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────┤
 │ Common      │ Common (fully visible)   │ Nothing                                                     │
 ├─────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────┤
 │ Uncommon    │ Uncommon (fully visible) │ Nothing                                                     │
 ├─────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────┤
 │ Rare        │ Uncommon                 │ True name, true rarity, magical properties, LLM description │
 ├─────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────┤
 │ Very Rare   │ Rare                     │ True name, true rarity, some magical properties             │
 ├─────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────┤
 │ Legendary   │ Very Rare                │ True name, true rarity, some magical properties             │
 └─────────────┴──────────────────────────┴─────────────────────────────────────────────────────────────┘

 What the player sees before identification:
 - Name: mechanical default name (e.g., "Uncommon Longsword +1") instead of LLM name ("Bonegleam Edge")
 - Rarity: one tier lower
 - Modifiers (HitBonus, ACBonus, DamageAdd): VISIBLE and ACTIVE
 - Magical properties (BonusDamage element, Resistance, SpellCharge, ConditionImmunity): ACTIVE mechanically but HIDDEN
  from UI (tooltip, datasheet, trade)
 - Sell price: based on perceived (lower) rarity
 - Description: generic placeholder

 What happens after identification:
 - True name revealed ("Bonegleam Edge")
 - True rarity revealed (Rare/Very Rare/Legendary)
 - All magical properties shown in UI
 - LLM generates lore/history description (persisted to item)
 - Sell price updates to true rarity value
 - Codex entry triggered (LoreService)

 Schema Changes

 ItemSchema.ts — BaseItemSchema — add fields:
 identified: z.boolean().default(true)        // false = unidentified
 perceivedRarity: RaritySchema.optional()     // what player sees before ID
 perceivedName: z.string().optional()         // mechanical name shown before ID
 trueName: z.string().optional()              // LLM name, revealed on ID
 identifiedBy: z.string().optional()          // 'skill', 'spell', 'merchant', or undefined

 PlayerCharacterSchema.ts — inventory items: already uses .passthrough(), so new fields survive

 Item Creation Flow (modify ItemForgeEngine + LoreService)

 1. ItemForgeEngine.forgeItem() creates item with full stats as today
 2. If rarity >= Rare:
   - Set identified: false
   - Set perceivedRarity = one tier lower
   - Set perceivedName = generateDefaultName(base, perceivedRarity, hitBonus, []) (no magical props in name)
   - Set trueName = the full forged name
   - Set visible name = perceivedName (what player sees)
   - Set visible rarity = perceivedRarity
 3. LLM naming (LoreService.nameForgedItem) stores result in trueName instead of overwriting name

 Identification Methods

 Method 1: Skill Check (Arcana/Investigation)
 - Player right-clicks item → "Examine" option (currently disabled in ItemContextMenu)
 - DC based on true rarity: Rare=12, Very Rare=15, Legendary=18
 - Uses INT + Arcana (or Investigation) skill check
 - On failure: 24h cooldown (tracked per item instanceId, similar to haggle cooldown)
 - On success: item identified

 Method 2: Identify Spell
 - /cast Identify <item> — auto-succeeds if player has Identify spell prepared and slot available
 - Consumes a spell slot (level 1)
 - No failure possible

 Method 3: Merchant Service
 - During active trade, right-click unidentified item → "Identify (Xgp)" option
 - Price: Rare=50gp, Very Rare=200gp, Legendary=1000gp
 - Standing/haggle modifiers apply (same as getBuyPrice calculation)
 - Merchant must have gold >= service cost (merchant receives payment)
 - On success: item identified

 On Identification (shared logic)

 function identifyItem(item):
     item.identified = true
     item.name = item.trueName || item.name
     item.rarity = item.trueRarity (stored separately or computed from perceivedRarity + 1 tier)
     item.identifiedBy = method

     // Trigger LLM lore generation
     LoreService.generateItemLore(item) → sets item.description to rich lore text

     // Update sell price (recalculate cost based on true rarity)
     item.cost.gp = baseCost * RARITY_VALUE_MULTIPLIER[trueRarity]

     // Notification
     state.notifications.push("Identified: {trueName} — {trueRarity}!")

 UI Changes

 ItemTooltip / ItemDatasheet: When identified === false:
 - Show perceivedName and perceivedRarity color
 - Show modifiers (HitBonus, ACBonus, DamageAdd) — these are visible
 - HIDE magical properties section entirely
 - Show "Unidentified" badge instead of "Magic" badge
 - Description: "This item's true nature has not been revealed."

 ItemContextMenu: Enable "Examine" action for unidentified items (skill check)

 TradeModal: Show "Identify (Xgp)" button for unidentified items during trade

 Files to Modify

 ┌───────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
 │                       File                        │                            Change                            │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ruleset/schemas/ItemSchema.ts                 │ Add identified, perceivedRarity, perceivedName, trueName,    │
 │                                                   │ identifiedBy                                                 │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ruleset/combat/ItemForgeEngine.ts             │ Set identification fields on Rare+ items                     │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ruleset/agents/LoreService.ts                 │ Store LLM name in trueName; add generateItemLore() for       │
 │                                                   │ post-ID lore                                                 │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ruleset/combat/managers/CombatOrchestrator.ts │ LLM naming writes to trueName not name                       │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ui/components/paperdoll/ItemTooltip.tsx       │ Hide magical properties when !identified                     │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ui/components/inventory/ItemDatasheet.tsx     │ Hide magical properties, show "Unidentified"                 │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ui/components/inventory/ItemContextMenu.tsx   │ Enable "Examine" for unidentified items                      │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ui/components/exploration/TradeModal.tsx      │ Add "Identify" service button                                │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ruleset/combat/GameLoop.ts                    │ Add /examine and /identify commands                          │
 ├───────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/ruleset/combat/ShopEngine.ts                  │ Add identifyItem() merchant service method                   │
 └───────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘

 ---
 Phase 9B: Forged Item Uniqueness

 Logic

 Named forged items (items with isForged: true and a unique trueName or name) are one-of-a-kind in the game world.

 Deduplication points:
 1. ItemForgeEngine.forgeItem() — before creating, check if an item with this name already exists in DataManager
 registry. If yes, re-roll (generate a different item) or skip.
 2. MerchantInventoryPool — when stocking forged items, skip any that exist in player inventory or another merchant's
 inventory.
 3. ForgedItemCatalog.persistForgedItem() — already deduplicates by name on disk.

 Player inventory check:
 function isItemInWorld(name, state):
     // Check player inventory
     if state.character.inventory.items.some(i => i.name === name) → true
     // Check all merchant inventories
     if state.worldNpcs.some(n => n.shopState?.inventory.includes(name)) → true
     // Check combat loot on ground
     if state.location.combatLoot.some(i => i.name === name) → true
     return false

 Files to Modify

 ┌───────────────────────────────────────────┬──────────────────────────────────────────────────────┐
 │                   File                    │                        Change                        │
 ├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
 │ src/ruleset/combat/ItemForgeEngine.ts     │ Optional: check world uniqueness before forging      │
 ├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
 │ src/ruleset/data/MerchantInventoryPool.ts │ Skip items already in world when building shop stock │
 └───────────────────────────────────────────┴──────────────────────────────────────────────────────┘

 ---
 Phase 9C: Shop Integration + Bug Fixes

 Forged Items in Shops

 MerchantInventoryPool.ts — add method:
 getForgedItemsForMerchant(biome, playerLevel, existingInventory, worldState):
     1. Load all items from DataManager where isForged === true
     2. Filter: itemLevel within ±3 of playerLevel
     3. Filter: biome match (parse from forgeSource) or allow 20% chance for non-matching
     4. Filter: not already in existingInventory (dedup)
     5. Filter: not in player inventory or other merchants (uniqueness)
     6. Filter: identified items only for shops (merchants don't sell unidentified goods)
     7. Randomly pick 1-3 items from filtered pool
     8. Return item names

 GameLoop.populateMerchantInventory() — after picking base items, also call getForgedItemsForMerchant() and append to
 inventory.

 Bug Fixes (alongside Phase 9C)

 Bug #1 (HIGH): NPC location validation
 - GameLoop.ts /trade handler — add hex NPC check:
 const hex = state.worldMap.hexes[state.location.hexId];
 if (!hex?.npcs?.includes(npcId)) return "That NPC is not here.";

 Bug #2 (HIGH): Inventory deduplication
 - MerchantInventoryPool — ensure no duplicate names in merchant stock
 - ShopEngine.buyItem() — remove by exact index (tracked from UI selection) rather than first name match

 Trade UI Rarity Display

 TradeModal.tsx — for each merchant item:
 - Look up full item data (including forge fields) from DataManager
 - Color item name by rarity
 - Show modifier summary ("+2 Hit, +1 AC") in small text
 - Show "Magic" badge if isMagic
 - Show "Unidentified" badge if applicable (merchant service context)

 Files to Modify

 ┌──────────────────────────────────────────────┬────────────────────────────────────────────────────┐
 │                     File                     │                       Change                       │
 ├──────────────────────────────────────────────┼────────────────────────────────────────────────────┤
 │ src/ruleset/data/MerchantInventoryPool.ts    │ Add getForgedItemsForMerchant()                    │
 ├──────────────────────────────────────────────┼────────────────────────────────────────────────────┤
 │ src/ruleset/combat/GameLoop.ts               │ NPC location validation; call forged item stocking │
 ├──────────────────────────────────────────────┼────────────────────────────────────────────────────┤
 │ src/ruleset/combat/ShopEngine.ts             │ Fix buyItem dedup; add merchant identify service   │
 ├──────────────────────────────────────────────┼────────────────────────────────────────────────────┤
 │ src/ui/components/exploration/TradeModal.tsx │ Rarity colors, modifier summary, identify button   │
 └──────────────────────────────────────────────┴────────────────────────────────────────────────────┘

 ---
 Verification

 Phase 9A tests:

 1. Forge a Rare weapon → verify it starts unidentified (name = mechanical, rarity = Uncommon)
 2. Equip unidentified item → verify bonuses apply (AC/hit changes)
 3. Tooltip shows modifiers but NOT magical properties
 4. /examine <item> skill check → on success, true name + rarity + magic revealed
 5. Merchant identify service → charges gold, identifies item
 6. After ID: sell price reflects true rarity
 7. LLM generates lore description on identification

 Phase 9B tests:

 1. Forge item → same-name item cannot be forged again in same session
 2. Merchant doesn't stock item player already owns
 3. Two merchants don't stock the same forged item simultaneously

 Phase 9C tests:

 1. Merchant stocks 1-3 forged items from catalog
 2. Forged items level-gated (±3 player level)
 3. Trade UI shows rarity colors + modifiers for forged items
 4. Bug: /trade with remote NPC → rejected
 5. Bug: buying from merchant with duplicate names → correct item removed
 6. Full trade cycle: buy forged item from merchant → sell it back → buyback works