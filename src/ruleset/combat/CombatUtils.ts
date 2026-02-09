/**
 * Utility functions for combat calculations.
 */

export interface MovementSpeeds {
    walk: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
}

export class CombatUtils {
    /**
     * Parses a D&D speed string into grid units (cells).
     * 1 cell = 5 feet.
     * @example "30 ft., fly 60 ft." -> { walk: 6, fly: 12 }
     */
    public static parseSpeed(speedStr: string): MovementSpeeds {
        const speeds: MovementSpeeds = { walk: 6 }; // Default to 30ft

        if (!speedStr) return speeds;

        const parts = speedStr.split(',').map(s => s.trim().toLowerCase());

        for (const part of parts) {
            // Match number followed by "ft"
            const match = part.match(/(\d+)\s*ft/);
            if (!match) continue;

            const feet = parseInt(match[1]);
            const cells = Math.floor(feet / 5);

            if (part.includes('fly')) {
                speeds.fly = cells;
            } else if (part.includes('swim')) {
                speeds.swim = cells;
            } else if (part.includes('climb')) {
                speeds.climb = cells;
            } else if (part.includes('burrow')) {
                speeds.burrow = cells;
            } else {
                // If no specific mode mentioned, it's walking speed
                speeds.walk = cells;
            }
        }

        return speeds;
    }

    /**
     * Gets the primary walking speed in cells.
     */
    public static getWalkingSpeed(speedStr: string): number {
        return this.parseSpeed(speedStr).walk;
    }
}
