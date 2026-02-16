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
        const combatKeywords = ['attack', 'dodge', 'dash', 'disengage', 'hide', 'end turn', 'use', 'target'];
        if (inCombat && combatKeywords.some(k => trimmed.toLowerCase().includes(k))) {
            const cmd = combatKeywords.find(k => trimmed.toLowerCase().includes(k));

            // Extract args: remove the matched keyword and split the rest
            const remaining = trimmed.toLowerCase().replace(cmd!, '').trim();
            const args = remaining ? remaining.split(/\s+/) : [];

            return {
                type: 'COMBAT_ACTION',
                command: cmd,
                args,
                originalInput: input
            };
        }

        // 2.5 Check for Explicit System Keywords (Exploration)
        if (!inCombat) {
            const lower = trimmed.toLowerCase();
            if (lower === 'rest' || lower === 'short rest') {
                return { type: 'COMMAND', command: 'rest', args: ['short'], originalInput: input };
            }
            if (lower === 'long rest') {
                return { type: 'COMMAND', command: 'rest', args: ['long'], originalInput: input };
            }
            if (lower === 'survey') {
                return { type: 'COMMAND', command: 'survey', args: [], originalInput: input };
            }
            if (lower.startsWith('wait')) {
                const parts = trimmed.split(' ');
                return { type: 'COMMAND', command: 'wait', args: parts.slice(1), originalInput: input };
            }
            if (lower.startsWith('move')) {
                // Parse "move north" or "moveto 1 -1"
                const parts = trimmed.split(' ');
                return { type: 'COMMAND', command: parts[0], args: parts.slice(1), originalInput: input };
            }
        }

        // 3. Default to Narrative
        return {
            type: 'NARRATIVE',
            originalInput: input
        };
    }
}
