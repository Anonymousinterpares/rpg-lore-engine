import { z } from 'zod';
import { CurrencySchema, DamageTypeSchema, DiceRollSchema } from './BaseSchemas';

export const ItemTypeSchema = z.enum(['Weapon', 'Armor', 'Shield', 'Adventuring Gear', 'Tool', 'Misc', 'Magic Item', 'Spell Scroll']);

export const ModifierSchema = z.object({
    type: z.enum(['StatBonus', 'ACBonus', 'DamageAdd', 'AbilitySET', 'RangePenaltyReduction']),
    target: z.string(), // e.g., "AC", "STR", "Attack"
    value: z.number()
});

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
    quantity: z.number().default(1)
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
    SpellScrollSchema
]);

export type Item = z.infer<typeof ItemSchema>;
