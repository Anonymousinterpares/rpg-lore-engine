/**
 * ItemForgeEngine — Generates items with level-scaled, rarity-driven stats
 * and context-aware magical properties.
 *
 * The LLM names/describes; this engine decides ALL mechanics.
 */

import { DataManager } from '../data/DataManager';
import { Item, Rarity, MagicalProperty, RaritySchema } from '../schemas/ItemSchema';
import {
    crToItemLevel, crToLevelTier,
    getCRBracket, RARITY_WEIGHTS, MAGIC_CHANCE,
    WEAPON_BONUSES, ARMOR_BONUSES, JEWELRY_BONUSES,
    ELEMENT_POOLS, BIOME_ELEMENT_POOLS, JEWELRY_TRAIT_POOL,
    RARITY_VALUE_MULTIPLIER,
    randomInRange, averageDice,
} from '../data/ForgeConfig';

// ─── Types ───────────────────────────────────────────────────────────

export interface ForgeParams {
    category: 'weapon' | 'armor' | 'shield' | 'jewelry';
    baseItemName: string;
    cr: number;
    monsterType: string;
    biome: string;
    monsterName?: string;
}

export interface ForgeContext {
    monsterType: string;
    biome: string;
    monsterName: string;
}

// ─── Ability Scores (for jewelry stat bonuses) ───────────────────────

const ABILITY_SCORES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

// ─── Engine ──────────────────────────────────────────────────────────

export class ItemForgeEngine {

    /**
     * Main entry point. Generates a complete item with stats, rarity, and optional magic.
     */
    static forgeItem(params: ForgeParams): Item {
        const base = DataManager.getItem(params.baseItemName);
        if (!base) throw new Error(`[ItemForge] Base item not found: ${params.baseItemName}`);

        const itemLevel = crToItemLevel(params.cr);
        const rarity = this.rollRarity(params.cr);
        const context: ForgeContext = {
            monsterType: params.monsterType,
            biome: params.biome,
            monsterName: params.monsterName || 'Unknown',
        };

        switch (params.category) {
            case 'weapon':  return this.forgeWeapon(base, itemLevel, rarity, context);
            case 'armor':   return this.forgeArmor(base, itemLevel, rarity, context);
            case 'shield':  return this.forgeArmor(base, itemLevel, rarity, context);
            case 'jewelry': return this.forgeJewelry(base, itemLevel, rarity, context);
            default:        return base;
        }
    }

    /**
     * Roll rarity based on CR-weighted probability table.
     */
    static rollRarity(cr: number): Rarity {
        const bracket = getCRBracket(cr);
        const weights = RARITY_WEIGHTS[bracket];
        const roll = Math.random() * 100;
        let cumulative = 0;

        for (const rarity of ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'] as Rarity[]) {
            cumulative += weights[rarity];
            if (roll < cumulative) return rarity;
        }
        return 'Common'; // Fallback
    }

    /**
     * Pick a magical element from the context-aware pool.
     * Monster type pool takes priority, biome is fallback.
     */
    static rollElement(monsterType: string, biome: string): string | null {
        const pool = ELEMENT_POOLS[monsterType.toLowerCase()] || BIOME_ELEMENT_POOLS[biome] || null;
        if (!pool || pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * Generate a default name for the item (without LLM).
     */
    /**
     * Returns a display-friendly base name (e.g., "Padded" → "Padded Armor").
     */
    static normalizeBaseName(name: string, type: string): string {
        if (type !== 'Armor' && type !== 'Shield') return name;
        // Already descriptive names — don't append
        const descriptive = ['mail', 'plate', 'shirt', 'splint', 'shield', 'breastplate'];
        if (descriptive.some(d => name.toLowerCase().includes(d))) return name;
        return `${name} Armor`;
    }

    static generateDefaultName(baseName: string, rarity: Rarity, hitBonus: number, magicalProps: MagicalProperty[]): string {
        const parts: string[] = [];

        if (rarity !== 'Common') parts.push(rarity);

        // Element prefix from magical properties
        const elementProp = magicalProps.find(p => p.element);
        if (elementProp?.element) parts.push(elementProp.element);

        parts.push(baseName);

        // +N suffix from hit bonus
        if (hitBonus > 0) parts.push(`+${hitBonus}`);

        return parts.join(' ');
    }

    // ─── Weapon Forging ──────────────────────────────────────────────

    static forgeWeapon(base: Item, level: number, rarity: Rarity, context: ForgeContext): Item {
        const tier = crToLevelTier(level);
        const bonuses = WEAPON_BONUSES[tier][rarity];

        const hitBonus = randomInRange(bonuses.hitBonus[0], bonuses.hitBonus[1]);
        const dmgBonus = randomInRange(bonuses.damageBonus[0], bonuses.damageBonus[1]);

        const modifiers: { type: string; target: string; value: number }[] = [];
        if (hitBonus > 0) modifiers.push({ type: 'HitBonus', target: 'Attack', value: hitBonus });
        if (dmgBonus > 0) modifiers.push({ type: 'DamageAdd', target: 'Damage', value: dmgBonus });

        const magicalProperties: MagicalProperty[] = [];
        const magicChance = MAGIC_CHANCE[rarity];
        if (Math.random() < magicChance) {
            const element = this.rollElement(context.monsterType, context.biome);
            if (element && bonuses.bonusDamageDice) {
                magicalProperties.push({
                    type: 'BonusDamage',
                    element,
                    dice: bonuses.bonusDamageDice,
                    value: averageDice(bonuses.bonusDamageDice),
                });
                modifiers.push({ type: 'DamageAdd', target: element, value: averageDice(bonuses.bonusDamageDice) });
            }
        }

        const name = this.generateDefaultName(base.name, rarity, hitBonus, magicalProperties);
        const goldValue = (base.cost?.gp || 0) * RARITY_VALUE_MULTIPLIER[rarity];

        return {
            ...JSON.parse(JSON.stringify(base)), // Deep clone base
            name,
            rarity,
            itemLevel: level,
            isMagic: magicalProperties.length > 0,
            isForged: true,
            forgeSource: `${context.monsterName} CR ${level} ${context.biome}`,
            modifiers,
            magicalProperties,
            cost: { ...base.cost, gp: goldValue },
            instanceId: `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        };
    }

    // ─── Armor / Shield Forging ──────────────────────────────────────

    static forgeArmor(base: Item, level: number, rarity: Rarity, context: ForgeContext): Item {
        const tier = crToLevelTier(level);
        const bonuses = ARMOR_BONUSES[tier][rarity];

        const acBonus = randomInRange(bonuses.acBonus[0], bonuses.acBonus[1]);

        const modifiers: { type: string; target: string; value: number }[] = [];
        if (acBonus > 0) modifiers.push({ type: 'ACBonus', target: 'AC', value: acBonus });

        const magicalProperties: MagicalProperty[] = [];
        const magicChance = MAGIC_CHANCE[rarity];
        if (Math.random() < magicChance) {
            const element = this.rollElement(context.monsterType, context.biome);
            if (element) {
                magicalProperties.push({
                    type: 'Resistance',
                    element,
                    description: `Resistance to ${element} damage`,
                });
                modifiers.push({ type: 'DamageResistance', target: element, value: 1 });
            }
        }

        const displayBase = this.normalizeBaseName(base.name, base.type);
        const name = this.generateDefaultName(displayBase, rarity, acBonus, magicalProperties);
        const goldValue = (base.cost?.gp || 0) * RARITY_VALUE_MULTIPLIER[rarity];

        return {
            ...JSON.parse(JSON.stringify(base)),
            name,
            rarity,
            itemLevel: level,
            isMagic: magicalProperties.length > 0,
            isForged: true,
            forgeSource: `${context.monsterName} CR ${level} ${context.biome}`,
            modifiers,
            magicalProperties,
            cost: { ...base.cost, gp: goldValue },
            instanceId: `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        };
    }

    // ─── Jewelry Forging ─────────────────────────────────────────────

    static forgeJewelry(base: Item, level: number, rarity: Rarity, context: ForgeContext): Item {
        const tier = crToLevelTier(level);
        const bonuses = JEWELRY_BONUSES[tier][rarity];

        const statBonusVal = randomInRange(bonuses.statBonus[0], bonuses.statBonus[1]);
        const saveBonusVal = randomInRange(bonuses.saveBonus[0], bonuses.saveBonus[1]);
        const targetAbility = ABILITY_SCORES[Math.floor(Math.random() * ABILITY_SCORES.length)];

        const modifiers: { type: string; target: string; value: number }[] = [];
        if (statBonusVal > 0) modifiers.push({ type: 'StatBonus', target: targetAbility, value: statBonusVal });
        if (saveBonusVal > 0) modifiers.push({ type: 'SaveBonus', target: targetAbility, value: saveBonusVal });

        const magicalProperties: MagicalProperty[] = [];

        // Stat/save bonuses as magical properties for display
        if (statBonusVal > 0) {
            magicalProperties.push({
                type: 'StatBonus',
                value: statBonusVal,
                description: `+${statBonusVal} ${targetAbility}`,
            });
        }
        if (saveBonusVal > 0) {
            magicalProperties.push({
                type: 'SaveBonus',
                value: saveBonusVal,
                description: `+${saveBonusVal} to ${targetAbility} saving throws`,
            });
        }

        // Rare+ jewelry gets an additional magical trait
        const magicChance = MAGIC_CHANCE[rarity];
        if (Math.random() < magicChance) {
            const traitRoll = Math.random();
            if (traitRoll < 0.4) {
                // Resistance
                const element = this.rollElement(context.monsterType, context.biome);
                if (element) {
                    magicalProperties.push({
                        type: 'Resistance',
                        element,
                        description: `Resistance to ${element} damage`,
                    });
                    modifiers.push({ type: 'DamageResistance', target: element, value: 1 });
                }
            } else if (traitRoll < 0.7) {
                // Condition Immunity
                const conditions = JEWELRY_TRAIT_POOL.conditionImmunity.conditions;
                const condition = conditions[Math.floor(Math.random() * conditions.length)];
                magicalProperties.push({
                    type: 'ConditionImmunity',
                    description: `Immune to ${condition}`,
                });
            } else {
                // Spell Charge
                const spells = JEWELRY_TRAIT_POOL.spellCharge.spells;
                const spell = spells[Math.floor(Math.random() * spells.length)];
                const charges = rarity === 'Legendary' ? 5 : rarity === 'Very Rare' ? 3 : 1;
                magicalProperties.push({
                    type: 'SpellCharge',
                    spellName: spell,
                    maxCharges: charges,
                    description: `Cast ${spell} (${charges} charges per rest)`,
                });
            }
        }

        const isMagic = magicalProperties.length > 0;
        const name = this.generateDefaultName(base.name, rarity, 0, magicalProperties);
        const goldValue = (base.cost?.gp || 0) * RARITY_VALUE_MULTIPLIER[rarity];

        return {
            ...JSON.parse(JSON.stringify(base)),
            name,
            rarity,
            itemLevel: level,
            isMagic,
            isForged: true,
            forgeSource: `${context.monsterName} CR ${level} ${context.biome}`,
            modifiers,
            magicalProperties,
            cost: { ...base.cost, gp: goldValue },
            instanceId: `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        };
    }
}
