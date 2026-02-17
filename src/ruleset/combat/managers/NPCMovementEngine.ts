import { GameState } from '../../schemas/FullSaveStateSchema';
import { WorldNPC, NPCMovementType } from '../../schemas/WorldEnrichmentSchema';
import { HexMapManager } from '../HexMapManager';
import { DataManager } from '../../data/DataManager';
import { ShopEngine } from '../ShopEngine';
import { MovementEngine } from '../MovementEngine';
import { BiomeType } from '../../schemas/BiomeSchema';
import { Hex } from '../../schemas/HexMapSchema';

export class NPCMovementEngine {
    constructor(
        private state: GameState,
        private hexMapManager: HexMapManager,
        private onEmitState: () => Promise<void>,
        private log: (message: string) => void
    ) { }

    /**
     * Processes movement for all NPCs whose interval has elapsed.
     */
    public processTurn(currentTurn: number): void {
        const allNpcs = this.getNpcsAcrossWorld();
        this.log(`[NPC] Processing turn ${currentTurn} for ${allNpcs.length} NPCs`);

        for (const npc of allNpcs) {
            if (!npc.movementBehavior) {
                this.log(`[NPC] Initializing behavior for ${npc.name} (${npc.role})`);
                this.initializeDefaultBehavior(npc);
            }

            const behavior = npc.movementBehavior!;
            // this.log(`[NPC] ${npc.name}: Type=${behavior.type}, Last=${behavior.lastMoveTurn}, Interval=${behavior.interval}, Diff=${currentTurn - behavior.lastMoveTurn}`);

            if (behavior.type === 'STATIONARY') continue;

            const turnsSinceLastMove = currentTurn - behavior.lastMoveTurn;
            if (turnsSinceLastMove >= behavior.interval) {
                this.log(`[NPC] ${npc.name} ready to move (Turns: ${turnsSinceLastMove} >= ${behavior.interval})`);
                this.executeMovement(npc, currentTurn);
            }
        }
    }

    private getNpcsAcrossWorld(): WorldNPC[] {
        return this.state.worldNpcs;
    }

    private initializeDefaultBehavior(npc: WorldNPC): void {
        const role = npc.role || 'Citizen';

        // Mapping from design doc
        const stationaryRoles = ['Citizen', 'Guard', 'Noble', 'Beggar', 'Shopkeeper', 'Farmer', 'Herder', 'Woodcutter', 'Miner', 'Fisherman', 'Monk', 'Witch', 'Hermit', 'Castaway'];

        if (stationaryRoles.includes(role)) {
            (npc as any).movementBehavior = { type: 'STATIONARY', interval: 999999, lastMoveTurn: 0 };
        } else if (role === 'Merchant' || role === 'Smuggler') {
            (npc as any).movementBehavior = { type: 'TRADE_ROUTE', interval: 24, lastMoveTurn: this.state.worldTime.totalTurns };
        } else if (role === 'Scout' || role === 'Mercenary') {
            (npc as any).movementBehavior = { type: 'PATROL', interval: role === 'Scout' ? 12 : 24, lastMoveTurn: this.state.worldTime.totalTurns, anchorHex: this.getNpcCurrentHexId(npc.id), patrolRadius: role === 'Scout' ? 3 : 2 };
        } else if (['Traveler', 'Explorer', 'Hunter', 'Druid', 'Nomad', 'Sailor', 'Prospector', 'Archaeologist'].includes(role)) {
            let interval = 24;
            if (role === 'Hunter') interval = 12;
            if (role === 'Nomad' || role === 'Archaeologist') interval = 48;

            const restrictedBiomes = this.getRestrictedBiomesForRole(role);
            (npc as any).movementBehavior = { type: 'WANDER', interval, lastMoveTurn: this.state.worldTime.totalTurns, restrictedBiomes };
        } else if (['Bandit', 'Cultist', 'Scavenger'].includes(role)) {
            (npc as any).movementBehavior = { type: 'HOSTILE', interval: 24, lastMoveTurn: this.state.worldTime.totalTurns };
        } else {
            (npc as any).movementBehavior = { type: 'WANDER', interval: 24, lastMoveTurn: this.state.worldTime.totalTurns };
        }
    }

    private getRestrictedBiomesForRole(role: string): string[] | undefined {
        switch (role) {
            case 'Traveler': return ['Plains', 'Farmland', 'Forest'];
            case 'Hunter': return ['Forest', 'Hills', 'Tundra'];
            case 'Druid': return ['Forest', 'Jungle', 'Swamp'];
            case 'Nomad': return ['Desert', 'Tundra', 'Plains'];
            case 'Sailor': return ['Coast', 'Ocean'];
            case 'Prospector': return ['Hills', 'Mountains'];
            case 'Archaeologist': return ['Ruins', 'Volcanic', 'Desert'];
            default: return undefined;
        }
    }

    private executeMovement(npc: WorldNPC, currentTurn: number): void {
        const currentHexId = this.getNpcCurrentHexId(npc.id);
        if (!currentHexId) return;

        const currentHex = this.state.worldMap.hexes[currentHexId];
        const behavior = npc.movementBehavior!;
        let targetHexId: string | null = null;

        switch (behavior.type) {
            case 'TRADE_ROUTE':
                targetHexId = this.calculateTradeRouteMove(npc, currentHexId);
                break;
            case 'PATROL':
                targetHexId = this.calculatePatrolMove(npc, currentHexId);
                break;
            case 'WANDER':
                targetHexId = this.calculateWanderMove(npc, currentHexId);
                break;
            case 'HOSTILE':
                targetHexId = this.calculateHostileMove(npc, currentHexId);
                break;
        }

        if (targetHexId && targetHexId !== currentHexId) {
            this.log(`[NPC] ${npc.name} moving from ${currentHexId} to ${targetHexId}`);
            this.performMove(npc, currentHexId, targetHexId, currentTurn);
        } else {
            this.log(`[NPC] ${npc.name} staying at ${currentHexId} (No valid destination)`);
            // Update timestamp even if no move made to prevent spamming checks
            (npc.movementBehavior as any).lastMoveTurn = currentTurn;
        }
    }

    private calculateTradeRouteMove(npc: WorldNPC, currentHexId: string): string | null {
        const behavior = npc.movementBehavior!;
        const [cq, cr] = currentHexId.split(',').map(Number);
        const neighbors = this.hexMapManager.getNeighbors([cq, cr]);
        const roadNeighbors: string[] = [];

        for (const neighbor of neighbors) {
            if (!neighbor?.generated) continue;

            const sideIndex = HexMapManager.getSideIndex(
                this.state.worldMap.hexes[currentHexId].coordinates,
                neighbor.coordinates
            );
            const connection = this.hexMapManager.getConnection(this.state.worldMap.hexes[currentHexId], sideIndex);

            if (connection && (connection.type === 'R' || connection.type === 'P')) {
                roadNeighbors.push(`${neighbor.coordinates[0]},${neighbor.coordinates[1]}`);
            }
        }

        if (roadNeighbors.length === 0) {
            this.log(`[NPC] ${npc.name} (Trade Route) - No road/path neighbors found at ${currentHexId}`);
            return null;
        }

        const target = roadNeighbors[Math.floor(Math.random() * roadNeighbors.length)];
        this.log(`[NPC] ${npc.name} (Trade Route) - Found ${roadNeighbors.length} road(s), picking ${target}`);
        return target;
    }

    private calculatePatrolMove(npc: WorldNPC, currentHexId: string): string | null {
        const behavior = npc.movementBehavior!;
        if (!behavior.anchorHex) (npc.movementBehavior as any).anchorHex = currentHexId;

        const [pq, pr] = currentHexId.split(',').map(Number);
        const neighbors = this.hexMapManager.getNeighbors([pq, pr]);
        const validNeighbors = neighbors.filter((neighbor: any) => {
            if (!neighbor?.generated) return false;

            // Distance check
            const dist = MovementEngine.getDistance(
                this.state.worldMap.hexes[behavior.anchorHex!].coordinates,
                neighbor.coordinates
            );
            if (dist > (behavior.patrolRadius || 3)) return false;

            // Biome check
            if (behavior.restrictedBiomes && !behavior.restrictedBiomes.includes(neighbor.biome)) return false;

            return true;
        });

        if (validNeighbors.length === 0) {
            this.log(`[NPC] ${npc.name} (Patrol) - No valid neighbors within radius ${behavior.patrolRadius || 3} of anchor ${behavior.anchorHex}`);
            return null;
        }

        const chosen = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        const targetId = `${chosen.coordinates[0]},${chosen.coordinates[1]}`;
        this.log(`[NPC] ${npc.name} (Patrol) - Found ${validNeighbors.length} neighbors, picking ${targetId}`);
        return targetId;
    }

    private calculateWanderMove(npc: WorldNPC, currentHexId: string): string | null {
        const behavior = npc.movementBehavior!;
        const [wq, wr] = currentHexId.split(',').map(Number);
        const neighbors = this.hexMapManager.getNeighbors([wq, wr]);
        const validNeighbors = neighbors.filter((neighbor: any) => {
            if (!neighbor?.generated) return false;

            // Biome check
            if (behavior.restrictedBiomes && !behavior.restrictedBiomes.includes(neighbor.biome)) return false;

            return true;
        });

        if (validNeighbors.length === 0) {
            this.log(`[NPC] ${npc.name} (Wander) - All ${neighbors.length} neighbors blocked by biomes: ${behavior.restrictedBiomes?.join(', ')}`);
            return null;
        }

        const chosen = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        const targetId = `${chosen.coordinates[0]},${chosen.coordinates[1]}`;
        this.log(`[NPC] ${npc.name} (Wander) - Found ${validNeighbors.length} valid biomes, picking ${targetId}`);
        return targetId;
    }

    private calculateHostileMove(npc: WorldNPC, currentHexId: string): string | null {
        // Simplified: behave like wander for now, but focus on roads
        return this.calculateWanderMove(npc, currentHexId);
    }

    private performMove(npc: WorldNPC, fromHexId: string, toHexId: string, currentTurn: number): void {
        const fromHex = this.state.worldMap.hexes[fromHexId];
        const toHex = this.state.worldMap.hexes[toHexId];
        const playerHexId = this.state.location.hexId;

        // Narration triggers
        if (fromHexId === playerHexId) {
            this.log(`${npc.name} (${npc.role}) packs up and departs.`);
        } else if (toHexId === playerHexId) {
            this.log(`${npc.name} (${npc.role}) arrives in your location.`);
        }

        // Remove from old
        if (fromHex.npcs) {
            fromHex.npcs = fromHex.npcs.filter((id: string) => id !== npc.id);
        }

        // Add to new
        if (!toHex.npcs) toHex.npcs = [];
        if (!toHex.npcs.includes(npc.id)) {
            toHex.npcs.push(npc.id);
        }

        // Update behavior
        Object.assign(npc.movementBehavior!, { lastMoveTurn: currentTurn });

        // Trigger inventory refresh for merchants/smugglers
        if (npc.role === 'Merchant' || npc.role === 'Smuggler') {
            ShopEngine.refreshInventory(npc, toHex.biome as BiomeType);
        }

        this.onEmitState();
    }

    private getNpcCurrentHexId(npcId: string): string | null {
        for (const hexId in this.state.worldMap.hexes) {
            const hex = this.state.worldMap.hexes[hexId];
            if (hex.npcs && hex.npcs.includes(npcId)) return hexId;
        }
        return null;
    }
}
