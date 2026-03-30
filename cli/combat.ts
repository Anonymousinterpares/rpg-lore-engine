/**
 * Combat input helper — maps numbered selections to tactical commands
 */

/**
 * Given tactical options and user input, resolve to a game command.
 * - Numeric input (e.g., "1") maps to options[0].command
 * - Sub-option input (e.g., "1a") maps to options[0].subOptions[0].command
 * - Otherwise returns the input unchanged (pass-through to engine)
 */
export function resolveCombatInput(userInput: string, options: any[]): string {
    const trimmed = userInput.trim();

    // Check for numbered option (e.g., "1", "3")
    const numMatch = trimmed.match(/^(\d+)([a-z])?$/);
    if (numMatch && options.length > 0) {
        const optIdx = parseInt(numMatch[1]) - 1;
        const subChar = numMatch[2];

        if (optIdx >= 0 && optIdx < options.length) {
            const option = options[optIdx];

            if (subChar && option.subOptions?.length > 0) {
                const subIdx = subChar.charCodeAt(0) - 97; // 'a' = 0
                if (subIdx >= 0 && subIdx < option.subOptions.length) {
                    return option.subOptions[subIdx].command;
                }
            }

            return option.command;
        }
    }

    // Pass through common combat keywords directly
    return trimmed;
}
