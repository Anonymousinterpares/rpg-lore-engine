import { LevelingEngine } from './LevelingEngine';
import { CurrencyEngine } from './CurrencyEngine';
export class QuestEngine {
    /**
     * Updates an objective's progress. Checks if the quest is completed as a result.
     */
    static updateObjective(quest, objectiveId, progress) {
        const objective = quest.objectives.find(o => o.id === objectiveId);
        if (!objective)
            return `Objective ${objectiveId} not found in quest ${quest.title}.`;
        objective.currentProgress = Math.min(objective.maxProgress, objective.currentProgress + progress);
        if (objective.currentProgress >= objective.maxProgress) {
            objective.isCompleted = true;
        }
        const allDone = quest.objectives.every(o => o.isCompleted);
        if (allDone && quest.status === 'ACTIVE') {
            return `Objective complete: ${objective.description}. All objectives met!`;
        }
        return `Progress update: ${objective.description} (${objective.currentProgress}/${objective.maxProgress})`;
    }
    /**
     * Completes a quest and distributes rewards.
     */
    static completeQuest(state, questId) {
        const quest = state.activeQuests?.find(q => q.id === questId);
        if (!quest)
            return `Quest ${questId} not found in active quests.`;
        if (quest.status !== 'ACTIVE')
            return `Quest ${quest.title} is already ${quest.status}.`;
        quest.status = 'COMPLETED';
        let rewardMsg = '';
        if (quest.rewards) {
            // Distribute XP
            if (quest.rewards.xp > 0) {
                const { leveledUp } = LevelingEngine.addXP(state.character, quest.rewards.xp);
                rewardMsg += ` Gained ${quest.rewards.xp} XP.`;
                if (leveledUp)
                    rewardMsg += ` Level up available!`;
            }
            // Distribute Gold
            if (quest.rewards.gold) {
                state.character.inventory.gold = CurrencyEngine.add(state.character.inventory.gold, quest.rewards.gold);
                rewardMsg += ` Gained gold.`;
            }
            // Distribute Items (would normally add to inventory)
            if (quest.rewards.items && quest.rewards.items.length > 0) {
                rewardMsg += ` Gained items: ${quest.rewards.items.join(', ')}.`;
            }
        }
        return `Quest Completed: ${quest.title}!${rewardMsg}`;
    }
}
