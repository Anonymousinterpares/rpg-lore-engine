import { WorldClockEngine } from '../../src/ruleset/combat/WorldClockEngine';

function testSeasons() {
    console.log("=== SEASONAL TIME PHASE VERIFICATION ===\n");

    const testMonths = [1, 7]; // Hammer (Winter) and Flamerule (Summer)
    const monthNames = ["Hammer (Winter)", "Flamerule (Summer)"];

    testMonths.forEach((month, idx) => {
        console.log(`--- Testing Month: ${monthNames[idx]} ---`);
        const { sunrise, sunset } = WorldClockEngine.getSeasonConfig(month);
        console.log(`Sunrise: ${sunrise}:00, Sunset: ${sunset}:00\n`);

        for (let hour = 0; hour < 24; hour++) {
            const clock = {
                hour,
                minute: 0,
                day: 1,
                month,
                year: 1489,
                totalTurns: 0
            };
            const phase = WorldClockEngine.getTimePhase(clock);
            const pad = (h: number) => h.toString().padStart(2, '0');
            console.log(`[${pad(hour)}:00] -> ${phase}`);
        }
        console.log("\n");
    });
}

testSeasons();
