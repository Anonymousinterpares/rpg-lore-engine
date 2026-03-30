/**
 * QuestRenderer — Quest objectives with progress tracking
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

export function renderQuests(state: GameState): string {
    const quests = state.activeQuests || [];
    const lines: string[] = [];

    if (quests.length === 0) {
        lines.push('  No active quests.');
        return lines.join('\n');
    }

    for (const quest of quests) {
        const statusTag = quest.status === 'COMPLETED' ? '[DONE]' :
                          quest.status === 'FAILED' ? '[FAILED]' :
                          quest.isNew ? '[NEW]' : '[ACTIVE]';
        lines.push(`  ${quest.title} ${statusTag}`);
        lines.push(`    ${quest.description}`);

        if (quest.objectives) {
            for (const obj of quest.objectives) {
                if (obj.isHidden) continue;
                const check = obj.isCompleted ? 'X' : ' ';
                const progress = obj.maxProgress > 1 ? ` (${obj.currentProgress}/${obj.maxProgress})` : '';
                lines.push(`    [${check}] ${obj.description}${progress}`);
            }
        }

        // Rewards
        const r = quest.rewards;
        if (r) {
            const rewardParts: string[] = [];
            if (r.xp) rewardParts.push(`${r.xp} XP`);
            if (r.gold?.gp) rewardParts.push(`${r.gold.gp}gp`);
            if (r.items?.length > 0) rewardParts.push(`${r.items.length} item(s)`);
            if (rewardParts.length > 0) {
                lines.push(`    Rewards: ${rewardParts.join(', ')}`);
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}
