import { GameState } from './GameStateManager';
import { Faction } from '../schemas/FactionSchema';

export class FactionEngine {
    /**
     * Adjusts reputation with a specific faction.
     */
    public static adjustStanding(state: GameState, factionId: string, delta: number): string {
        const faction = state.factions.find(f => f.id === factionId);
        if (!faction) return `Faction ${factionId} not found.`;

        const oldStanding = faction.standing;
        faction.standing = Math.max(-100, Math.min(100, faction.standing + delta));

        const change = faction.standing - oldStanding;
        const trend = change >= 0 ? 'improved' : 'worsened';

        return `Your standing with ${faction.name} has ${trend} by ${Math.abs(change)}. Current: ${faction.standing}`;
    }

    /**
     * Returns a text description of the relationship status.
     */
    public static getStandingLabel(standing: number): string {
        if (standing <= -80) return 'Hated';
        if (standing <= -40) return 'Hostile';
        if (standing <= -10) return 'Unfriendly';
        if (standing <= 10) return 'Neutral';
        if (standing <= 40) return 'Friendly';
        if (standing <= 80) return 'Honored';
        return 'Exalted';
    }

    /**
     * Checks if an NPC is hostile based on faction standing.
     */
    public static isHostile(faction: Faction): boolean {
        return faction.standing <= -40;
    }
}
