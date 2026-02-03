export class IntentRouter {
    /**
     * Parses the raw player input to find the primary intent.
     */
    static parse(input, inCombat = false) {
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
        const combatKeywords = ['attack', 'dodge', 'dash', 'disengage', 'hide'];
        if (inCombat && combatKeywords.some(k => trimmed.toLowerCase().includes(k))) {
            return {
                type: 'COMBAT_ACTION',
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
