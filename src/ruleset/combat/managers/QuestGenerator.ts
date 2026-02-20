import { GameState } from '../../schemas/FullSaveStateSchema';
import { Quest } from '../../schemas/QuestSchema';
import { WorldNPC } from '../../schemas/WorldEnrichmentSchema';
import { HexMapManager } from '../HexMapManager';
import { BIOME_COMMERCE, MERCHANT_POOLS } from '../../data/MerchantInventoryPool';
import { SPAWN_TABLES } from '../../data/SpawnTables';
import { BiomeType } from '../../schemas/BiomeSchema';

export class QuestGenerator {
    private state: GameState;
    private hexMapManager: HexMapManager;
    private onStateUpdate: () => Promise<void>;
    private lastGenerationTurn: number = 0;
    private generationInterval: number = 144; // Once per 24 in-game hours (1 turn = usually 10 min, wait GameLoop is 5 min? 144 * 5 = 12h. Let's use 288 for 24h)

    constructor(
        state: GameState,
        hexMapManager: HexMapManager,
        onStateUpdate: () => Promise<void>
    ) {
        this.state = state;
        this.hexMapManager = hexMapManager;
        this.onStateUpdate = onStateUpdate;
        // Don't fire instantly on load
        this.lastGenerationTurn = state.worldTime.totalTurns;
    }

    public async processTurn(currentTurn: number) {
        // Assume 5 mins per turn (as per GameLoop advanceTimeAndProcess(5))
        // 24 hours = 1440 mins = 288 turns
        if (currentTurn - this.lastGenerationTurn >= 288) {
            this.lastGenerationTurn = currentTurn;
            await this.generateQuests();
        }
    }

    /**
     * For developer tool usage: force generation immediately
     */
    public async forceGenerate() {
        await this.generateQuests();
    }

    private async generateQuests() {
        if (!this.state.worldNpcs) return;

        let changed = false;

        for (const npc of this.state.worldNpcs) {
            if (!npc.availableQuests) npc.availableQuests = [];

            // Limit to 2 available quests per NPC
            if (npc.availableQuests.length < 2 && Math.random() < 0.25) {
                const quest = await this.createQuestForNPC(npc);
                if (quest) {
                    if (!this.state.activeQuests) this.state.activeQuests = [];
                    this.state.activeQuests.push(quest);
                    npc.availableQuests.push(quest.id);
                    changed = true;
                }
            }
        }

        if (changed) {
            await this.onStateUpdate();
        }
    }

    private async createQuestForNPC(npc: WorldNPC): Promise<Quest | null> {
        // Fallback to player's location. A more robust way would reverse-lookup HexMapManager map for hex.npcs.includes(npc.id)
        let npcCoords: [number, number] = [...this.state.location.coordinates];
        let npcBiome: BiomeType = 'Plains';
        if (this.state.worldMap && this.state.worldMap.hexes && this.state.location.hexId) {
            const hex = this.state.worldMap.hexes[this.state.location.hexId];
            if (hex && hex.biome) {
                npcBiome = hex.biome;
            }
        }

        const role = (npc.role || '').toLowerCase();
        let questType: 'KILL' | 'FETCH' | 'EXPLORE' | 'DELIVER' = 'FETCH';

        if (role.includes('guard') || role.includes('mercenary') || role.includes('soldier') || role.includes('hunter')) {
            questType = 'KILL';
        } else if (role.includes('scholar') || role.includes('sage') || role.includes('mage') || role.includes('priest')) {
            questType = Math.random() > 0.5 ? 'EXPLORE' : 'FETCH';
        } else if (role.includes('merchant') || role.includes('trader') || role.includes('blacksmith')) {
            questType = Math.random() > 0.5 ? 'FETCH' : 'DELIVER';
        } else {
            const types: ('KILL' | 'FETCH' | 'EXPLORE')[] = ['KILL', 'FETCH', 'EXPLORE'];
            questType = types[Math.floor(Math.random() * types.length)];
        }

        const questId = `q_${npc.id}_${Date.now()}`;

        switch (questType) {
            case 'EXPLORE': {
                const reservedCoords = await this.hexMapManager.reserveQuestHex(npcCoords, 3, 6, questId, `Lost Site of ${npc.name}`);
                if (!reservedCoords) return null;

                return {
                    id: questId,
                    title: `Investigate the Lost Site`,
                    description: `${npc.name} has uncovered map fragments pointing to a forgotten location. Investigate it.`,
                    giverNpcId: npc.id,
                    status: 'AVAILABLE',
                    isNew: true,
                    turnAccepted: 0,
                    deadlineTurn: this.state.worldTime.totalTurns + (288 * 14), // 14 days
                    rewards: { xp: 500, gold: { gp: 50, cp: 0, sp: 0, ep: 0, pp: 0 }, items: [] },
                    objectives: [{
                        id: `obj_1`,
                        description: `Discover the Lost Site`,
                        type: 'EXPLORE',
                        targetId: 'explore_location',
                        targetCoords: reservedCoords,
                        currentProgress: 0,
                        maxProgress: 1,
                        isCompleted: false,
                        isHidden: false
                    }]
                };
            }
            case 'KILL': {
                const genericMonsters: Record<string, string[]> = {
                    'Plains': ['Bandit', 'Goblin', 'Wolf'],
                    'Forest': ['Wolf', 'Giant Spider', 'Bandit', 'Goblin'],
                    'Mountains': ['Orc', 'Giant Eagle', 'Bandit'],
                    'Swamp': ['Skeleton', 'Giant Crocodile', 'Hag'],
                    'Desert': ['Giant Scorpion', 'Nomad Bandit', 'Mummy'],
                    'Tundra': ['Winter Wolf', 'Yeti', 'Bandit'],
                    'Underdark': ['Drow', 'Giant Spider', 'Hook Horror']
                };

                let targetMonster = 'Bandit';
                const options = genericMonsters[npcBiome] || ['Bandit', 'Goblin', 'Skeleton'];
                if (options.length > 0) {
                    targetMonster = options[Math.floor(Math.random() * options.length)];
                }
                const count = Math.floor(Math.random() * 3) + 2;

                return {
                    id: questId,
                    title: `Bounty: ${targetMonster}`,
                    description: `${npc.name} has posted a bounty to cull the local ${targetMonster} population threatening the area.`,
                    giverNpcId: npc.id,
                    status: 'AVAILABLE',
                    isNew: true,
                    turnAccepted: 0,
                    deadlineTurn: this.state.worldTime.totalTurns + (288 * 5), // 5 days
                    rewards: { xp: count * 100, gold: { gp: count * 15, cp: 0, sp: 0, ep: 0, pp: 0 }, items: [] },
                    objectives: [{
                        id: 'obj_1',
                        description: `Slay ${count} ${targetMonster}s`,
                        type: 'KILL',
                        targetId: targetMonster,
                        currentProgress: 0,
                        maxProgress: count,
                        isCompleted: false,
                        isHidden: false
                    }]
                };
            }
            case 'FETCH': {
                const pool = MERCHANT_POOLS[npcBiome];
                let targetItem = 'Iron Ore';
                if (pool && pool.length > 0) {
                    targetItem = pool[Math.floor(Math.random() * pool.length)];
                }
                const count = Math.floor(Math.random() * 3) + 3;

                return {
                    id: questId,
                    title: `Procure ${targetItem.replace(/_/g, ' ')}`,
                    description: `${npc.name} urgently requires specific local supplies for their work.`,
                    giverNpcId: npc.id,
                    status: 'AVAILABLE',
                    isNew: true,
                    turnAccepted: 0,
                    deadlineTurn: this.state.worldTime.totalTurns + (288 * 7), // 7 days
                    rewards: { xp: count * 25, gold: { gp: count * 5, cp: 0, sp: 0, ep: 0, pp: 0 }, items: [] },
                    objectives: [{
                        id: 'obj_1',
                        description: `Collect ${count} ${targetItem.replace(/_/g, ' ')}`,
                        type: 'FETCH',
                        targetId: targetItem,
                        currentProgress: 0,
                        maxProgress: count,
                        isCompleted: false,
                        isHidden: false
                    }]
                };
            }
            case 'DELIVER': {
                // Determine a random hex within a large radius to deliver to
                const reservedCoords = await this.hexMapManager.reserveQuestHex(npcCoords, 5, 8, questId, `Trade Point`);
                if (!reservedCoords) return null;

                return {
                    id: questId,
                    title: `Special Delivery`,
                    description: `${npc.name} needs a secure package delivered to a specific remote rendezvous point.`,
                    giverNpcId: npc.id,
                    status: 'AVAILABLE',
                    isNew: true,
                    turnAccepted: 0,
                    deadlineTurn: this.state.worldTime.totalTurns + (288 * 10), // 10 days
                    rewards: { xp: 300, gold: { gp: 75, cp: 0, sp: 0, ep: 0, pp: 0 }, items: [] },
                    objectives: [{
                        id: 'obj_1',
                        description: `Reach the Delivery Point`,
                        type: 'EXPLORE',
                        targetId: 'delivery_point',
                        targetCoords: reservedCoords,
                        currentProgress: 0,
                        maxProgress: 1,
                        isCompleted: false,
                        isHidden: false
                    }]
                };
            }
        }
        return null;
    }
}
