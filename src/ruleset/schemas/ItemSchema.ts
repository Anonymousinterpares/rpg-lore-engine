import { z } from 'zod';
import { CurrencySchema, DamageTypeSchema, DiceRollSchema } from './BaseSchemas';

export const ItemTypeSchema = z.enum([
    'Weapon', 'Armor', 'Shield', 'Adventuring Gear', 'Tool', 'Misc', 'Magic Item', 'Spell Scroll',
    'Ring', 'Amulet', 'Cloak', 'Belt', 'Boots', 'Gloves', 'Bracers', 'Helmet', 'Ammunition'
]);

export const RaritySchema = z.enum(['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary']);
export type Rarity = z.infer<typeof RaritySchema>;

export const ModifierSchema = z.object({
    type: z.enum([
        'StatBonus', 'ACBonus', 'DamageAdd', 'AbilitySET', 'RangePenaltyReduction',
        'HitBonus',           // +X to attack rolls
        'SaveBonus',          // +X to saving throws
        'DamageResistance',   // Resistance to a damage type
    ]),
    target: z.string(), // e.g., "AC", "STR", "Attack", "Fire"
    value: z.number()
});

export const MagicalPropertySchema = z.object({
    type: z.enum([
        'BonusDamage',        // +Xd4 Fire/Cold/etc.
        'Resistance',          // Resistance to damage type
        'StatBonus',           // +X to ability score
        'SaveBonus',           // +X to saving throws
        'ConditionImmunity',   // Immune to Frightened, etc.
        'SpellCharge',         // Cast spell X times per rest
        'BonusAC',             // +X AC (jewelry/cloaks)
    ]),
    element: z.string().optional(),    // "Fire", "Necrotic", etc.
    value: z.number().optional(),      // Bonus amount or dice average
    dice: z.string().optional(),       // "1d4", "1d6" for variable bonuses
    spellName: z.string().optional(),  // For SpellCharge type
    maxCharges: z.number().optional(), // For SpellCharge type
    description: z.string().optional() // Flavor text for this property
});
export type MagicalProperty = z.infer<typeof MagicalPropertySchema>;

export const BaseItemSchema = z.object({
    id: z.string().optional(), // Populated by DataManager
    name: z.string(),
    type: ItemTypeSchema,
    cost: CurrencySchema,
    weight: z.number(), // in lbs
    description: z.string().optional(),
    isMagic: z.boolean().default(false),
    modifiers: z.array(ModifierSchema).default([]),
    tags: z.array(z.string()).default([]),
    charges: z.number().optional(),
    quantity: z.number().default(1),
    // ItemForge fields (all optional with defaults for backward compatibility)
    rarity: RaritySchema.default('Common'),
    itemLevel: z.number().min(1).max(20).default(1),
    isForged: z.boolean().default(false),
    forgeSource: z.string().optional(),              // e.g., "Skeleton CR 0.25 Ruins"
    magicalProperties: z.array(MagicalPropertySchema).default([]),
    instanceId: z.string().optional(),               // Unique per physical item in the world
    // Identification system
    identified: z.boolean().default(true),            // false = unidentified (Rare+ forged items)
    perceivedRarity: RaritySchema.optional(),         // what player sees before identification
    perceivedName: z.string().optional(),             // mechanical name shown before ID
    trueName: z.string().optional(),                  // LLM name, revealed on identification
    trueRarity: RaritySchema.optional(),              // actual rarity (stored when downgraded)
    identifiedBy: z.string().optional(),              // 'skill', 'spell', 'merchant'
    lore: z.string().optional(),                      // LLM-generated history, revealed on ID
});

export const WeaponSchema = BaseItemSchema.extend({
    type: z.literal('Weapon'),
    damage: z.object({
        dice: DiceRollSchema,
        type: DamageTypeSchema
    }),
    properties: z.array(z.string()), // e.g., "Finesse", "Heavy"
    range: z.object({
        normal: z.number(),
        long: z.number().optional()
    }).optional()
});

export const ArmorSchema = BaseItemSchema.extend({
    type: z.literal('Armor'),
    acCalculated: z.string(), // e.g., "11 + DEX", "18"
    strengthReq: z.number().default(0),
    stealthDisadvantage: z.boolean().default(false)
});

export const ShieldSchema = BaseItemSchema.extend({
    type: z.literal('Shield'),
    acBonus: z.number().default(2)
});

export const SpellScrollSchema = BaseItemSchema.extend({
    type: z.literal('Spell Scroll'),
    spellName: z.string(),
    spellLevel: z.number().min(0).max(9),
    consumedOnUse: z.boolean().default(true)
});

export const ItemSchema = z.discriminatedUnion('type', [
    WeaponSchema,
    ArmorSchema,
    ShieldSchema,
    BaseItemSchema.extend({ type: z.literal('Adventuring Gear') }),
    BaseItemSchema.extend({ type: z.literal('Tool') }),
    BaseItemSchema.extend({ type: z.literal('Misc') }),
    BaseItemSchema.extend({ type: z.literal('Magic Item') }),
    SpellScrollSchema,
    BaseItemSchema.extend({ type: z.literal('Ring') }),
    BaseItemSchema.extend({ type: z.literal('Amulet') }),
    BaseItemSchema.extend({ type: z.literal('Cloak') }),
    BaseItemSchema.extend({ type: z.literal('Belt') }),
    BaseItemSchema.extend({ type: z.literal('Boots') }),
    BaseItemSchema.extend({ type: z.literal('Gloves') }),
    BaseItemSchema.extend({ type: z.literal('Bracers') }),
    BaseItemSchema.extend({ type: z.literal('Helmet') }),
    BaseItemSchema.extend({ type: z.literal('Ammunition') }),
]);

export type Item = z.infer<typeof ItemSchema>;
