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
    storySummary: string;
    recentHistory: any[];
}

export interface ExplorationContext extends BaseContext {
    hex: {
        interestPoints: string[];
        resourceNodes: string[];
        neighbors?: { direction: string; biome: string }[];
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
            storySummary: state.storySummary,
            recentHistory: recentHistory.slice(-5) // Smart trim: only last 5
        };
    }

    private static buildExplorationContext(base: BaseContext, state: GameState, hexManager: HexMapManager): ExplorationContext {
        const hex = this.getCurrentHex(state);
        const neighbors = hexManager.getNeighbors(state.location.coordinates);

        // Only include neighbors if we just moved or looking around (logic can be refined)
        const neighborInfo = neighbors.map((n, i) => ({
            direction: ['N', 'S', 'NE', 'NW', 'SE', 'SW'][i], // Simplified mapping
            biome: n.biome
        }));

        return {
            ...base,
            hex: {
                interestPoints: hex.interest_points.map(p => p.name),
                resourceNodes: hex.resourceNodes.map(r => r.resourceType),
                neighbors: neighborInfo
            },
            activeQuests: state.activeQuests.map(q => ({
                title: q.title,
                currentObjective: q.objectives.find(o => !o.isCompleted)?.description || 'No active objective'
            }))
        };
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
