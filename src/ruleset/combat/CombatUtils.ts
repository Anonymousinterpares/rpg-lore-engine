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

    /**
     * Parses a D&D range string into grid units (cells).
     * @example "60 feet" -> 12, "Touch" -> 1, "Self" -> 0
     */
    public static parseRange(rangeStr: string): number {
        if (!rangeStr) return 0;
        const lower = rangeStr.toLowerCase();

        if (lower.includes('self')) return 0;
        if (lower.includes('touch')) return 1;

        const match = lower.match(/(\d+)\s*ft/);
        if (match) {
            return Math.ceil(parseInt(match[1]) / 5);
        }

        return 5; // Default fallback for single targets if units missing
    }

    /**
     * Determines if an item is a ranged weapon based on its properties OR the presence of a range data with normal > 5.
     */
    public static isRangedWeapon(item: any): boolean {
        if (!item || item.type !== 'Weapon') return false;

        // 1. Direct mechanical range check
        if (item.range && item.range.normal > 5) return true;

        // 2. Property check
        const properties = item.properties || [];
        return (
            properties.includes('Range') ||
            properties.includes('Ammunition') ||
            properties.some((p: string) => p.toLowerCase().includes('ranged'))
        );
    }

    /**
     * Gets the range of a weapon in grid cells.
     * Uses the new 'range.normal' field if available, falls back to parsing properties, then to reach.
     */
    public static getWeaponRange(item: any): number {
        if (!item) return 1;

        // 1. Use the new standard range field (e.g. { normal: 80, long: 320 })
        if (item.range && typeof item.range.normal === 'number') {
            return Math.ceil(item.range.normal / 5);
        }

        // 2. Fallback to property parsing
        if (item.properties) {
            const rangeProp = item.properties.find((p: string) => typeof p === 'string' && p.toLowerCase().startsWith('range'));
            if (rangeProp) {
                return this.parseRange(rangeProp);
            }
        }

        // 3. Melee reach default
        return 1;
    }

    /**
     * Gets the maximum range of a weapon (long range) in grid cells.
     */
    public static getWeaponMaxRange(item: any): number {
        if (!item) return 1;

        if (item.range && typeof item.range.long === 'number') {
            return Math.ceil(item.range.long / 5);
        }

        // If no long range defined, it's same as normal
        return this.getWeaponRange(item);
    }
    /**
     * Gets the name of the ammunition item required for a given weapon.
     */
    public static getRequiredAmmunition(weaponName: string): string | null {
        const name = weaponName.toLowerCase();
        if (name.includes('longbow') || name.includes('shortbow')) return 'Arrow';
        if (name.includes('crossbow')) return 'Crossbow bolt';
        if (name.includes('blowgun')) return 'Blowgun needle';
        if (name.includes('sling')) return 'Sling bullet';
        return null;
    }

    /**
     * Determines if a weapon is a thrown weapon that should be consumed on ranged attack.
     */
    public static isThrownWeapon(item: any): boolean {
        if (!item || item.type !== 'Weapon') return false;
        const properties = item.properties || [];
        return properties.some((p: string) => p.toLowerCase().includes('thrown'));
    }
}
