export type IntentType = 'COMMAND' | 'COMBAT_ACTION' | 'NARRATIVE';

export interface ParsedIntent {
    type: IntentType;
    command?: string;
    args?: string[];
    originalInput: string;
}

export class IntentRouter {
    /**
     * Parses the raw player input to find the primary intent.
     */
    public static parse(input: string, inCombat: boolean = false): ParsedIntent {
        const trimmed = input.trim();

        // 1. Check for Commands
        if (trimmed.startsWith('/')) {
            const parts = trimmed.substring(1).split(' ');
            return {
                type: 'COMMAND',
                command: parts[0].toLowerCase(),
                args: parts.slice(1),
                originalInput: input
            };
        }

        // 2. Check for Combat Actions (if in combat)
        // Simple heuristic: if input matches common actions like "attack", "dodge"
        const combatKeywords = ['attack', 'dodge', 'dash', 'disengage', 'hide', 'end turn', 'use'];
        if (inCombat && combatKeywords.some(k => trimmed.toLowerCase().includes(k))) {
            const cmd = combatKeywords.find(k => trimmed.toLowerCase().includes(k));
            return {
                type: 'COMBAT_ACTION',
                command: cmd,
                originalInput: input
            };
        }

        // 3. Default to Narrative
        return {
            type: 'NARRATIVE',
            originalInput: input
        };
    }
}
