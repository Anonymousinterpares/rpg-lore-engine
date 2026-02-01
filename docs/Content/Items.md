# Content: Items & Equipment

## 1. Procedural Item Generation
When the Engine or LLM generates loot, it may apply an **Adjective** to base items. This adjective deterministically alters the item's statistics.

| Adjective | Tier | Effect Description | Modification Logic |
| :--- | :--- | :--- | :--- |
| **Piteous** | -3 | Barely functional trash. | -3 to Attack/Damage (Weapon) or -3 AC (Armor). |
| **Broken** | -2 | Damaged, unreliable. | -2 to Attack/Damage or AC. |
| **Rusty** | -1 | Poorly maintained. | -1 to Attack/Damage or AC. |
| **Standard** | 0 | Normal Shop Quality. | +0 (No change). |
| **Distinctive**| +1 | Good craftsmanship. | +1 to Attack/Damage or +1 AC. |
| **Masterwork**| +2 | Expertly forged. | +2 to Attack/Damage or +2 AC. |
| **Mythic** | +3 | Magical or legendary. | +3 to Attack/Damage or +3 AC. (Consider Magic tag). |

*Implementation Note: If an Armor's AC assumes a base (e.g., Plate 18), "Rusty Plate" becomes AC 17. If a Weapon deals 1d8, "Fine Longsword" deals 1d8+1.*

## 2. Armor Table
*   **Stealth:** If "Disadvantage", the wearer has Disadvantage on Stealth (DEX) checks.
*   **Strength:** Minimum STR score required to wear without -10 speed penalty.
*   **Weight:** In lbs.

| Armor | Type | AC Calculation | STR Req | Stealth | Weight | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Padded** | Light | 11 + DEX | - | Disadv | 8 | 5 gp |
| **Leather** | Light | 11 + DEX | - | - | 10 | 10 gp |
| **Studded** | Light | 12 + DEX | - | - | 13 | 45 gp |
| **Hide** | Medium | 12 + DEX (Max 2) | - | - | 12 | 10 gp |
| **Chain Shirt**| Medium | 13 + DEX (Max 2) | - | - | 20 | 50 gp |
| **Scale Mail** | Medium | 14 + DEX (Max 2) | - | Disadv | 45 | 50 gp |
| **Breastplate**| Medium | 14 + DEX (Max 2) | - | - | 20 | 400 gp |
| **Half Plate** | Medium | 15 + DEX (Max 2) | - | Disadv | 40 | 750 gp |
| **Ring Mail** | Heavy | 14 | - | Disadv | 40 | 30 gp |
| **Chain Mail** | Heavy | 16 | 13 | Disadv | 55 | 75 gp |
| **Splint** | Heavy | 17 | 15 | Disadv | 60 | 200 gp |
| **Plate** | Heavy | 18 | 15 | Disadv | 65 | 1500 gp |
| **Shield** | Shield | +2 AC | - | - | 6 | 10 gp |

## 3. Weapon Table
*   **Finesse:** Use STR or DEX for Attack/Damage.
*   **Light:** Valid for Two-Weapon Fighting (Bonus Action offhand attack).
*   **Heavy:** Small creatures have Disadvantage on Attack.
*   **Reach:** Adds 5ft range.
*   **Versatile:** Can be used 2H for the higher die (in parenthesis).
*   **Thrown:** Ranged attack using STR (or DEX if Finesse).

| Weapon | Damage | Type | Properties | Weight | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Club** | 1d4 | Bludgeon | Light | 2 | 1 sp |
| **Dagger** | 1d4 | Piercing | Finesse, Light, Thrown (20/60) | 1 | 2 gp |
| **Greatclub** | 1d8 | Bludgeon | Two-Handed | 10 | 2 sp |
| **Handaxe** | 1d6 | Slashing | Light, Thrown (20/60) | 2 | 5 gp |
| **Javelin** | 1d6 | Piercing | Thrown (30/120) | 2 | 5 sp |
| **Light Hammer**| 1d4 | Bludgeon | Light, Thrown (20/60) | 2 | 2 gp |
| **Mace** | 1d6 | Bludgeon | - | 4 | 5 gp |
| **Quarterstaff**| 1d6 (1d8)| Bludgeon| Versatile | 4 | 2 sp |
| **Sickle** | 1d4 | Slashing | Light | 2 | 1 gp |
| **Spear** | 1d6 (1d8)| Piercing | Thrown (20/60), Versatile | 3 | 1 gp |
| **Light X-Bow** | 1d8 | Piercing | Ammunition (80/320), Loading, Two-Handed | 5 | 25 gp |
| **Dart** | 1d4 | Piercing | Finesse, Thrown (20/60) | 0.25 | 5 cp |
| **Shortbow** | 1d6 | Piercing | Ammunition (80/320), Two-Handed | 2 | 25 gp |
| **Sling** | 1d4 | Bludgeon | Ammunition (30/120) | - | 1 sp |
| **Battleaxe** | 1d8 (1d10)| Slashing| Versatile | 4 | 10 gp |
| **Flail** | 1d8 | Bludgeon | - | 2 | 10 gp |
| **Glaive** | 1d10 | Slashing | Heavy, Reach, Two-Handed | 6 | 20 gp |
| **Greataxe** | 1d12 | Slashing | Heavy, Two-Handed | 7 | 30 gp |
| **Greatsword** | 2d6 | Slashing | Heavy, Two-Handed | 6 | 50 gp |
| **Halberd** | 1d10 | Slashing | Heavy, Reach, Two-Handed | 6 | 20 gp |
| **Lance** | 1d12 | Piercing | Reach, Special | 6 | 10 gp |
| **Longsword** | 1d8 (1d10)| Slashing| Versatile | 3 | 15 gp |
| **Maul** | 2d6 | Bludgeon | Heavy, Two-Handed | 10 | 10 gp |
| **Morningstar** | 1d8 | Piercing | - | 4 | 15 gp |
| **Pike** | 1d10 | Piercing | Heavy, Reach, Two-Handed | 18 | 5 gp |
| **Rapier** | 1d8 | Piercing | Finesse | 2 | 25 gp |
| **Scimitar** | 1d6 | Slashing | Finesse, Light | 3 | 25 gp |
| **Shortsword** | 1d6 | Piercing | Finesse, Light | 2 | 10 gp |
| **Trident** | 1d6 (1d8)| Piercing | Thrown (20/60), Versatile | 4 | 5 gp |
| **War Pick** | 1d8 | Piercing | - | 2 | 5 gp |
| **Warhammer** | 1d8 (1d10)| Bludgeon| Versatile | 2 | 15 gp |
| **Whip** | 1d4 | Slashing | Finesse, Reach | 3 | 2 gp |
| **Blowgun** | 1 | Piercing | Ammunition (25/100), Loading | 1 | 10 gp |
| **Hand X-Bow** | 1d6 | Piercing | Ammunition (30/120), Light, Loading | 3 | 75 gp |
| **Heavy X-Bow** | 1d10 | Piercing | Ammunition (100/400), Heavy, Loading, 2H | 18 | 50 gp |
| **Longbow** | 1d8 | Piercing | Ammunition (150/600), Heavy, Two-Handed | 2 | 50 gp |

## 4. Starting Equipment Packs
Pre-defined bundles for character creation.

*   **Burglar's Pack:** Backpack, bag of 1,000 ball bearings, 10 ft string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 flasks of oil, 5 rations, tinderbox, waterskin, 50 ft hempen rope.
*   **Diplomat's Pack:** Chest, 2 cases for maps/scrolls, fine clothes, bottle of ink, ink pen, lamp, 2 flasks of oil, 5 sheets of paper, vial of perfume, sealing wax, soap.
*   **Dungeoneer's Pack:** Backpack, crowbar, hammer, 10 pitons, 10 torches, tinderbox, 10 rations, waterskin, 50 ft hempen rope.
*   **Entertainer's Pack:** Backpack, bedroll, 2 costumes, 5 candles, 5 rations, waterskin, disguise kit.
*   **Explorer's Pack:** Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 rations, waterskin, 50 ft hempen rope.
*   **Priest's Pack:** Backpack, blanket, 10 candles, tinderbox, alms box, 2 blocks of incense, censer, vestments, 2 rations, waterskin.
*   **Scholar's Pack:** Backpack, book of lore, bottle of ink, ink pen, 10 sheets of parchment, little bag of sand, small knife.
