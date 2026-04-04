import { z } from 'zod';

/**
 * Basic D&D 5e primitive types to ensure consistency across the engine.
 */

export const AbilityScoreSchema = z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
export type AbilityScore = z.infer<typeof AbilityScoreSchema>;

export const CurrencySchema = z.object({
  cp: z.number().default(0),
  sp: z.number().default(0),
  ep: z.number().default(0),
  gp: z.number().default(0),
  pp: z.number().default(0)
});

export const DamageTypeSchema = z.enum([
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force',
  'Lightning', 'Necrotic', 'Piercing', 'Poison',
  'Psychic', 'Radiant', 'Slashing', 'Thunder', 'Healing'
]);
export type DamageType = z.infer<typeof DamageTypeSchema>;

export const DiceRollSchema = z.string().regex(/^(\d+)d(\d+)(?:\s*([-+]\s*)(\d+))?$/i, 'Invalid dice format (e.g., 1d8, 2d6+4)');
export type DiceRoll = z.infer<typeof DiceRollSchema>;

export const SizeSchema = z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']);
export type Size = z.infer<typeof SizeSchema>;

export const ScalingSchema = z.object({
  levels: z.array(z.number()),
  values: z.array(z.union([z.number(), DiceRollSchema]))
});

export const SkillNameSchema = z.enum([
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival', 'Unarmed Combat', 'Cartography'
]);
export type SkillName = z.infer<typeof SkillNameSchema>;

export const WeatherTypeSchema = z.enum([
  'Clear', 'Rain', 'Storm', 'Fog', 'Snow', 'Blizzard'
]);
export type WeatherType = z.infer<typeof WeatherTypeSchema>;

/**
 * Internal front simulation state. Optional so old saves deserialise without errors —
 * WeatherEngine.advanceFront() will bootstrap a new front on the first tick if absent.
 */
export const WeatherFrontSchema = z.object({
  category: z.enum(['Precipitation', 'Fog', 'Dry']),
  /** 0 = pre-front clear … 5 = peak … 7 = clearing (triggers new front roll) */
  phase: z.number().min(0).max(7).default(0),
  /** Minutes per phase step */
  velocity: z.number().default(120),
  /** 0.0 (arctic) – 1.0 (tropical). Season baseline + biome offset. */
  temperature: z.number().min(0).max(1).default(0.5),
  /** 0.0 (arid) – 1.0 (saturated) */
  moisture: z.number().min(0).max(1).default(0.4),
  trend: z.enum(['building', 'stable', 'clearing']).default('building'),
});

export const WeatherSchema = z.object({
  type: WeatherTypeSchema,
  durationMinutes: z.number().default(0),
  /** 0.0–1.0 continuous intensity — the primary driver for gameplay effects and display labels */
  intensity: z.number().min(0).max(1).default(0.0),
  /** Front simulation state. Absent on old saves; bootstrapped on first tick. */
  front: WeatherFrontSchema.optional(),
});
export type Weather = z.infer<typeof WeatherSchema>;

export const TravelPaceSchema = z.enum([
  'Cautious', 'Normal', 'Forced March', 'Stealth'
]);
export type TravelPace = z.infer<typeof TravelPaceSchema>;
