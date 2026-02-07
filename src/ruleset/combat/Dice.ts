export class Dice {
    /**
     * Rolls a specific number of dice with a modifier.
     * Format: 2d6+4
     */
    public static roll(formula: string): number {
        const match = formula.match(/^(\d+)d(\d+)(?:\s*([-+]\s*)(\d+))?$/i);
        if (!match) {
            console.error(`Invalid dice formula: ${formula}`);
            return 0;
        }

        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const op = match[3] || '+';
        const mod = match[4] ? parseInt(match[4]) : 0;

        let total = 0;
        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }

        return op.includes('-') ? total - mod : total + mod;
    }

    /**
     * Standard d20 roll
     */
    public static d20(): number {
        return Math.floor(Math.random() * 20) + 1;
    }

    public static advantage(): number {
        return Math.max(this.d20(), this.d20());
    }

    public static disadvantage(): number {
        return Math.min(this.d20(), this.d20());
    }
}
