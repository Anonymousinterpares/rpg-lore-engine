export class WorldClockEngine {
    /**
     * Initializes a default starting time (Year 1489, 1st of Hammer/Month 1, 8 AM)
     */
    static createDefaultClock() {
        return {
            hour: 8,
            day: 1,
            month: 1,
            year: 1489,
            totalTurns: 0
        };
    }
    /**
     * Advances the clock by a number of minutes.
     * 10 turns = 1 minute (assuming 6s combat turns)
     * 1 travel turn (exploration) = variable minutes/hours
     */
    static advanceTime(clock, minutes) {
        let { hour, day, month, year, totalTurns } = clock;
        const totalMinutes = hour * 60 + minutes;
        hour = Math.floor(totalMinutes / 60) % 24;
        const extraDays = Math.floor(totalMinutes / (60 * 24));
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
        return { hour, day, month, year, totalTurns: totalTurns + (minutes * 10) };
    }
    /**
     * Advances the clock by combat turns (6 seconds each)
     */
    static advanceTurns(clock, turns) {
        const minutes = Math.floor((clock.totalTurns % 10 + turns) / 10);
        const newClock = this.advanceTime(clock, minutes);
        newClock.totalTurns = clock.totalTurns + turns;
        return newClock;
    }
    /**
     * Formats the clock into a readable string
     */
    static formatTime(clock) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `Day ${clock.day}, Month ${clock.month}, Year ${clock.year} | ${pad(clock.hour)}:00`;
    }
}
