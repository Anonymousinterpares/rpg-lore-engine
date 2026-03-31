/**
 * ForgeConfig.ts — All configuration tables for the ItemForgeEngine.
 *
 * Every number in this file is deterministic game data — the engine rolls
 * against these tables, the LLM never touches them.
 */

import { Rarity } from '../schemas/ItemSchema';

// ─── CR → Item Level Mapping ─────────────────────────────────────────

export function crToItemLevel(cr: number): number {
    return Math.max(1, Math.min(20, Math.ceil(cr) || 1));
}

export type LevelTier = '1-4' | '5-8' | '9-12' | '13-16' | '17-20';

export function crToLevelTier(cr: number): LevelTier {
    const level = crToItemLevel(cr);
    if (level <= 4) return '1-4';
    if (level <= 8) return '5-8';
    if (level <= 12) return '9-12';
    if (level <= 16) return '13-16';
    return '17-20';
}

// ─── Rarity Probability (CR-weighted) ────────────────────────────────

export const RARITY_WEIGHTS: Record<string, Record<Rarity, number>> = {
    'CR_0-1':   { Common: 70, Uncommon: 25, Rare: 5,  'Very Rare': 0, Legendary: 0 },
    'CR_2-4':   { Common: 50, Uncommon: 35, Rare: 12, 'Very Rare': 3, Legendary: 0 },
    'CR_5-8':   { Common: 25, Uncommon: 35, Rare: 25, 'Very Rare': 12, Legendary: 3 },
    'CR_9-12':  { Common: 10, Uncommon: 25, Rare: 35, 'Very Rare': 25, Legendary: 5 },
    'CR_13-16': { Common: 5,  Uncommon: 15, Rare: 30, 'Very Rare': 35, Legendary: 15 },
    'CR_17-20': { Common: 0,  Uncommon: 10, Rare: 25, 'Very Rare': 35, Legendary: 30 },
};

export function getCRBracket(cr: number): string {
    if (cr <= 1) return 'CR_0-1';
    if (cr <= 4) return 'CR_2-4';
    if (cr <= 8) return 'CR_5-8';
    if (cr <= 12) return 'CR_9-12';
    if (cr <= 16) return 'CR_13-16';
    return 'CR_17-20';
}

// ─── Magical Property Chance (by rarity) ─────────────────────────────

export const MAGIC_CHANCE: Record<Rarity, number> = {
    'Common':    0.00,   // NEVER magical
    'Uncommon':  0.15,   // 15% chance
    'Rare':      0.75,   // 75% chance
    'Very Rare': 1.00,   // Always magical
    'Legendary': 1.00,   // Always magical
};

// ─── Weapon Stat Bonus Tables (level tier × rarity) ──────────────────

export interface WeaponBonusEntry {
    hitBonus: [number, number];
    damageBonus: [number, number];
    bonusDamageDice: string | null;
}

export const WEAPON_BONUSES: Record<LevelTier, Record<Rarity, WeaponBonusEntry>> = {
    '1-4': {
        'Common':    { hitBonus: [0, 0], damageBonus: [0, 0], bonusDamageDice: null },
        'Uncommon':  { hitBonus: [1, 1], damageBonus: [0, 0], bonusDamageDice: null },
        'Rare':      { hitBonus: [1, 1], damageBonus: [0, 1], bonusDamageDice: '1d4' },
        'Very Rare': { hitBonus: [2, 2], damageBonus: [0, 1], bonusDamageDice: '1d4' },
        'Legendary': { hitBonus: [3, 3], damageBonus: [1, 2], bonusDamageDice: '1d6' },
    },
    '5-8': {
        'Common':    { hitBonus: [0, 0], damageBonus: [0, 0], bonusDamageDice: null },
        'Uncommon':  { hitBonus: [1, 1], damageBonus: [0, 1], bonusDamageDice: null },
        'Rare':      { hitBonus: [2, 2], damageBonus: [0, 1], bonusDamageDice: '1d4' },
        'Very Rare': { hitBonus: [2, 2], damageBonus: [1, 1], bonusDamageDice: '1d6' },
        'Legendary': { hitBonus: [3, 3], damageBonus: [1, 2], bonusDamageDice: '1d8' },
    },
    '9-12': {
        'Common':    { hitBonus: [1, 1], damageBonus: [0, 0], bonusDamageDice: null },
        'Uncommon':  { hitBonus: [1, 1], damageBonus: [0, 1], bonusDamageDice: null },
        'Rare':      { hitBonus: [2, 2], damageBonus: [1, 1], bonusDamageDice: '1d6' },
        'Very Rare': { hitBonus: [3, 3], damageBonus: [1, 1], bonusDamageDice: '1d6' },
        'Legendary': { hitBonus: [3, 3], damageBonus: [1, 2], bonusDamageDice: '1d10' },
    },
    '13-16': {
        'Common':    { hitBonus: [1, 1], damageBonus: [0, 0], bonusDamageDice: null },
        'Uncommon':  { hitBonus: [2, 2], damageBonus: [0, 1], bonusDamageDice: null },
        'Rare':      { hitBonus: [2, 2], damageBonus: [1, 1], bonusDamageDice: '1d8' },
        'Very Rare': { hitBonus: [3, 3], damageBonus: [1, 2], bonusDamageDice: '1d8' },
        'Legendary': { hitBonus: [3, 3], damageBonus: [2, 2], bonusDamageDice: '2d6' },
    },
    '17-20': {
        'Common':    { hitBonus: [1, 1], damageBonus: [0, 0], bonusDamageDice: null },
        'Uncommon':  { hitBonus: [2, 2], damageBonus: [0, 1], bonusDamageDice: null },
        'Rare':      { hitBonus: [3, 3], damageBonus: [1, 1], bonusDamageDice: '1d8' },
        'Very Rare': { hitBonus: [3, 3], damageBonus: [1, 2], bonusDamageDice: '1d10' },
        'Legendary': { hitBonus: [3, 3], damageBonus: [2, 3], bonusDamageDice: '2d8' },
    },
};

// ─── Armor Stat Bonus Tables ─────────────────────────────────────────

export interface ArmorBonusEntry {
    acBonus: [number, number];
}

export const ARMOR_BONUSES: Record<LevelTier, Record<Rarity, ArmorBonusEntry>> = {
    '1-4':   { Common: { acBonus: [0, 0] }, Uncommon: { acBonus: [1, 1] }, Rare: { acBonus: [1, 1] }, 'Very Rare': { acBonus: [2, 2] }, Legendary: { acBonus: [3, 3] } },
    '5-8':   { Common: { acBonus: [0, 0] }, Uncommon: { acBonus: [1, 1] }, Rare: { acBonus: [1, 2] }, 'Very Rare': { acBonus: [2, 2] }, Legendary: { acBonus: [3, 3] } },
    '9-12':  { Common: { acBonus: [0, 1] }, Uncommon: { acBonus: [1, 1] }, Rare: { acBonus: [2, 2] }, 'Very Rare': { acBonus: [2, 3] }, Legendary: { acBonus: [3, 3] } },
    '13-16': { Common: { acBonus: [0, 1] }, Uncommon: { acBonus: [1, 2] }, Rare: { acBonus: [2, 2] }, 'Very Rare': { acBonus: [3, 3] }, Legendary: { acBonus: [3, 3] } },
    '17-20': { Common: { acBonus: [0, 1] }, Uncommon: { acBonus: [1, 2] }, Rare: { acBonus: [2, 3] }, 'Very Rare': { acBonus: [3, 3] }, Legendary: { acBonus: [3, 3] } },
};

// ─── Jewelry Stat Bonus Tables ───────────────────────────────────────

export interface JewelryBonusEntry {
    statBonus: [number, number];
    saveBonus: [number, number];
}

export const JEWELRY_BONUSES: Record<LevelTier, Record<Rarity, JewelryBonusEntry>> = {
    '1-4':   { Common: { statBonus: [0, 0], saveBonus: [0, 0] }, Uncommon: { statBonus: [1, 1], saveBonus: [0, 0] }, Rare: { statBonus: [1, 1], saveBonus: [1, 1] }, 'Very Rare': { statBonus: [2, 2], saveBonus: [1, 1] }, Legendary: { statBonus: [2, 3], saveBonus: [1, 2] } },
    '5-8':   { Common: { statBonus: [0, 0], saveBonus: [0, 0] }, Uncommon: { statBonus: [1, 1], saveBonus: [0, 1] }, Rare: { statBonus: [1, 2], saveBonus: [1, 1] }, 'Very Rare': { statBonus: [2, 2], saveBonus: [1, 2] }, Legendary: { statBonus: [2, 3], saveBonus: [2, 2] } },
    '9-12':  { Common: { statBonus: [0, 1], saveBonus: [0, 0] }, Uncommon: { statBonus: [1, 1], saveBonus: [1, 1] }, Rare: { statBonus: [2, 2], saveBonus: [1, 1] }, 'Very Rare': { statBonus: [2, 3], saveBonus: [2, 2] }, Legendary: { statBonus: [3, 3], saveBonus: [2, 3] } },
    '13-16': { Common: { statBonus: [0, 1], saveBonus: [0, 0] }, Uncommon: { statBonus: [1, 2], saveBonus: [1, 1] }, Rare: { statBonus: [2, 2], saveBonus: [1, 2] }, 'Very Rare': { statBonus: [3, 3], saveBonus: [2, 2] }, Legendary: { statBonus: [3, 3], saveBonus: [2, 3] } },
    '17-20': { Common: { statBonus: [0, 1], saveBonus: [0, 1] }, Uncommon: { statBonus: [1, 2], saveBonus: [1, 1] }, Rare: { statBonus: [2, 3], saveBonus: [2, 2] }, 'Very Rare': { statBonus: [3, 3], saveBonus: [2, 3] }, Legendary: { statBonus: [3, 3], saveBonus: [3, 3] } },
};

// ─── Context-Aware Element Pools ─────────────────────────────────────

export const ELEMENT_POOLS: Record<string, string[]> = {
    'undead':      ['Necrotic', 'Cold', 'Radiant'],
    'fiend':       ['Fire', 'Necrotic', 'Poison'],
    'celestial':   ['Radiant', 'Force', 'Thunder'],
    'dragon':      ['Fire', 'Cold', 'Lightning', 'Acid', 'Poison'],
    'elemental':   ['Fire', 'Cold', 'Lightning', 'Thunder'],
    'fey':         ['Psychic', 'Radiant', 'Force'],
    'aberration':  ['Psychic', 'Force', 'Acid'],
    'construct':   ['Force', 'Lightning', 'Thunder'],
    'monstrosity': ['Poison', 'Acid'],
    'ooze':        ['Acid', 'Poison'],
    'plant':       ['Poison', 'Radiant'],
    'beast':       ['Poison'],
    'giant':       ['Cold', 'Thunder', 'Lightning'],
    'humanoid':    ['Fire', 'Cold', 'Lightning', 'Radiant', 'Necrotic', 'Poison', 'Acid'],
};

export const BIOME_ELEMENT_POOLS: Record<string, string[]> = {
    'Volcanic':  ['Fire'],
    'Tundra':    ['Cold', 'Thunder'],
    'Swamp':     ['Poison', 'Acid', 'Necrotic'],
    'Ruins':     ['Necrotic', 'Force', 'Radiant'],
    'Forest':    ['Poison', 'Lightning', 'Radiant'],
    'Desert':    ['Fire', 'Radiant'],
    'Mountain':  ['Cold', 'Lightning', 'Thunder'],
    'Ocean':     ['Cold', 'Lightning', 'Thunder'],
    'Coast':     ['Cold', 'Lightning'],
    'Jungle':    ['Poison', 'Acid'],
    'Plains':    ['Lightning', 'Radiant'],
    'Hills':     ['Thunder', 'Lightning'],
    'Urban':     ['Fire', 'Radiant', 'Force'],
    'Farmland':  ['Radiant'],
};

// ─── Jewelry Magical Trait Pool (Rare+) ──────────────────────────────

export const JEWELRY_TRAIT_POOL = {
    resistance: { type: 'Resistance' as const, description: 'Resistance to {element} damage' },
    conditionImmunity: {
        type: 'ConditionImmunity' as const,
        conditions: ['Frightened', 'Charmed', 'Poisoned'] as const,
    },
    spellCharge: {
        type: 'SpellCharge' as const,
        spells: ['Shield', 'Misty Step', 'Detect Magic', 'Feather Fall'] as const,
    },
};

// ─── Gold Value Multipliers ──────────────────────────────────────────

export const RARITY_VALUE_MULTIPLIER: Record<Rarity, number> = {
    'Common': 1,
    'Uncommon': 5,
    'Rare': 50,
    'Very Rare': 500,
    'Legendary': 5000,
};

// ─── Utility ─────────────────────────────────────────────────────────

export function randomInRange(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

export function averageDice(dice: string): number {
    const match = dice.match(/^(\d+)d(\d+)$/);
    if (!match) return 0;
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    return Math.floor(count * (sides + 1) / 2);
}
