/**
 * DialogueHandler — NPC dialogue display
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

export function isInDialogue(state: GameState): boolean {
    return !!state.activeDialogueNpcId;
}

export function getDialoguePrompt(state: GameState): string {
    if (!state.activeDialogueNpcId) return '[EXPLORATION] > ';
    const npc = state.worldNpcs.find((n: any) => n.id === state.activeDialogueNpcId);
    return `[Talking to ${npc?.name || 'NPC'}] > `;
}

export function renderDialogueStatus(state: GameState): string {
    if (!state.activeDialogueNpcId) return '';
    const npc = state.worldNpcs.find((n: any) => n.id === state.activeDialogueNpcId);
    const lines = [`  In conversation with ${npc?.name || state.activeDialogueNpcId}`];
    lines.push('  Type freely to talk, or /endtalk to leave.');
    return lines.join('\n');
}
