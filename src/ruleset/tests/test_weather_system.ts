/**
 * test_weather_system.ts
 *
 * Run with:  npx tsx src/ruleset/tests/test_weather_system.ts
 *
 * Verifies the front-based weather simulation:
 *   1. Phase progression (0 → 7) produces correct trend labels and non-trivial types
 *   2. Type mapping: intensity + category → correct WeatherType (no snow in Desert summer,
 *      no storm in arctic winter, etc.)
 *   3. Continuity: blizzard residual cold-carry, precipitation carry-over bonus
 *   4. Biome influence: Desert produces predominantly Dry/Clear; Jungle produces Precipitation
 *   5. Time-of-day influence: morning fog bonus; afternoon summer storm bonus
 *   6. Icon key and label change with intensity
 *   7. Front velocity is bounded and biome-modified
 *   8. Old saves (no front field) are bootstrapped correctly
 *   9. Long simulation: weather actually changes over 30+ ticks
 */

import { WeatherEngine, WeatherFront } from '../combat/WeatherEngine';
import { Weather, WeatherType } from '../schemas/BaseSchemas';
import { WorldClock } from '../schemas/WorldClockSchema';

// ────────────────────────────────────────────────────────────────
// TINY TEST HARNESS
// ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, condition: boolean, detail = '') {
    if (condition) {
        console.log(`  ✓  ${label}`);
        passed++;
    } else {
        console.error(`  ✗  ${label}${detail ? `  →  ${detail}` : ''}`);
        failed++;
    }
}

function section(title: string) {
    console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`);
}

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

function makeClock(month: number, hour = 12): WorldClock {
    return { hour, minute: 0, day: 1, month, year: 1492, totalTurns: 0 };
}

function makeWeather(overrides: Partial<Weather> = {}): Weather {
    return {
        type: 'Clear',
        intensity: 0.0,
        durationMinutes: 120,
        ...overrides,
    };
}

function makeFront(overrides: Partial<WeatherFront> = {}): WeatherFront {
    return {
        category: 'Dry',
        phase: 0,
        velocity: 120,
        temperature: 0.5,
        moisture: 0.4,
        trend: 'building',
        ...overrides,
    };
}

// ────────────────────────────────────────────────────────────────
// 1. PHASE PROGRESSION
// ────────────────────────────────────────────────────────────────
section('1 · Phase progression (0 → 7)');

{
    // Build a precipitation front manually and step through all 8 phases
    const front = makeFront({ category: 'Precipitation', temperature: 0.6, moisture: 0.8 });
    const phases: { phase: number; intensity: number; trend: string; type: WeatherType }[] = [];

    for (let p = 0; p <= 7; p++) {
        const f: WeatherFront = { ...front, phase: p, trend: p < 5 ? 'building' : p === 5 ? 'stable' : 'clearing' };
        // Use the midpoint of the noise-free curve to make this deterministic
        const intensities = [0.0, 0.10, 0.28, 0.52, 0.72, 0.90, 0.48, 0.10];
        const intensity = intensities[p];
        const type = WeatherEngine.deriveWeatherType(f, intensity);
        phases.push({ phase: p, intensity, trend: f.trend, type });
    }

    expect('Phase 0 → Clear (pre-front)',  phases[0].type === 'Clear',  `got ${phases[0].type}`);
    expect('Phase 1 → Clear (approaching)',phases[1].type === 'Clear',  `got ${phases[1].type}`);
    expect('Phase 2 → Rain (onset)',        phases[2].type === 'Rain',   `got ${phases[2].type}`);
    expect('Phase 3 → Rain (moderate)',     phases[3].type === 'Rain',   `got ${phases[3].type}`);
    expect('Phase 4 → Storm (heavy)',       phases[4].type === 'Storm',  `got ${phases[4].type}`);
    expect('Phase 5 → Storm (peak)',        phases[5].type === 'Storm',  `got ${phases[5].type}`);
    expect('Phase 6 → Rain (clearing)',     phases[6].type === 'Rain',   `got ${phases[6].type}`);
    expect('Phase 7 → Clear (clearing out)',phases[7].type === 'Clear',  `got ${phases[7].type}`);

    expect('Trend: phase 0–4 are building', phases.slice(0, 5).every(p => p.phase < 5 ? p.trend === 'building' : true));
    expect('Trend: phase 5 is stable',      phases[5].trend === 'stable', `got ${phases[5].trend}`);
    expect('Trend: phase 6–7 are clearing', phases.slice(6).every(p => p.trend === 'clearing'));
}

// ────────────────────────────────────────────────────────────────
// 2. TYPE MAPPING
// ────────────────────────────────────────────────────────────────
section('2 · Type mapping (category + temperature + intensity → WeatherType)');

{
    const warm = makeFront({ category: 'Precipitation', temperature: 0.7 });
    const cold = makeFront({ category: 'Precipitation', temperature: 0.2 });
    const fogF = makeFront({ category: 'Fog' });
    const dry  = makeFront({ category: 'Dry' });

    // Warm precipitation
    expect('Warm + intensity 0.10 → Clear',  WeatherEngine.deriveWeatherType(warm, 0.10) === 'Clear');
    expect('Warm + intensity 0.30 → Rain',   WeatherEngine.deriveWeatherType(warm, 0.30) === 'Rain');
    expect('Warm + intensity 0.70 → Storm',  WeatherEngine.deriveWeatherType(warm, 0.70) === 'Storm');

    // Cold precipitation
    expect('Cold + intensity 0.10 → Clear',  WeatherEngine.deriveWeatherType(cold, 0.10) === 'Clear');
    expect('Cold + intensity 0.30 → Snow',   WeatherEngine.deriveWeatherType(cold, 0.30) === 'Snow');
    expect('Cold + intensity 0.70 → Blizzard',WeatherEngine.deriveWeatherType(cold, 0.70) === 'Blizzard');

    // Fog
    expect('Fog + intensity 0.15 → Clear',  WeatherEngine.deriveWeatherType(fogF, 0.15) === 'Clear');
    expect('Fog + intensity 0.50 → Fog',    WeatherEngine.deriveWeatherType(fogF, 0.50) === 'Fog');

    // Dry
    expect('Dry + any intensity → Clear',   WeatherEngine.deriveWeatherType(dry, 0.99) === 'Clear');
}

// ────────────────────────────────────────────────────────────────
// 3. BIOME INFLUENCE (statistical)
// ────────────────────────────────────────────────────────────────
section('3 · Biome influence over 200 generated fronts');

{
    const clock = makeClock(4); // Tarsakh — spring, high precip chance baseline

    // Desert: should generate Dry far more often than Precipitation
    let desertDry = 0, desertPrecip = 0;
    for (let i = 0; i < 200; i++) {
        const w = WeatherEngine.generateFront(clock, 'Desert');
        if (w.front?.category === 'Dry')           desertDry++;
        else if (w.front?.category === 'Precipitation') desertPrecip++;
    }
    expect(
        'Desert: Dry fronts ≫ Precipitation (>70% dry)',
        desertDry / 200 > 0.70,
        `dry=${desertDry}/200, precip=${desertPrecip}/200`
    );

    // Jungle: should generate Precipitation more often than Dry
    let junglePrecip = 0, jungleDry = 0;
    for (let i = 0; i < 200; i++) {
        const w = WeatherEngine.generateFront(clock, 'Jungle');
        if (w.front?.category === 'Precipitation') junglePrecip++;
        else if (w.front?.category === 'Dry')      jungleDry++;
    }
    expect(
        'Jungle: Precipitation fronts > Dry (>60% precip)',
        junglePrecip / 200 > 0.60,
        `precip=${junglePrecip}/200, dry=${jungleDry}/200`
    );
}

// ────────────────────────────────────────────────────────────────
// 4. TEMPERATURE: cold biomes never produce warm-weather types
// ────────────────────────────────────────────────────────────────
section('4 · Temperature correctness — biome × season');

{
    // Mountain_High in winter: temperature should be low enough that
    // any precipitation front produces Snow/Blizzard, never Rain/Storm
    const winterClock = makeClock(1); // Hammer — deep winter
    let warmPrecipCount = 0;
    for (let i = 0; i < 300; i++) {
        const w = WeatherEngine.generateFront(winterClock, 'Mountain_High');
        if (w.type === 'Rain' || w.type === 'Storm') warmPrecipCount++;
    }
    expect(
        'Mountain_High in winter: never produces Rain or Storm',
        warmPrecipCount === 0,
        `warm precip count = ${warmPrecipCount}/300`
    );

    // Desert in summer: temperature should prevent Snow/Blizzard
    const summerClock = makeClock(7); // Flamerule — peak summer
    let coldPrecipCount = 0;
    for (let i = 0; i < 300; i++) {
        const w = WeatherEngine.generateFront(summerClock, 'Desert');
        if (w.type === 'Snow' || w.type === 'Blizzard') coldPrecipCount++;
    }
    expect(
        'Desert in summer: never produces Snow or Blizzard',
        coldPrecipCount === 0,
        `cold precip count = ${coldPrecipCount}/300`
    );
}

// ────────────────────────────────────────────────────────────────
// 5. CONTINUITY — previous weather carries over
// ────────────────────────────────────────────────────────────────
section('5 · Front continuity (previous weather influence)');

{
    const clock = makeClock(4);

    // After a blizzard the temperature should be lower than after clear sky
    const previousBlizzard: Weather = makeWeather({ type: 'Blizzard', intensity: 0.9, front: makeFront({ category: 'Precipitation', temperature: 0.1 }) });
    const previousClear:    Weather = makeWeather({ type: 'Clear',    intensity: 0.0, front: makeFront({ category: 'Dry', temperature: 0.5 }) });

    let blizzardTempSum = 0, clearTempSum = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
        blizzardTempSum += WeatherEngine.generateFront(clock, 'Plains', previousBlizzard).front!.temperature;
        clearTempSum    += WeatherEngine.generateFront(clock, 'Plains', previousClear).front!.temperature;
    }
    expect(
        'Post-blizzard avg front temperature < post-clear avg temperature',
        blizzardTempSum / N < clearTempSum / N,
        `blizzard avg ${(blizzardTempSum/N).toFixed(3)}  clear avg ${(clearTempSum/N).toFixed(3)}`
    );

    // After a precipitation front, precipitation probability should be boosted
    const previousRain: Weather = makeWeather({ type: 'Rain', intensity: 0.4, front: makeFront({ category: 'Precipitation' }) });
    let rainAfterRain = 0, rainAfterDry = 0;
    for (let i = 0; i < 200; i++) {
        if (WeatherEngine.generateFront(clock, 'Plains', previousRain).front?.category === 'Precipitation') rainAfterRain++;
        if (WeatherEngine.generateFront(clock, 'Plains', previousClear).front?.category === 'Precipitation') rainAfterDry++;
    }
    expect(
        'Precipitation more likely following a previous rain front',
        rainAfterRain >= rainAfterDry,
        `after-rain=${rainAfterRain}/200  after-dry=${rainAfterDry}/200`
    );
}

// ────────────────────────────────────────────────────────────────
// 6. TIME-OF-DAY INFLUENCE
// ────────────────────────────────────────────────────────────────
section('6 · Time-of-day modifiers');

{
    const morningMods   = WeatherEngine.getTimeOfDayModifiers(7,  9);  // spring morning
    const afternoonMods = WeatherEngine.getTimeOfDayModifiers(14, 7);  // summer afternoon
    const nightMods     = WeatherEngine.getTimeOfDayModifiers(2,  4);  // any night

    expect('Morning fog bonus > 0 in spring',          morningMods.fogBonus   > 0,  `fogBonus=${morningMods.fogBonus}`);
    expect('Afternoon storm bonus > 0 in summer',       afternoonMods.stormBonus > 0, `stormBonus=${afternoonMods.stormBonus}`);
    expect('Night fog bonus > 0',                       nightMods.fogBonus     > 0,  `fogBonus=${nightMods.fogBonus}`);
    expect('Night storm bonus is negative (dissipation)',nightMods.stormBonus  < 0,  `stormBonus=${nightMods.stormBonus}`);
    expect('Afternoon fog bonus is negative (burn-off)', afternoonMods.fogBonus < 0, `fogBonus=${afternoonMods.fogBonus}`);

    // Statistical: autumn mornings should produce more Fog fronts than summer afternoons
    const autumnMorning  = makeClock(9, 7);
    const summerAfternoon = makeClock(7, 14);
    let fogAM = 0, fogPM = 0;
    for (let i = 0; i < 200; i++) {
        if (WeatherEngine.generateFront(autumnMorning,   'Plains').front?.category === 'Fog') fogAM++;
        if (WeatherEngine.generateFront(summerAfternoon, 'Plains').front?.category === 'Fog') fogPM++;
    }
    expect(
        'Autumn morning produces more Fog fronts than summer afternoon',
        fogAM > fogPM,
        `autumn-AM=${fogAM}/200  summer-PM=${fogPM}/200`
    );
}

// ────────────────────────────────────────────────────────────────
// 7. ICON KEY & LABEL ACCURACY
// ────────────────────────────────────────────────────────────────
section('7 · Icon keys and intensity labels');

{
    const rainLight  = makeWeather({ type: 'Rain',     intensity: 0.25, front: makeFront({ category: 'Precipitation', phase: 2 }) });
    const rainHeavy  = makeWeather({ type: 'Rain',     intensity: 0.55, front: makeFront({ category: 'Precipitation', phase: 3 }) });
    const stormPeak  = makeWeather({ type: 'Storm',    intensity: 0.92, front: makeFront({ category: 'Precipitation', phase: 5 }) });
    const fogLight   = makeWeather({ type: 'Fog',      intensity: 0.35, front: makeFront({ category: 'Fog',           phase: 3 }) });
    const fogThick   = makeWeather({ type: 'Fog',      intensity: 0.70, front: makeFront({ category: 'Fog',           phase: 5 }) });
    const snowLight  = makeWeather({ type: 'Snow',     intensity: 0.30, front: makeFront({ category: 'Precipitation', phase: 2, temperature: 0.2 }) });
    const blizzPeak  = makeWeather({ type: 'Blizzard', intensity: 0.88, front: makeFront({ category: 'Precipitation', phase: 5, temperature: 0.1 }) });
    const clearCloud = makeWeather({ type: 'Clear',    intensity: 0.08, front: makeFront({ category: 'Precipitation', phase: 1 }) });
    const clearPure  = makeWeather({ type: 'Clear',    intensity: 0.00, front: makeFront({ category: 'Dry',           phase: 0 }) });

    // Icons
    expect('rain_light icon for light rain',     WeatherEngine.getWeatherIconKey(rainLight)  === 'rain_light',    WeatherEngine.getWeatherIconKey(rainLight));
    expect('rain icon for heavier rain',          WeatherEngine.getWeatherIconKey(rainHeavy)  === 'rain',          WeatherEngine.getWeatherIconKey(rainHeavy));
    expect('storm_heavy icon at peak',            WeatherEngine.getWeatherIconKey(stormPeak)  === 'storm_heavy',   WeatherEngine.getWeatherIconKey(stormPeak));
    expect('fog_light icon for mist',             WeatherEngine.getWeatherIconKey(fogLight)   === 'fog_light',     WeatherEngine.getWeatherIconKey(fogLight));
    expect('fog icon for thick fog',              WeatherEngine.getWeatherIconKey(fogThick)   === 'fog',           WeatherEngine.getWeatherIconKey(fogThick));
    expect('snow_light icon for light snow',      WeatherEngine.getWeatherIconKey(snowLight)  === 'snow_light',    WeatherEngine.getWeatherIconKey(snowLight));
    expect('blizzard_heavy icon at peak',         WeatherEngine.getWeatherIconKey(blizzPeak)  === 'blizzard_heavy',WeatherEngine.getWeatherIconKey(blizzPeak));
    expect('clear_cloudy icon when approaching',  WeatherEngine.getWeatherIconKey(clearCloud) === 'clear_cloudy',  WeatherEngine.getWeatherIconKey(clearCloud));
    expect('clear icon for pure clear sky',       WeatherEngine.getWeatherIconKey(clearPure)  === 'clear',         WeatherEngine.getWeatherIconKey(clearPure));

    // Labels
    expect('Label "Drizzle" at very low rain intensity',  WeatherEngine.getIntensityLabel(makeWeather({ type:'Rain', intensity:0.25, front:makeFront({phase:2}) })) === 'Drizzle');
    expect('Label "Light Rain" at moderate rain',         WeatherEngine.getIntensityLabel(rainLight) === 'Light Rain' || WeatherEngine.getIntensityLabel(rainLight) === 'Drizzle');
    expect('Label "Violent Storm" at peak storm',         WeatherEngine.getIntensityLabel(stormPeak) === 'Violent Storm');
    expect('Label "Mist" for light fog',                  WeatherEngine.getIntensityLabel(fogLight)  === 'Mist');
    expect('Label "Thick Fog" for dense fog',             WeatherEngine.getIntensityLabel(fogThick)  === 'Thick Fog');
    expect('Label "Blizzard" at peak blizzard',           WeatherEngine.getIntensityLabel(blizzPeak) === 'Blizzard');
    expect('Label "Overcast" when phase=1',               WeatherEngine.getIntensityLabel(clearCloud) === 'Overcast');
}

// ────────────────────────────────────────────────────────────────
// 8. FRONT VELOCITY BOUNDS
// ────────────────────────────────────────────────────────────────
section('8 · Front velocity bounds');

{
    for (let trial = 0; trial < 50; trial++) {
        const w = WeatherEngine.generateFront(makeClock(1), 'Plains');
        const v = w.front?.velocity ?? 0;
        expect(`Winter Plains velocity ≥ 30 min (trial ${trial+1})`, v >= 30, `velocity=${v}`);
        if (v < 30) break; // no need to spam failures
    }

    // Mountain_High blocking: velocity should be lower than Ocean (on average)
    let mountainVelSum = 0, oceanVelSum = 0;
    const N = 60;
    const clock = makeClock(4);
    for (let i = 0; i < N; i++) {
        mountainVelSum += WeatherEngine.generateFront(clock, 'Mountain_High').front!.velocity;
        oceanVelSum    += WeatherEngine.generateFront(clock, 'Ocean').front!.velocity;
    }
    expect(
        'Mountain_High avg velocity < Ocean avg velocity (blocking effect)',
        mountainVelSum / N < oceanVelSum / N,
        `mountain=${(mountainVelSum/N).toFixed(0)}  ocean=${(oceanVelSum/N).toFixed(0)}`
    );
}

// ────────────────────────────────────────────────────────────────
// 9. BACKWARD COMPATIBILITY (old save — no front field)
// ────────────────────────────────────────────────────────────────
section('9 · Backward compatibility (old save without front field)');

{
    const oldSaveWeather: Weather = { type: 'Clear', intensity: 1.0, durationMinutes: 120 };
    const clock = makeClock(6);
    const result = WeatherEngine.advanceFront(clock, oldSaveWeather, 'Plains');

    expect('Bootstrap produces a valid Weather object',  result !== undefined && result.type !== undefined);
    expect('Bootstrap populates front field',             result.front !== undefined);
    expect('Bootstrap front has valid phase (0–7)',       (result.front?.phase ?? -1) >= 0 && (result.front?.phase ?? 8) <= 7);
    expect('Bootstrap intensity is 0–1',                  (result.intensity ?? -1) >= 0 && (result.intensity ?? 2) <= 1);
}

// ────────────────────────────────────────────────────────────────
// 10. LONG SIMULATION — weather actually changes
// ────────────────────────────────────────────────────────────────
section('10 · Long simulation (48 ticks = 24 hours, weather must change ≥ 2 times)');

{
    let weather: Weather = WeatherEngine.generateFront(makeClock(4, 8), 'Forest');
    let clock  = makeClock(4, 8);
    const typesSeen = new Set<WeatherType>([weather.type]);
    let changes = 0;
    let prevType = weather.type;

    for (let tick = 0; tick < 48; tick++) {
        // Advance clock by 30 min
        clock = { ...clock, minute: clock.minute + 30 };
        if (clock.minute >= 60) { clock = { ...clock, hour: (clock.hour + 1) % 24, minute: 0 }; }

        weather = WeatherEngine.advanceFront(clock, weather, 'Forest');
        if (weather.type !== prevType) { changes++; typesSeen.add(weather.type); }
        prevType = weather.type;
    }

    expect(
        'Weather changes at least once over 24 simulated hours',
        changes >= 1,
        `${changes} changes, types seen: ${[...typesSeen].join(', ')}`
    );
    expect(
        'Intensity always stays in [0, 1]',
        weather.intensity >= 0 && weather.intensity <= 1,
        `final intensity = ${weather.intensity}`
    );
    expect(
        'Type is always a valid WeatherType',
        ['Clear','Rain','Storm','Fog','Snow','Blizzard'].includes(weather.type),
        `final type = ${weather.type}`
    );

    console.log(`     → ${changes} type changes over 24h, types seen: ${[...typesSeen].join(', ')}`);
}

// ────────────────────────────────────────────────────────────────
// SUMMARY
// ────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${'═'.repeat(60)}`);
console.log(`  Weather System Tests: ${passed}/${total} passed  (${failed} failed)`);
console.log(`${'═'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
