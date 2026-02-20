import { GameState } from '../../schemas/FullSaveStateSchema';
import { Quest, QuestObjective } from '../../schemas/QuestSchema';
import { EventBusManager, GameEventType, GameEventPayload } from './EventBusManager';
import { InventoryManager } from './InventoryManager';
import { MechanicsEngine } from '../MechanicsEngine';

export class QuestEngine {
    private state: GameState;
    private onStateUpdate: () => Promise<void>;
    private inventoryManager: InventoryManager;
    private addCombatLog: (msg: string) => void;

    // Keep track of our event subscriptions so we can clean them up if needed
    private unsubscribers: Array<() => void> = [];

    constructor(
        state: GameState,
        inventoryManager: InventoryManager,
        onStateUpdate: () => Promise<void>,
        addCombatLog: (msg: string) => void
    ) {
        this.state = state;
        this.onStateUpdate = onStateUpdate;
        this.inventoryManager = inventoryManager;
        this.addCombatLog = addCombatLog;

        this.subscribeToEvents();
    }

    /**
     * Set up all listeners on the EventBus.
     */
    private subscribeToEvents() {
        this.unsubscribers.push(
            EventBusManager.subscribe('COMBAT_KILL', async (payload) => await this.handleCombatKill(payload)),
            EventBusManager.subscribe('ITEM_ACQUIRED', async (payload) => await this.handleItemStatus(payload)),
            EventBusManager.subscribe('ITEM_LOST', async (payload) => await this.handleItemStatus(payload)),
            EventBusManager.subscribe('HEX_DISCOVERED', async (payload) => await this.handleHexDiscovered(payload)),
            EventBusManager.subscribe('NPC_INTERACTION', async (payload) => await this.handleNpcInteraction(payload))
        );
    }

    /**
     * Unsubscribes from all events. Call when engine shuts down.
     */
    public cleanup() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
    }

    /**
     * To be called periodically by the GameLoop (e.g. every game hour or turn)
     */
    public async checkDeadlines(currentTurn: number) {
        let changed = false;

        for (const quest of this.state.activeQuests) {
            if (quest.status === 'ACTIVE' && quest.deadlineTurn && currentTurn >= quest.deadlineTurn) {
                quest.status = 'FAILED';
                this.addCombatLog(`[Quest Failed] ${quest.title} (Time expired)`);
                changed = true;
            }
        }

        if (changed) {
            await this.onStateUpdate();
        }
    }

    private async handleCombatKill(payload: GameEventPayload['COMBAT_KILL']) {
        let changed = false;

        for (const quest of this.state.activeQuests) {
            if (quest.status !== 'ACTIVE') continue;

            for (const obj of quest.objectives) {
                if (!obj.isCompleted && obj.type === 'KILL' && obj.targetId === payload.targetId) {
                    obj.currentProgress += payload.count;
                    if (obj.currentProgress >= obj.maxProgress) {
                        obj.currentProgress = obj.maxProgress;
                        obj.isCompleted = true;
                        this.addCombatLog(`[Objective Complete] ${obj.description}`);
                    }
                    changed = true;
                }
            }
            if (changed) {
                await this.checkQuestCompletion(quest);
            }
        }

        if (changed) await this.onStateUpdate();
    }

    private async handleItemStatus(payload: GameEventPayload['ITEM_ACQUIRED'] | GameEventPayload['ITEM_LOST']) {
        // Fetch is absolute state. We just recount the inventory.
        let changed = false;

        for (const quest of this.state.activeQuests) {
            if (quest.status !== 'ACTIVE') continue;

            for (const obj of quest.objectives) {
                if (obj.type === 'FETCH') {
                    const currentQuantity = this.state.character.inventory.items.filter(i => (i.id === obj.targetId || i.name === obj.targetId)).reduce((sum, item) => sum + (item.quantity || 1), 0);

                    // Since fetching items means holding them, you can un-complete a fetch objective by dropping it!
                    if (currentQuantity >= obj.maxProgress && !obj.isCompleted) {
                        obj.currentProgress = obj.maxProgress;
                        obj.isCompleted = true;
                        this.addCombatLog(`[Objective Complete] ${obj.description}`);
                        changed = true;
                    } else if (currentQuantity < obj.maxProgress && obj.isCompleted) {
                        obj.currentProgress = currentQuantity;
                        obj.isCompleted = false;
                        this.addCombatLog(`[Objective Reverted] ${obj.description} (You lost the items)`);
                        changed = true;
                    } else if (obj.currentProgress !== currentQuantity && currentQuantity < obj.maxProgress) {
                        obj.currentProgress = currentQuantity;
                        changed = true;
                    }
                }
            }

            if (changed) {
                await this.checkQuestCompletion(quest);
            }
        }

        if (changed) await this.onStateUpdate();
    }

    private async handleHexDiscovered(payload: GameEventPayload['HEX_DISCOVERED']) {
        let changed = false;

        for (const quest of this.state.activeQuests) {
            if (quest.status !== 'ACTIVE') continue;

            for (const obj of quest.objectives) {
                if (!obj.isCompleted && obj.type === 'EXPLORE') {
                    // Check if Target ID matches Hex ID, OR if coordinates match
                    const coordsMatch = obj.targetCoords &&
                        obj.targetCoords[0] === payload.coordinates[0] &&
                        obj.targetCoords[1] === payload.coordinates[1];

                    if (obj.targetId === payload.hexId || coordsMatch) {
                        obj.currentProgress = obj.maxProgress;
                        obj.isCompleted = true;
                        this.addCombatLog(`[Objective Complete] ${obj.description}`);
                        changed = true;
                    }
                }
            }

            if (changed) {
                await this.checkQuestCompletion(quest);
            }
        }

        if (changed) await this.onStateUpdate();
    }

    private async handleNpcInteraction(payload: GameEventPayload['NPC_INTERACTION']) {
        let changed = false;

        for (const quest of this.state.activeQuests) {
            if (quest.status !== 'ACTIVE') continue;

            for (const obj of quest.objectives) {
                if (!obj.isCompleted && obj.type === 'DELIVER' && obj.targetId === payload.npcId) {
                    obj.currentProgress = obj.maxProgress;
                    obj.isCompleted = true;
                    this.addCombatLog(`[Objective Complete] ${obj.description}`);
                    changed = true;
                }
            }

            if (changed) {
                await this.checkQuestCompletion(quest);
            }
        }

        if (changed) await this.onStateUpdate();
    }

    /**
     * Checks if all objectives are finished. 
     * If so, handles auto-completion or readies turn-in.
     */
    private async checkQuestCompletion(quest: Quest) {
        if (quest.status !== 'ACTIVE') return;

        const allCompleted = quest.objectives.every((obj: QuestObjective) => obj.isCompleted);

        if (allCompleted) {
            if (quest.giverNpcId) {
                // Determine if there is a "Return to X" objective. If not, add one invisibly or rely on UI
                const turnInObjExists = quest.objectives.some((o: QuestObjective) => o.type === 'DELIVER' && o.targetId === quest.giverNpcId);

                if (!turnInObjExists) {
                    const giverNpc = this.state.worldNpcs.find(n => n.id === quest.giverNpcId);
                    const giverName = giverNpc ? giverNpc.name : 'the quest giver';

                    quest.objectives.push({
                        id: `turn_in_${Date.now()}`,
                        type: 'DELIVER',
                        targetId: quest.giverNpcId,
                        description: `Return to ${giverName}`,
                        currentProgress: 0,
                        maxProgress: 1,
                        isCompleted: false,
                        isHidden: false
                    });
                }
            } else {
                // Auto-complete (no turn in required)
                await this.completeQuest(quest);
            }
        }
    }

    /**
     * Grants rewards and resolves the quest. Can be triggered manually via LLM tool call if NPC requires turn-in.
     */
    public async completeQuest(quest: Quest) {
        if (quest.status === 'COMPLETED') return;

        quest.status = 'COMPLETED';
        this.addCombatLog(`[Quest Complete] ${quest.title}`);

        // Grant XP
        if (quest.rewards.xp > 0) {
            this.state.character.xp += quest.rewards.xp;
            this.addCombatLog(`**+${quest.rewards.xp} XP**`);

            // Level up check
            const nextThreshold = MechanicsEngine.getNextLevelXP(this.state.character.level);
            if (this.state.character.xp >= nextThreshold && this.state.character.level < 20) {
                this.state.character.level++;
                this.state.character.hp.max += 10;
                this.state.character.hp.current = this.state.character.hp.max;
                Object.values(this.state.character.spellSlots).forEach(s => s.current = s.max);
                this.addCombatLog(`LEVEL UP! You are now level ${this.state.character.level}. HP and Spell Slots restored.`);
            }
        }

        // Grant Gold
        if (quest.rewards.gold && Object.values(quest.rewards.gold).some(v => (v as number) > 0)) {
            const { gp = 0, sp = 0, cp = 0 } = quest.rewards.gold;
            this.state.character.inventory.gold.gp += gp;
            this.state.character.inventory.gold.sp += sp;
            this.state.character.inventory.gold.cp += cp;

            let goldStr = [];
            if (gp) goldStr.push(`${gp}gp`);
            if (sp) goldStr.push(`${sp}sp`);
            if (cp) goldStr.push(`${cp}cp`);
            this.addCombatLog(`**+${goldStr.join(', ')}**`);
        }

        // Grant Items
        if (quest.rewards.items && quest.rewards.items.length > 0) {
            for (const itemId of quest.rewards.items) {
                this.inventoryManager.addItem(itemId, 1);
            }
        }

        // Push Notification
        this.state.notifications.push({
            id: `q_comp_${Date.now()}`,
            type: 'SYSTEM_ERROR' as any, // We might need a QUEST_UPDATE type in Notifications schema
            message: `Quest Completed: ${quest.title}`,
            data: quest.id,
            isRead: false,
            createdAt: Date.now()
        });

        // The save routine doesn't explicitly have a completed quests array in schema yet,
        // it relies on activeQuests containing them with status COMPLETED or relying on a future migration.
        // For now, keeping it in activeQuests but marked COMPLETED works, 
        // they can be filtered out by the UI Quests panel.

        await this.onStateUpdate();
    }
}
