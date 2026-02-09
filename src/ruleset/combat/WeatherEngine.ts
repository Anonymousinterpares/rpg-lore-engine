import { Weather, WeatherType } from '../schemas/BaseSchemas';
import { WorldClock } from '../schemas/WorldClockSchema';
import { Dice } from './Dice';

export interface WeatherEffect {
    type: WeatherType;
    narrative: string;
    modifiers: Record<string, any>;
}

export class WeatherEngine {
    /**
     * Rolls for new weather based on season (month)
     */
    public static generateWeather(clock: WorldClock): Weather {
        const month = clock.month;
        const roll = Dice.roll("1d100");
        let type: WeatherType = 'Clear';

        // Simplified seasonal logic for now
        // Winter: 11, 12, 1, 2
        // Summer: 6, 7, 8

        if (month === 11 || month === 12 || month === 1 || month === 2) {
            // Winter
            if (roll > 90) type = 'Blizzard';
            else if (roll > 60) type = 'Snow';
            else if (roll > 50) type = 'Fog';
            else type = 'Clear';
        } else if (month >= 6 && month <= 8) {
            // Summer
            if (roll > 85) type = 'Storm';
            else if (roll > 60) type = 'Rain';
            else type = 'Clear';
        } else {
            // Spring/Autumn
            if (roll > 90) type = 'Storm';
            else if (roll > 75) type = 'Rain';
            else if (roll > 60) type = 'Fog';
            else type = 'Clear';
        }

        // Duration: 1d6 hours
        const durationHours = Dice.roll("1d6");

        return {
            type,
            durationMinutes: durationHours * 60,
            intensity: 1.0
        };
    }

    /**
     * Returns mechanical modifiers for the current weather
     */
    public static getWeatherEffects(type: WeatherType): WeatherEffect {
        switch (type) {
            case 'Rain':
                return {
                    type: 'Rain',
                    narrative: "Gray sheets of rain blur the world. Sounds are muffled.",
                    modifiers: { perceptionHearing: 'disadvantage', fireResistance: true }
                };
            case 'Storm':
                return {
                    type: 'Storm',
                    narrative: "Thunder rolls across the heavens. Flashes of lightning illuminate the dark clouds.",
                    modifiers: { stealthBonus: 2, passivePerceptionPenalty: 2, lightningHazard: 0.01 }
                };
            case 'Fog':
                return {
                    type: 'Fog',
                    narrative: "A thick, cold mist clings to the ground, obscuring everything beyond a few paces.",
                    modifiers: { heavilyObscured: true, attackRangeLimit: 5 }
                };
            case 'Snow':
                return {
                    type: 'Snow',
                    narrative: "Soft white flakes drift from a leaden sky, blanketing the ground.",
                    modifiers: { difficultTerrain: true, visibilityLimit: 30 }
                };
            case 'Blizzard':
                return {
                    type: 'Blizzard',
                    narrative: "A howling whiteout. The wind bites through armor and bone alike.",
                    modifiers: { difficultTerrain: true, visibilityLimit: 15, exhaustionRisk: true }
                };
            default:
                return {
                    type: 'Clear',
                    narrative: "The sky is clear and the air is steady.",
                    modifiers: {}
                };
        }
    }
}
