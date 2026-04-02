# Item Identification — Player Guide

## Unidentified Items

When you defeat powerful enemies, they sometimes drop **forged items** — unique magical weapons and armor. Items of **Rare** quality or higher drop as **unidentified**:

| True Rarity | What You See | What's Hidden |
|:---|:---|:---|
| Common | Fully visible | Nothing |
| Uncommon | Fully visible | Nothing |
| Rare | Appears as Uncommon | True name, rarity, magical properties, lore |
| Very Rare | Appears as Rare | True name, rarity, some magical properties |
| Legendary | Appears as Very Rare | True name, rarity, some magical properties |

**What still works before identification:**
- Hit bonuses, AC bonuses, and damage bonuses are active — you feel the weapon's quality
- The item functions mechanically at full power

**What's hidden:**
- The item's true name (you see a generic name like "Uncommon Longsword +2")
- Magical properties (elemental damage, resistances, spell charges)
- The item's lore and history
- The true sell price (you'll get less for it at merchants)

---

## How to Identify

### Method 1: Examine (Skill Check)
Right-click an unidentified item and choose **Examine**, or type `/examine <item name>`.

- Requires **Arcana** or **Investigation** proficiency
- Rolls: `d20 + INT modifier + skill bonus` vs DC based on true rarity
- DC: Rare = 12, Very Rare = 15, Legendary = 18

**Daily attempts** depend on your skill tier:
| Skill Tier | Attempts per 24 hours |
|:---:|:---:|
| Tier 1 (Proficient) | 1 |
| Tier 2 (Expert) | 2 |
| Tier 3 (Master) | 3 |

**Master-level Arcana bonus:** If you chose the Arcane Intuition passive ability (Tier 3), Rare items are automatically identified — no roll needed.

### Method 2: Merchant Service
During trade, use `/merchantidentify <item name>`. The merchant charges gold based on the item's true rarity:

| Rarity | Cost |
|:---|:---:|
| Rare | 50 gp |
| Very Rare | 200 gp |
| Legendary | 1,000 gp |

This always succeeds — no skill check required.

---

## What Happens After Identification

- The item's **true name** is revealed (e.g., "Bonegleam Edge")
- **True rarity** shown with proper color coding
- All **magical properties** displayed in tooltips and data sheets
- **Sell price** updates to reflect the true rarity
- A **lore description** is generated describing the item's history

---

## Sell Price and Buyback

- **Selling unidentified:** Price based on the lower perceived rarity (you're leaving money on the table)
- **Selling identified:** Price based on true rarity
- **Buyback:** If you sell an unidentified forged item, the merchant recognizes its true value — buyback price is based on the real worth

---

## Forged Items in Shops

Merchants may stock 1-3 forged items from the world catalog alongside their regular goods. These items:
- Are always fully identified (merchants know what they're selling)
- Are level-gated (within 3 levels of your character)
- Are unique — an item in one merchant's stock won't appear in another's
- Show rarity colors, modifier summaries, and Magic/Forged badges in the trade window
