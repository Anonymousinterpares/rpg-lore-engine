import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { GameState } from './GameStateManager';
import { WorldClockEngine } from './WorldClockEngine';

export class DowntimeEngine {
    /**
     * Spends time and gold to craft a mundane item.
     */
    public static craftItem(pc: PlayerCharacter, itemName: string, costGP: number, days: number): string {
        // Logic: 5gp worth of progress per day is standard 5e
        const totalProgressNeeded = costGP;
        const progressPerDay = 5;
        const requiredDays = Math.ceil(totalProgressNeeded / progressPerDay);

        if (days < requiredDays) {
            return `Crafting ${itemName} requires ${requiredDays} days. You only spent ${days}.`;
        }

        // Apply costs (simplified)
        // Assume player has materials/gold
        return `${pc.name} spent ${days} days crafting a ${itemName}.`;
    }

    /**
     * Performs a downtime activity like training or research.
     */
    public static performActivity(state: GameState, activity: string, hours: number): string {
        state.worldTime = WorldClockEngine.advanceTime(state.worldTime, hours);
        return `${state.character.name} spent ${hours} hours on ${activity}.`;
    }
}
