import { GameState } from '../schemas/FullSaveStateSchema';
import { HexMapManager } from '../combat/HexMapManager';
import { EngineCallSchema } from './ICPSchemas';
import { DataManager } from '../data/DataManager';
import { Dice } from '../combat/Dice';
import { z } from 'zod';

type EngineCall = z.infer<typeof EngineCallSchema>;

export class EngineDispatcher {
    /**
     * Dispatches a list of engine calls suggested by an LLM agent.
     */
    public static dispatch(
        calls: EngineCall[],
        state: GameState,
        hexManager: HexMapManager,
        engines: {
            mechanics?: any;
            factions?: any;
            worldClock?: any;
            movement?: any;
            combatInitializer: (encounter: any) => void;
        }
    ) {
        if (!calls || calls.length === 0) return;

        for (const call of calls) {
            console.log(`[EngineDispatcher] Executing: ${call.function}`, call.args);

            try {
                switch (call.function) {
                    case 'add_xp':
                        state.character.xp += (call.args.amount || 0);
                        break;

                    case 'modify_hp':
                        const hpAmount = call.args.amount || 0;
                        state.character.hp.current = Math.min(
                            state.character.hp.max,
                            Math.max(0, state.character.hp.current + hpAmount)
                        );
                        break;

                    case 'add_item':
                        const itemData = DataManager.getItem(call.args.itemId);
                        if (itemData) {
                            state.character.inventory.items.push({
                                id: call.args.itemId,
                                name: itemData.name,
                                type: itemData.type,
                                weight: itemData.weight,
                                instanceId: Dice.roll('1d1000').toString(),
                                quantity: call.args.quantity || 1,
                                equipped: false
                            });
                        }
                        break;

                    case 'remove_item':
                        const itemIndex = state.character.inventory.items.findIndex(i => i.id === call.args.itemId);
                        if (itemIndex > -1) {
                            const item = state.character.inventory.items[itemIndex];
                            if (call.args.quantity && item.quantity > call.args.quantity) {
                                item.quantity -= call.args.quantity;
                            } else {
                                state.character.inventory.items.splice(itemIndex, 1);
                            }
                        }
                        break;

                    case 'modify_gold':
                        // Assuming gp as the primary denomination for LLM simplicity
                        if (!state.character.inventory.gold) state.character.inventory.gold = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
                        state.character.inventory.gold.gp += (call.args.amount || 0);
                        break;

                    case 'set_condition':
                        if (call.args.condition && !state.character.conditions.includes(call.args.condition)) {
                            state.character.conditions.push(call.args.condition);
                        }
                        break;

                    case 'discover_poi':
                        const currentHex = hexManager.getHex(state.location.hexId);
                        if (currentHex && call.args.poiId) {
                            const poi = currentHex.interest_points.find(p => p.id === call.args.poiId);
                            if (poi) poi.discovered = true;
                        }
                        break;

                    case 'update_quest':
                        const quest = state.activeQuests.find(q => q.id === call.args.questId || q.title === call.args.questId);
                        if (quest) {
                            if (call.args.status) quest.status = call.args.status;
                            if (call.args.objectiveId) {
                                const obj = quest.objectives.find(o => o.id === call.args.objectiveId);
                                if (obj) obj.isCompleted = true;
                            }
                        }
                        break;

                    case 'set_faction_standing':
                        const faction = state.factions.find(f => f.id === call.args.factionId);
                        if (faction) {
                            faction.standing = Math.min(100, Math.max(-100, call.args.standing));
                        }
                        break;

                    case 'advance_time':
                        // Assuming call.args.hours. Logic would usually call worldClockEngine.
                        if (engines.worldClock && engines.worldClock.advanceTime) {
                            engines.worldClock.advanceTime(state, call.args.hours || 1);
                        } else {
                            state.worldTime.hour += (call.args.hours || 1);
                            // Basic rollover
                            if (state.worldTime.hour >= 24) {
                                state.worldTime.day += Math.floor(state.worldTime.hour / 24);
                                state.worldTime.hour %= 24;
                            }
                        }
                        break;

                    case 'start_combat':
                        engines.combatInitializer({
                            name: call.args.encounterName || 'Combat',
                            description: call.args.description || 'A fight breaks out!',
                            monsters: call.args.monsters || ['Goblin'],
                            difficulty: call.args.difficulty || state.character.level
                        });
                        break;

                    case 'spawn_npc':
                        // Push to room or hex state
                        if (state.location.roomId) {
                            // Logic for room NPCs
                        }
                        break;

                    case 'skill_check':
                        // This usually returns a result to the LLM, but here we can log it or apply auto-effects
                        const skillResult = Dice.roll('1d20') + Math.floor(((state.character.stats[call.args.stat as keyof typeof state.character.stats] || 10) - 10) / 2);
                        console.log(`[EngineDispatcher] Manual Skill Check (${call.args.skill}): ${skillResult} vs DC ${call.args.dc}`);
                        break;

                    default:
                        console.warn(`[EngineDispatcher] Unhandled function: ${call.function}`);
                }
            } catch (err) {
                console.error(`[EngineDispatcher] Failed to execute ${call.function}:`, err);
            }
        }
    }
}
