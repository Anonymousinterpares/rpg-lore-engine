import { WorldClock } from '../schemas/WorldClockSchema';

export class WorldClockEngine {
    public static readonly MONTH_NAMES = [
        'Hammer', 'Alturiak', 'Ches', 'Tarsakh', 'Mirtul', 'Kythorn',
        'Flamerule', 'Eleasis', 'Eleint', 'Marpenoth', 'Uktar', 'Nightal'
    ];

    /**
     * Initializes a default starting time (Year 1489, 1st of Hammer/Month 1, 9 AM)
     */
    public static createDefaultClock(): WorldClock {
        return {
            hour: 9,
            minute: 0,
            day: 1,
            month: 1,
            year: 1489,
            totalTurns: 0
        };
    }

    /**
     * Advances the clock by a number of minutes.
     */
    public static advanceTime(clock: WorldClock, minutes: number): WorldClock {
        let { hour, minute, day, month, year, totalTurns } = clock;

        const totalMinutes = hour * 60 + minute + minutes;

        minute = totalMinutes % 60;
        const totalHours = Math.floor(totalMinutes / 60);
        hour = totalHours % 24;

        const extraDays = Math.floor(totalHours / 24);
        if (extraDays > 0) {
            day += extraDays;
            while (day > 30) {
                day -= 30;
                month += 1;
                if (month > 12) {
                    month = 1;
                    year += 1;
                }
            }
        }

        return { hour, minute, day, month, year, totalTurns: totalTurns + (minutes * 10) };
    }

    /**
     * Advances the clock by combat turns (6 seconds each)
     */
    public static advanceTurns(clock: WorldClock, turns: number): WorldClock {
        // totalTurns is just a counter, we use it for modulo precision if needed
        // but the core is hour/minute/day/month/year

        // Convert current time to total minutes, add turns-as-minutes
        // or just calculate the overflow
        const addedMinutes = Math.floor(turns / 10); // 10 turns = 1 min
        // Actually, let's keep it consistent: 6s per turn.

        // This is a bit tricky if we want exact second tracking, but schema doesn't have seconds.
        // We'll track partial minutes via totalTurns or just round up/down.
        // Given 5 min per narrturn, 10 turns = 1 min is the intended scale.

        const netMinutes = Math.floor(turns / 10);
        const newClock = this.advanceTime(clock, netMinutes);
        newClock.totalTurns = clock.totalTurns + turns;
        return newClock;
    }

    /**
     * Formats the clock into a readable string
     */
    public static formatTime(clock: WorldClock): string {
        const monthName = this.MONTH_NAMES[clock.month - 1] || `Month ${clock.month}`;

        // D&D Tendays (10 days per week)
        const tenday = Math.ceil(clock.day / 10);
        const dayInTenday = ((clock.day - 1) % 10) + 1;

        const phase = this.getTimePhase(clock);

        return `${dayInTenday} of ${monthName} (${tenday}${this.getOrdinal(tenday)} Tenday), Year ${clock.year} | ${phase}`;
    }

    /**
     * Returns a simple date string for narrative context.
     */
    public static formatDate(clock: WorldClock): string {
        const monthName = this.MONTH_NAMES[clock.month - 1] || `Month ${clock.month}`;
        return `${clock.day} of ${monthName}, Year ${clock.year}`;
    }

    /**
     * Returns the seasonal sunrise and sunset hours for a given month.
     */
    public static getSeasonConfig(month: number): { sunrise: number, sunset: number } {
        // Simple seasonal curve for Forgotten Realms (Northern Hemisphere-ish)
        const configs: Record<number, { sunrise: number, sunset: number }> = {
            1: { sunrise: 8, sunset: 16 },  // Hammer (Deepwinter)
            2: { sunrise: 7, sunset: 17 },  // Alturiak
            3: { sunrise: 6, sunset: 18 },  // Ches (Equinox)
            4: { sunrise: 5, sunset: 19 },  // Tarsakh
            5: { sunrise: 4, sunset: 20 },  // Mirtul
            6: { sunrise: 4, sunset: 21 },  // Kythorn
            7: { sunrise: 4, sunset: 22 },  // Flamerule (Summertide)
            8: { sunrise: 5, sunset: 21 },  // Eleasis
            9: { sunrise: 6, sunset: 18 },  // Eleint (Equinox)
            10: { sunrise: 7, sunset: 17 }, // Marpenoth
            11: { sunrise: 8, sunset: 16 }, // Uktar
            12: { sunrise: 8, sunset: 16 }, // Nightal
        };

        return configs[month] || { sunrise: 6, sunset: 18 };
    }

    /**
     * Calculates the narrative time phase based on current time and season.
     */
    public static getTimePhase(clock: WorldClock): string {
        const { hour, month } = clock;
        const { sunrise, sunset } = this.getSeasonConfig(month);

        if (hour === 0) return 'Deep Night';
        if (hour < sunrise - 1) return 'Small Hours';
        if (hour < sunrise) return 'First Light';
        if (hour < sunrise + 1) return 'Dawn';
        if (hour < 11) return 'Morning';
        if (hour >= 11 && hour < 14) return 'High Sun';
        if (hour >= 14 && hour < sunset - 2) return 'Afternoon';
        if (hour < sunset - 1) return 'Evenfall';
        if (hour < sunset) return 'Dusk';
        if (hour < sunset + 1) return 'Nightfall';
        return 'Deep Night';
    }

    private static getOrdinal(n: number): string {
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }
}
