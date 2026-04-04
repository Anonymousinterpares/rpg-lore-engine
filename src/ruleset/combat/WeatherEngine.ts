import { Weather, WeatherType } from '../schemas/BaseSchemas';
import { WorldClock } from '../schemas/WorldClockSchema';
import { BiomeType } from '../schemas/BiomeSchema';

// ============================================================
// FRONT SYSTEM TYPES
// ============================================================

/** The broad meteorological category of a weather front */
export type WeatherCategory = 'Precipitation' | 'Fog' | 'Dry';

/** Trend direction as the front builds or dissipates */
export type WeatherTrend = 'building' | 'stable' | 'clearing';

/**
 * Internal front state — drives all weather simulation.
 * The `type` on the parent `Weather` object is DERIVED from this via range mapping.
 * Never mutate directly; always produce a new object.
 */
export interface WeatherFront {
    category: WeatherCategory;
    /**
     * 0 = pre-front clear
     * 1 = approaching (thin cloud / pressure drop)
     * 2 = onset (overcast / light precipitation)
     * 3 = moderate
     * 4 = heavy
     * 5 = peak intensity
     * 6 = clearing showers
     * 7 = clearing → triggers new front roll
     */
    phase: number;
    /** Minutes per phase step — how fast this front moves through its lifecycle */
    velocity: number;
    /** 0.0 (arctic cold) → 1.0 (tropical heat). Season baseline + biome offset. */
    temperature: number;
    /** 0.0 (arid) → 1.0 (saturated). Drives precipitation probability. */
    moisture: number;
    trend: WeatherTrend;
}

export interface WeatherEffect {
    type: WeatherType;
    narrative: string;
    /**
     * Mechanical modifiers keyed by effect name. Values are intensity-scaled.
     *
     * TODO (Sprint 2 — Modifier Wiring):
     * These modifiers are defined but NOT YET applied to dice rolls, movement, or combat.
     * Before wiring, conduct a full audit of: MechanicsEngine, CombatOrchestrator,
     * EncounterDirector, RestingEngine, DamageResolver, and any command handlers that
     * touch skill checks, attacks, or movement costs. The codebase has grown significantly
     * since these were written — undocumented callsites are likely. Each integration point
     * needs careful inspection to avoid unintended side-effects.
     */
    modifiers: Record<string, any>;
}

// ============================================================
// PHASE → INTENSITY CURVE
// ============================================================
// Index = phase (0–7). Gaussian noise applied on top during live ticks.
const PHASE_INTENSITY: readonly number[] = [
    0.00,  // 0: pre-front clear
    0.10,  // 1: approaching — thin cloud
    0.28,  // 2: overcast / light onset
    0.52,  // 3: moderate
    0.72,  // 4: heavy
    0.90,  // 5: peak
    0.48,  // 6: clearing showers
    0.10,  // 7: clearing out
];

// ============================================================
// BIOME TEMPERATURE OFFSETS  (added to seasonal baseline; clamped 0–1)
// ============================================================
const BIOME_TEMP_OFFSET: Partial<Record<BiomeType, number>> = {
    Mountain_High: -0.35,
    Tundra:        -0.40,
    Mountains:     -0.25,
    Coast_Cold:    -0.15,
    Hills:         -0.05,
    Forest:        -0.05,
    Plains:         0.00,
    Farmland:       0.00,
    Ruins:          0.00,
    Coast:          0.05,
    Ocean:          0.05,
    Urban:          0.05,  // heat-island effect
    Swamp:          0.10,
    Coast_Desert:   0.20,
    Jungle:         0.25,
    Volcanic:       0.30,
    Desert:         0.35,
};

// ============================================================
// BIOME MOISTURE MULTIPLIERS  (scales seasonal precipitation chance)
// ============================================================
const BIOME_MOISTURE_MULT: Partial<Record<BiomeType, number>> = {
    Desert:         0.10,
    Coast_Desert:   0.25,
    Volcanic:       0.70,
    Tundra:         0.70,
    Urban:          0.90,
    Plains:         1.00,
    Hills:          1.00,
    Farmland:       1.00,
    Ruins:          1.00,
    Forest:         1.10,
    Mountains:      1.20,
    Mountain_High:  1.15,
    Coast_Cold:     1.20,
    Coast:          1.30,
    Ocean:          1.50,
    Swamp:          1.50,
    Jungle:         2.00,
};

// ============================================================
// FRONT VELOCITY  [min, max] minutes per phase step
// ============================================================
const VELOCITY_RANGES: Record<string, [number, number]> = {
    summer_storm:  [45,  90],   // Fast convective cells
    winter_front:  [120, 360],  // Slow synoptic fronts, multi-day
    fog_front:     [60,  180],  // Variable — fog forms and burns off
    default:       [90,  240],
};

// Biome multiplier on computed velocity (< 1.0 = slower / blocking effect)
const BIOME_VELOCITY_MULT: Partial<Record<BiomeType, number>> = {
    Mountains:     0.60,
    Mountain_High: 0.50,
    Tundra:        0.70,
    Coast:         1.20,
    Ocean:         1.25,
    Desert:        1.30,
    Coast_Desert:  1.20,
};

// ============================================================
// ICON & LABEL THRESHOLDS
// ============================================================
const LIGHT_THRESHOLD  = 0.40;  // below = "light" variant
const HEAVY_THRESHOLD  = 0.80;  // above = "heavy" variant
const FOG_THICK        = 0.55;

export class WeatherEngine {

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    /**
     * Main tick entry point — replaces the old `generateWeather`.
     * Called every 30-minute interval by TimeManager.
     *
     * Advances the current front by one time-step. When a front completes
     * (phase > 7) a brand-new front is rolled using all available context.
     */
    public static advanceFront(
        clock: WorldClock,
        currentWeather: Weather,
        biome: BiomeType
    ): Weather {
        const front = currentWeather.front;

        // Bootstrap: old save with no front data — generate one immediately
        if (!front) {
            return this.generateFront(clock, biome, currentWeather);
        }

        // Still within the current phase — tick duration down, apply intensity noise
        const newDuration = currentWeather.durationMinutes - 30;
        if (newDuration > 0) {
            const intensity = this.calcIntensityWithNoise(front.phase);
            const type = this.deriveWeatherType(front, intensity);
            return { ...currentWeather, durationMinutes: newDuration, intensity, type };
        }

        // Phase boundary — advance to next phase
        const newPhase = front.phase + 1;

        // Front fully passed — roll a new one
        if (newPhase > 7) {
            return this.generateFront(clock, biome, currentWeather);
        }

        const newFront: WeatherFront = {
            ...front,
            phase: newPhase,
            trend: newPhase < 5 ? 'building' : newPhase === 5 ? 'stable' : 'clearing',
        };
        const intensity = this.calcIntensityWithNoise(newPhase);
        const type = this.deriveWeatherType(newFront, intensity);

        return {
            type,
            intensity,
            durationMinutes: front.velocity,
            front: newFront,
        };
    }

    /**
     * Generates a brand-new weather front.
     * Factors: season (month), biome, time of day, previous weather continuity.
     */
    public static generateFront(
        clock: WorldClock,
        biome: BiomeType,
        previousWeather?: Weather
    ): Weather {
        const seasonal  = this.getSeasonalBaseline(clock.month);
        const tempOff   = BIOME_TEMP_OFFSET[biome]     ?? 0;
        const moistMult = BIOME_MOISTURE_MULT[biome]   ?? 1.0;
        const todMods   = this.getTimeOfDayModifiers(clock.hour, clock.month);

        // Combined temperature (season baseline + biome offset), clamped
        const temperature = clamp01(seasonal.baseTemp + tempOff);

        // Moisture: seasonal precip chance × biome scale + small noise
        const moisture = clamp01(seasonal.precipChance * moistMult + jitter(0.06));

        // Continuity: previous front leaves residual probability
        const prevCategory = previousWeather?.front?.category;
        const precipBonus  = prevCategory === 'Precipitation' ? 0.15 : 0;
        const fogBonus     = todMods.fogBonus + (prevCategory === 'Fog' ? 0.10 : 0);

        // Category weights
        const wPrecip = moisture + precipBonus;
        const wFog    = clamp01(seasonal.fogChance + fogBonus);
        const wDry    = Math.max(0, 1.0 - wPrecip - wFog);
        const total   = wPrecip + wFog + wDry;

        const roll = Math.random() * total;
        let category: WeatherCategory;
        if      (roll < wPrecip)            category = 'Precipitation';
        else if (roll < wPrecip + wFog)     category = 'Fog';
        else                                category = 'Dry';

        // Cold residual carried from a blizzard into the next front
        const coldResidual = previousWeather?.type === 'Blizzard' ? -0.10 : 0;
        const frontTemp    = clamp01(temperature + coldResidual);

        const velocity = this.rollVelocity(clock.month, biome, category);

        const front: WeatherFront = {
            category,
            phase: 0,
            velocity,
            temperature: frontTemp,
            moisture,
            trend: 'building',
        };

        const intensity = this.calcIntensityWithNoise(0);
        const type      = this.deriveWeatherType(front, intensity);

        return { type, intensity, durationMinutes: velocity, front };
    }

    /**
     * Canonical range mapping: (category + temperature + intensity) → WeatherType.
     * This keeps the existing WeatherType enum untouched and all downstream
     * callsites working without modification.
     *
     * Intensity thresholds:
     *   Precipitation (warm):  < 0.22 → Clear, 0.22–0.62 → Rain, > 0.62 → Storm
     *   Precipitation (cold):  < 0.22 → Clear, 0.22–0.62 → Snow, > 0.62 → Blizzard
     *   Fog:                   < 0.30 → Clear, ≥ 0.30     → Fog
     *   Dry:                   any    → Clear
     */
    public static deriveWeatherType(front: WeatherFront, intensity: number): WeatherType {
        const { category, temperature } = front;

        if (category === 'Dry') return 'Clear';

        if (category === 'Fog') {
            return intensity >= 0.30 ? 'Fog' : 'Clear';
        }

        // Precipitation — cold vs warm split at 0.35
        if (temperature < 0.35) {
            if (intensity >= 0.62) return 'Blizzard';
            if (intensity >= 0.22) return 'Snow';
            return 'Clear'; // flurries below threshold
        } else {
            if (intensity >= 0.62) return 'Storm';
            if (intensity >= 0.22) return 'Rain';
            return 'Clear'; // light drizzle below threshold
        }
    }

    /**
     * Returns the icon filename key (without extension) for the current weather.
     * Assets must exist at:  /assets/weather/{key}.png
     *
     * Full naming scheme:
     *   clear           — pure clear sky (phase 0 or stable dry front)
     *   clear_cloudy    — clear but with approaching/clearing cloud cover (phase 1, 2, or 7)
     *   rain_light      — Rain, intensity < 0.40
     *   rain            — Rain, intensity 0.40–0.62
     *   storm           — Storm, intensity 0.62–0.80
     *   storm_heavy     — Storm, intensity > 0.80
     *   fog_light       — Fog (Mist), intensity < 0.55
     *   fog             — Fog (Thick), intensity ≥ 0.55
     *   snow_light      — Snow, intensity < 0.40
     *   snow            — Snow, intensity 0.40–0.62
     *   blizzard        — Blizzard, intensity 0.62–0.80
     *   blizzard_heavy  — Blizzard, intensity > 0.80
     */
    public static getWeatherIconKey(weather: Weather): string {
        const { type, intensity, front } = weather;

        switch (type) {
            case 'Clear':
                if (front && (front.phase === 1 || front.phase === 2 || front.phase === 7)) {
                    return 'clear_cloudy';
                }
                return 'clear';

            case 'Rain':
                return intensity < LIGHT_THRESHOLD ? 'rain_light' : 'rain';

            case 'Storm':
                return intensity >= HEAVY_THRESHOLD ? 'storm_heavy' : 'storm';

            case 'Fog':
                return intensity < FOG_THICK ? 'fog_light' : 'fog';

            case 'Snow':
                return intensity < LIGHT_THRESHOLD ? 'snow_light' : 'snow';

            case 'Blizzard':
                return intensity >= HEAVY_THRESHOLD ? 'blizzard_heavy' : 'blizzard';

            default:
                return 'clear';
        }
    }

    /**
     * Human-readable, intensity-qualified weather label for display.
     * Examples: "Drizzle", "Light Rain", "Rain", "Storm", "Violent Storm",
     *           "Mist", "Thick Fog", "Light Snow", "Snow", "Heavy Snow", "Blizzard"
     */
    public static getIntensityLabel(weather: Weather): string {
        const { type, intensity, front } = weather;

        switch (type) {
            case 'Clear':
                if (front?.phase === 1 || front?.phase === 2) return 'Overcast';
                if (front?.phase === 7)                       return 'Clearing';
                return 'Clear';

            case 'Rain':
                if (intensity < 0.32)          return 'Drizzle';
                if (intensity < LIGHT_THRESHOLD) return 'Light Rain';
                return 'Rain';

            case 'Storm':
                return intensity >= HEAVY_THRESHOLD ? 'Violent Storm' : 'Storm';

            case 'Fog':
                return intensity < FOG_THICK ? 'Mist' : 'Thick Fog';

            case 'Snow':
                if (intensity < 0.32)          return 'Flurries';
                if (intensity < LIGHT_THRESHOLD) return 'Light Snow';
                return 'Snow';

            case 'Blizzard':
                return intensity >= HEAVY_THRESHOLD ? 'Blizzard' : 'Heavy Snow';

            default:
                return type;
        }
    }

    /**
     * Returns mechanical modifiers for the current weather, intensity-scaled.
     *
     * TODO (Sprint 2 — Modifier Wiring):
     * These modifiers are defined but NOT YET applied to dice rolls, movement, or combat.
     * Before wiring, conduct a full audit of: MechanicsEngine, CombatOrchestrator,
     * EncounterDirector, RestingEngine, DamageResolver, and any command handlers that
     * touch skill checks, attacks, or movement. The system has grown significantly —
     * undocumented callsites are likely. Each integration point needs careful
     * inspection to avoid unintended side-effects on existing mechanics.
     */
    public static getWeatherEffects(weather: Weather): WeatherEffect {
        const { type, intensity } = weather;

        switch (type) {
            case 'Rain':
                return {
                    type,
                    narrative: intensity < LIGHT_THRESHOLD
                        ? "A light drizzle patters against the leaves."
                        : "Gray sheets of rain blur the world. Sounds are muffled.",
                    modifiers: {
                        perceptionHearing: intensity >= LIGHT_THRESHOLD ? 'disadvantage' : null,
                        fireResistance: intensity >= 0.30,
                    },
                };

            case 'Storm':
                return {
                    type,
                    narrative: intensity >= HEAVY_THRESHOLD
                        ? "Lightning tears the sky. The howling wind makes even speech impossible."
                        : "Thunder rolls across the heavens. Flashes of lightning illuminate the dark clouds.",
                    modifiers: {
                        stealthBonus:            Math.round(intensity * 3),   // 0–3
                        passivePerceptionPenalty: Math.round(intensity * 3),   // 0–3
                        lightningHazard:          intensity * 0.015,           // 0–1.5% per tick
                    },
                };

            case 'Fog':
                return {
                    type,
                    narrative: intensity < FOG_THICK
                        ? "A thin mist hangs in the air, softening edges without truly obscuring."
                        : "A thick, cold mist clings to the ground, obscuring everything beyond a few paces.",
                    modifiers: {
                        heavilyObscured:  intensity >= FOG_THICK,
                        attackRangeLimit: Math.round(5 + (1 - intensity) * 10), // 5–15 squares
                    },
                };

            case 'Snow':
                return {
                    type,
                    narrative: intensity < LIGHT_THRESHOLD
                        ? "Light snowflakes drift lazily from a pewter sky."
                        : "Soft white flakes drift from a leaden sky, blanketing the ground.",
                    modifiers: {
                        difficultTerrain: intensity >= 0.35,
                        visibilityLimit:  Math.round(50 - intensity * 25), // 25–50 squares
                    },
                };

            case 'Blizzard':
                return {
                    type,
                    narrative: intensity >= HEAVY_THRESHOLD
                        ? "A howling whiteout. The wind bites through armor and bone alike."
                        : "Heavy snow and wind limit vision and drag at every step.",
                    modifiers: {
                        difficultTerrain: true,
                        visibilityLimit:  Math.round(18 - intensity * 8), // 10–18 squares
                        exhaustionRisk:   intensity >= 0.72,
                    },
                };

            default:
                return {
                    type: 'Clear',
                    narrative: "The sky is clear and the air is steady.",
                    modifiers: {},
                };
        }
    }

    // ----------------------------------------------------------
    // SEASONAL & ENVIRONMENTAL BASELINES  (public for testing)
    // ----------------------------------------------------------

    /**
     * Season baseline for a given month.
     * Follows the Forgotten Realms northern-hemisphere calendar.
     */
    public static getSeasonalBaseline(month: number): {
        baseTemp: number;
        precipChance: number;
        fogChance: number;
    } {
        const table: Record<number, { baseTemp: number; precipChance: number; fogChance: number }> = {
            1:  { baseTemp: 0.15, precipChance: 0.38, fogChance: 0.08 }, // Hammer
            2:  { baseTemp: 0.20, precipChance: 0.40, fogChance: 0.08 }, // Alturiak
            3:  { baseTemp: 0.35, precipChance: 0.48, fogChance: 0.14 }, // Ches
            4:  { baseTemp: 0.50, precipChance: 0.52, fogChance: 0.18 }, // Tarsakh
            5:  { baseTemp: 0.65, precipChance: 0.50, fogChance: 0.14 }, // Mirtul
            6:  { baseTemp: 0.75, precipChance: 0.36, fogChance: 0.06 }, // Kythorn
            7:  { baseTemp: 0.85, precipChance: 0.32, fogChance: 0.05 }, // Flamerule (Summertide)
            8:  { baseTemp: 0.80, precipChance: 0.34, fogChance: 0.07 }, // Eleasis
            9:  { baseTemp: 0.65, precipChance: 0.44, fogChance: 0.18 }, // Eleint
            10: { baseTemp: 0.50, precipChance: 0.48, fogChance: 0.20 }, // Marpenoth
            11: { baseTemp: 0.30, precipChance: 0.44, fogChance: 0.16 }, // Uktar
            12: { baseTemp: 0.15, precipChance: 0.40, fogChance: 0.10 }, // Nightal
        };
        return table[month] ?? { baseTemp: 0.50, precipChance: 0.40, fogChance: 0.12 };
    }

    /**
     * Time-of-day adjustments to front category weights.
     * Morning fog, afternoon convective storms, night fog / storm dissipation.
     */
    public static getTimeOfDayModifiers(
        hour: number,
        month: number
    ): { fogBonus: number; stormBonus: number } {
        const isSummer      = month >= 6 && month <= 8;
        const isAutumnSpring = [3, 4, 5, 9, 10, 11].includes(month);

        if (hour >= 5 && hour < 10) {
            // Early morning — fog prone
            return { fogBonus: isAutumnSpring ? 0.22 : 0.10, stormBonus: 0 };
        }
        if (hour >= 12 && hour < 18) {
            // Afternoon — convective cells in summer
            return { fogBonus: -0.15, stormBonus: isSummer ? 0.20 : 0.05 };
        }
        if (hour >= 21 || hour < 5) {
            // Night — fog builds, storms dissipate
            return { fogBonus: 0.15, stormBonus: -0.15 };
        }
        return { fogBonus: 0, stormBonus: 0 };
    }

    // ----------------------------------------------------------
    // PRIVATE HELPERS
    // ----------------------------------------------------------

    /** Applies small Gaussian-like noise (±0.04) to a phase intensity. */
    private static calcIntensityWithNoise(phase: number): number {
        const base = PHASE_INTENSITY[phase] ?? 0;
        return clamp01(base + jitter(0.04));
    }

    /** Rolls front velocity (minutes per phase step) based on season, biome, and category. */
    private static rollVelocity(
        month: number,
        biome: BiomeType,
        category: WeatherCategory
    ): number {
        const isSummer = month >= 6 && month <= 8;
        const isWinter = month === 11 || month === 12 || month === 1 || month === 2;

        let [min, max] = VELOCITY_RANGES.default;
        if (category === 'Fog')    [min, max] = VELOCITY_RANGES.fog_front;
        else if (isWinter)         [min, max] = VELOCITY_RANGES.winter_front;
        else if (isSummer)         [min, max] = VELOCITY_RANGES.summer_storm;

        const raw  = min + Math.random() * (max - min);
        const mult = BIOME_VELOCITY_MULT[biome] ?? 1.0;
        return Math.max(30, Math.round(raw * mult)); // minimum 30-minute phase
    }
}

// ----------------------------------------------------------
// MODULE-LEVEL UTILITIES
// ----------------------------------------------------------

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

/** Symmetric random jitter in range [-amplitude, +amplitude] */
function jitter(amplitude: number): number {
    return (Math.random() - 0.5) * 2 * amplitude;
}
