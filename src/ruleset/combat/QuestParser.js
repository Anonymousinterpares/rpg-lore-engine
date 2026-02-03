import { z } from 'zod';
import { QuestSchema } from '../schemas/QuestSchema';
import { QuestEngine } from './QuestEngine';
// ICP Tag Schemas
export const QuestStartTagSchema = QuestSchema.omit({ status: true });
export const QuestUpdateTagSchema = z.object({
    questId: z.string(),
    objectiveId: z.string(),
    progress: z.number()
});
export const QuestCompleteTagSchema = z.object({
    questId: z.string()
});
export const QuestFailTagSchema = z.object({
    questId: z.string(),
    reason: z.string()
});
export class QuestParser {
    /**
     * Parses LLM output for [QUEST_*] tags and applies them to state.
     */
    static parseAndApply(text, state) {
        const logs = [];
        // 1. !!QUEST_START: {...} !!
        const startRegex = /!!QUEST_START:\s*(.*?)\s*!!/gs;
        let match;
        while ((match = startRegex.exec(text)) !== null) {
            try {
                const jsonStr = match[1].trim().replace(/\n/g, ' ');
                const data = JSON.parse(jsonStr);
                const validated = QuestStartTagSchema.parse(data);
                // Check if already active
                if (state.activeQuests && state.activeQuests.find(q => q.id === validated.id)) {
                    continue;
                }
                state.activeQuests = state.activeQuests || [];
                state.activeQuests.push({ ...validated, status: 'ACTIVE' });
                logs.push(`Quest Started: ${validated.title}`);
            }
            catch (e) {
                console.warn('Malformed QUEST_START tag:', e.message, 'Raw:', match[1]);
            }
        }
        // 2. !!QUEST_UPDATE: {...} !!
        const updateRegex = /!!QUEST_UPDATE:\s*(.*?)\s*!!/gs;
        while ((match = updateRegex.exec(text)) !== null) {
            try {
                const jsonStr = match[1].trim().replace(/\n/g, ' ');
                const data = JSON.parse(jsonStr);
                const validated = QuestUpdateTagSchema.parse(data);
                const quest = state.activeQuests?.find(q => q.id === validated.questId);
                if (quest) {
                    const result = QuestEngine.updateObjective(quest, validated.objectiveId, validated.progress);
                    logs.push(result);
                }
            }
            catch (e) {
                console.warn('Malformed QUEST_UPDATE tag:', e.message, 'Raw:', match[1]);
            }
        }
        // 3. !!QUEST_COMPLETE: {...} !!
        const completeRegex = /!!QUEST_COMPLETE:\s*(.*?)\s*!!/gs;
        while ((match = completeRegex.exec(text)) !== null) {
            try {
                const jsonStr = match[1].trim().replace(/\n/g, ' ');
                const data = JSON.parse(jsonStr);
                const validated = QuestCompleteTagSchema.parse(data);
                const result = QuestEngine.completeQuest(state, validated.questId);
                logs.push(result);
            }
            catch (e) {
                console.warn('Malformed QUEST_COMPLETE tag:', e.message, 'Raw:', match[1]);
            }
        }
        return logs;
    }
}
