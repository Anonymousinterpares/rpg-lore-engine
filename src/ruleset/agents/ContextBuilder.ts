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

export interface CompanionContext {
    name: string;
    role: string;
    class: string;
    level: number;
    hpStatus: HPStatus;
    traits: string;
    followState: 'following' | 'waiting';
}

export interface ExplorationContext extends BaseContext {
    hex: {
        interestPoints: string[];
        resourceNodes: string[];
        neighbors?: { direction: string; biome: string; name?: string; distance: number }[];
        inhabitants: string[];
    };
    activeQuests: { title: string; currentObjective: string }[];
    party: CompanionContext[];
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
                conditions: char.conditions.map((c: any) => c.name || c)
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

    /**
     * Smart context budget allocation.
     * Total budget of 25 slots split by weight: inhabitants 0.45, neighbors 0.30, quests 0.25.
     * Unused slots from under-populated categories are redistributed to others.
     * Only caps when total exceeds budget by >20%.
     */
    private static applyContextBudget(
        inhabitants: string[],
        neighbors: { direction: string; biome: string; name?: string; distance: number }[],
        quests: { title: string; currentObjective: string }[]
    ): {
        inhabitants: string[];
        inhabitantsCapped: boolean;
        neighbors: typeof neighbors;
        neighborsCapped: boolean;
        quests: typeof quests;
        questsCapped: boolean;
    } {
        const TOTAL_BUDGET = 25;
        const total = inhabitants.length + neighbors.length + quests.length;

        // If within 20% of budget, no capping needed
        if (total <= TOTAL_BUDGET * 1.2) {
            return {
                inhabitants, inhabitantsCapped: false,
                neighbors, neighborsCapped: false,
                quests, questsCapped: false
            };
        }

        // Weighted allocation with surplus redistribution
        const weights = { inhabitants: 0.45, neighbors: 0.30, quests: 0.25 };
        const counts = { inhabitants: inhabitants.length, neighbors: neighbors.length, quests: quests.length };
        const categories = ['inhabitants', 'neighbors', 'quests'] as const;

        // First pass: allocate base slots, identify surplus
        const baseSlots: Record<string, number> = {};
        let surplus = 0;
        let needMore: string[] = [];

        for (const cat of categories) {
            const allocated = Math.floor(TOTAL_BUDGET * weights[cat]);
            if (counts[cat] <= allocated) {
                baseSlots[cat] = counts[cat]; // fits, no capping needed
                surplus += allocated - counts[cat]; // unused slots
            } else {
                baseSlots[cat] = allocated;
                needMore.push(cat);
            }
        }

        // Second pass: redistribute surplus to categories that need it
        for (const cat of needMore) {
            const share = Math.floor(surplus / needMore.length);
            baseSlots[cat] += share;
            surplus -= share;
        }

        return {
            inhabitants: inhabitants.slice(0, baseSlots['inhabitants']),
            inhabitantsCapped: inhabitants.length > baseSlots['inhabitants'],
            neighbors: neighbors.slice(0, baseSlots['neighbors']),
            neighborsCapped: neighbors.length > baseSlots['neighbors'],
            quests: quests.slice(0, baseSlots['quests']),
            questsCapped: quests.length > baseSlots['quests']
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
                const isCurrent = n2.coordinates[0] === hex.coordinates[0] && n2.coordinates[1] === hex.coordinates[1];
                const isD1 = neighborsD1.some(d1 => d1.coordinates[0] === n2.coordinates[0] && d1.coordinates[1] === n2.coordinates[1]);
                const isAlreadyAdded = neighborInfoD2.some(d => d.name === n2.name && d.biome === n2.biome && d.distance === 2);

                if (!isCurrent && !isD1 && !isAlreadyAdded) {
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

        const allNeighbors = [...neighborInfoD1, ...neighborInfoD2];
        const allInhabitants = (hex.npcs || []).map(id => {
            const npc = state.worldNpcs.find(n => n.id === id);
            return npc ? `${npc.name} (${npc.role || 'Unknown'} - ${npc.factionId || 'Unaffiliated'})` : 'Unknown Figure';
        });
        const allQuests = state.activeQuests.map(q => ({
            title: q.title,
            currentObjective: q.objectives.find(o => !o.isCompleted)?.description || 'No active objective'
        }));

        const budget = this.applyContextBudget(allInhabitants, allNeighbors, allQuests);

        // Build capping notes for the LLM
        const cappingNotes: string[] = [];
        if (budget.inhabitantsCapped) {
            cappingNotes.push(`[${allInhabitants.length - budget.inhabitants.length} more inhabitants present — full list available in the UI sidebar.]`);
        }
        if (budget.neighborsCapped) {
            cappingNotes.push(`[${allNeighbors.length - budget.neighbors.length} more hexes visible — player should check the Map panel for full surroundings.]`);
        }
        if (budget.questsCapped) {
            cappingNotes.push(`[${allQuests.length - budget.quests.length} more quests active — full list in the Quest panel.]`);
        }

        // Append capping notes to inhabitants so they appear in the LLM context naturally
        const finalInhabitants = [...budget.inhabitants, ...cappingNotes];

        return {
            ...base,
            hex: {
                interestPoints: hex.interest_points.map(p => p.name),
                resourceNodes: hex.resourceNodes.map(r => r.resourceType),
                neighbors: budget.neighbors,
                inhabitants: finalInhabitants
            },
            activeQuests: budget.quests,
            party: (state.companions || [])
                .filter((c: any) => c.meta?.followState === 'following')
                .map((c: any) => ({
                    name: c.character.name,
                    role: c.meta.originalRole || 'Adventurer',
                    class: c.character.class,
                    level: c.character.level,
                    hpStatus: this.getHpStatus(c.character.hp),
                    traits: (c.meta.originalTraits || []).slice(0, 4).join(', '),
                    followState: c.meta.followState
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
        // Use activeDialogueNpcId (set when /talk is initiated) with fallback
        const npcId = (state as any).activeDialogueNpcId || state.location.subLocationId;
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
