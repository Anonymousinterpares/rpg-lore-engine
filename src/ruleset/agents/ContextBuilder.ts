import { GameState } from '../schemas/FullSaveStateSchema';
import { HexMapManager } from '../combat/HexMapManager';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { WorldClock } from '../schemas/WorldClockSchema';
import { WorldClockEngine } from '../combat/WorldClockEngine';
import { Hex } from '../schemas/HexMapSchema';

export type HPStatus = 'healthy' | 'wounded' | 'bloodied' | 'critical' | 'unconscious';
export type TimeOfDay = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
export type FactionDisposition = 'allied' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile';

export interface BaseContext {
    mode: string;
    player: {
        name: string;
        class: string;
        level: number;
        hpStatus: HPStatus;
        conditions: string[];
    };
    timeOfDay: TimeOfDay;
    location: {
        name: string;
        biome: string;
        description: string;
    };
    weather: string;
    season: string;
    dateString: string;
    storySummary: string;
    recentHistory: any[];
}

export interface ExplorationContext extends BaseContext {
    hex: {
        interestPoints: string[];
        resourceNodes: string[];
        neighbors?: { direction: string; biome: string; name?: string; distance: number }[];
    };
    activeQuests: { title: string; currentObjective: string }[];
}

export interface CombatContext extends BaseContext {
    combat: {
        round: number;
        enemySummary: string;
        isPlayerTurn: boolean;
    };
}

export interface DialogueContext extends BaseContext {
    npc: {
        name: string;
        disposition: FactionDisposition;
        faction?: string;
        isMerchant: boolean;
    };
}

export class ContextBuilder {
    /**
     * Builds a tailored context object for LLM agents based on current game state and mode.
     */
    public static build(state: GameState, hexManager: HexMapManager, recentHistory: any[]): any {
        const base = this.buildBaseContext(state, recentHistory);

        switch (state.mode) {
            case 'COMBAT':
                return this.buildCombatContext(base, state);
            case 'DIALOGUE':
                return this.buildDialogueContext(base, state);
            case 'EXPLORATION':
            default:
                return this.buildExplorationContext(base, state, hexManager);
        }
    }

    private static buildBaseContext(state: GameState, recentHistory: any[]): BaseContext {
        const char = state.character;
        return {
            mode: state.mode,
            player: {
                name: char.name,
                class: char.class,
                level: char.level,
                hpStatus: this.getHpStatus(char.hp),
                conditions: char.conditions
            },
            timeOfDay: this.getHybridTime(state.worldTime),
            location: {
                name: this.getCurrentHex(state).name || 'Unknown Location',
                biome: this.getCurrentHex(state).biome || 'Unknown Biome',
                description: this.getCurrentHex(state).description || ''
            },
            weather: state.weather.type,
            season: this.getSeason(state.worldTime.month),
            dateString: WorldClockEngine.formatDate(state.worldTime),
            storySummary: state.storySummary,
            recentHistory: recentHistory.slice(-5) // Smart trim: only last 5
        };
    }

    private static buildExplorationContext(base: BaseContext, state: GameState, hexManager: HexMapManager): ExplorationContext {
        const hex = this.getCurrentHex(state);

        // Get Distance 1 Neighbors
        const neighborsD1 = hexManager.getNeighbors(hex.coordinates);
        const neighborInfoD1 = neighborsD1.map(n => ({
            direction: this.getDirection(hex.coordinates, n.coordinates),
            biome: n.biome,
            name: n.name,
            distance: 1
        }));

        // Get Distance 2 Neighbors (Horizon)
        const neighborInfoD2: { direction: string; biome: string; name?: string; distance: number }[] = [];
        neighborsD1.forEach(n1 => {
            const neighborsD2 = hexManager.getNeighbors(n1.coordinates);
            neighborsD2.forEach(n2 => {
                // Filter out current hex and duplicates (if already covered)
                const isCurrent = n2.coordinates[0] === hex.coordinates[0] && n2.coordinates[1] === hex.coordinates[1];
                const isD1 = neighborsD1.some(d1 => d1.coordinates[0] === n2.coordinates[0] && d1.coordinates[1] === n2.coordinates[1]);
                // Simplified check for already added D2 hexes. For now, we'll allow some redundancy if directions are approximate.
                // A more robust check would involve unique hex IDs or coordinate pairs.
                const isAlreadyAdded = neighborInfoD2.some(d => d.name === n2.name && d.biome === n2.biome && d.distance === 2);

                if (!isCurrent && !isD1 && !isAlreadyAdded) {
                    // Calculate rough direction from center
                    const dir = this.getDirection(hex.coordinates, n2.coordinates);
                    neighborInfoD2.push({
                        direction: dir,
                        biome: n2.biome,
                        name: n2.name,
                        distance: 2
                    });
                }
            });
        });

        // Deduplicate D2 list based on direction/biome to avoid spamming "North: Mountains, North: Mountains"
        // Actually, let's just pass all legitimate hexes and let the LLM sort it out, or refine.

        return {
            ...base,
            hex: {
                interestPoints: hex.interest_points.map(p => p.name),
                resourceNodes: hex.resourceNodes.map(r => r.resourceType),
                neighbors: [...neighborInfoD1, ...neighborInfoD2]
            },
            activeQuests: state.activeQuests.map(q => ({
                title: q.title,
                currentObjective: q.objectives.find(o => !o.isCompleted)?.description || 'No active objective'
            }))
        };
    }

    private static getDirection(source: [number, number], target: [number, number]): string {
        const dq = target[0] - source[0];
        const dr = target[1] - source[1];

        // Distance 1 directions
        if (dq === 0 && dr === -1) return 'N';
        if (dq === 1 && dr === -1) return 'NE';
        if (dq === 1 && dr === 0) return 'SE';
        if (dq === 0 && dr === 1) return 'S';
        if (dq === -1 && dr === 1) return 'SW';
        if (dq === -1 && dr === 0) return 'NW';

        // Extended logic for D2 (Approximation)
        // These are approximations for the general direction from the source hex
        if (dq === 0 && dr === -2) return 'N (Far)';
        if (dq === 1 && dr === -2) return 'N/NE (Far)'; // Between N and NE
        if (dq === 2 && dr === -2) return 'NE (Far)';
        if (dq === 2 && dr === -1) return 'NE/SE (Far)'; // Between NE and SE
        if (dq === 2 && dr === 0) return 'SE (Far)';
        if (dq === 1 && dr === 1) return 'SE/S (Far)'; // Between SE and S
        if (dq === 0 && dr === 2) return 'S (Far)';
        if (dq === -1 && dr === 2) return 'S/SW (Far)'; // Between S and SW
        if (dq === -2 && dr === 2) return 'SW (Far)';
        if (dq === -2 && dr === 1) return 'SW/NW (Far)'; // Between SW and NW
        if (dq === -2 && dr === 0) return 'NW (Far)';
        if (dq === -1 && dr === -1) return 'NW/N (Far)'; // Between NW and N

        return 'Distant'; // Fallback for any other distance/direction
    }

    private static buildCombatContext(base: BaseContext, state: GameState): CombatContext {
        const combat = state.combat!;
        const enemies = combat.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);

        // Summarize enemies: "2 Goblins, 1 Hobgoblin"
        const enemyCounts: Record<string, number> = {};
        enemies.forEach(e => {
            enemyCounts[e.name] = (enemyCounts[e.name] || 0) + 1;
        });
        const enemySummary = Object.entries(enemyCounts)
            .map(([name, count]) => `${count} ${name}${count > 1 ? 's' : ''}`)
            .join(', ');

        return {
            ...base,
            combat: {
                round: combat.round,
                enemySummary: enemySummary || 'No active enemies',
                isPlayerTurn: combat.combatants[combat.currentTurnIndex]?.isPlayer || false
            }
        };
    }

    private static buildDialogueContext(base: BaseContext, state: GameState): DialogueContext {
        // Find the NPC we are talking to (assuming stored in location or state)
        // This is a placeholder as the Dialogue mode is yet to be fully implemented
        const npcId = state.location.subLocationId; // Placeholder
        const npc = state.worldNpcs.find(n => n.id === npcId);

        return {
            ...base,
            npc: {
                name: npc?.name || 'Unknown NPC',
                disposition: this.getFactionDisposition(npc?.relationship?.standing || 0),
                faction: npc?.factionId,
                isMerchant: npc?.isMerchant || false
            }
        };
    }

    private static getHpStatus(hp: { current: number, max: number }): HPStatus {
        const ratio = hp.current / hp.max;
        if (ratio >= 0.75) return 'healthy';
        if (ratio >= 0.50) return 'wounded';
        if (ratio >= 0.25) return 'bloodied';
        if (ratio > 0) return 'critical';
        return 'unconscious';
    }

    private static getHybridTime(clock: WorldClock): any {
        const phase = WorldClockEngine.getTimePhase(clock);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const exact = `${pad(clock.hour)}:${pad(clock.minute)}`;
        return `${phase} (${exact})`;
    }

    private static getSeason(month: number): string {
        if (month >= 3 && month <= 5) return 'Spring';
        if (month >= 6 && month <= 8) return 'Summer';
        if (month >= 9 && month <= 11) return 'Autumn';
        return 'Winter';
    }

    private static getFactionDisposition(standing: number): FactionDisposition {
        if (standing >= 50) return 'allied';
        if (standing >= 20) return 'friendly';
        if (standing >= -20) return 'neutral';
        if (standing >= -50) return 'unfriendly';
        return 'hostile';
    }

    private static getCurrentHex(state: GameState): Hex {
        return state.worldMap.hexes[state.location.hexId];
    }
}
