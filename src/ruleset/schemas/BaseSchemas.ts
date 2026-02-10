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
  'Sleight of Hand', 'Stealth', 'Survival', 'Unarmed Combat'
]);
export type SkillName = z.infer<typeof SkillNameSchema>;

export const WeatherTypeSchema = z.enum([
  'Clear', 'Rain', 'Storm', 'Fog', 'Snow', 'Blizzard'
]);
export type WeatherType = z.infer<typeof WeatherTypeSchema>;

export const WeatherSchema = z.object({
  type: WeatherTypeSchema,
  durationMinutes: z.number().default(0), // Minutes remaining for this weather
  intensity: z.number().default(1.0) // For future variation
});
export type Weather = z.infer<typeof WeatherSchema>;

export const TravelPaceSchema = z.enum([
  'Slow', 'Normal', 'Fast'
]);
export type TravelPace = z.infer<typeof TravelPaceSchema>;
