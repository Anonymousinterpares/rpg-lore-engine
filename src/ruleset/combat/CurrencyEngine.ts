import { z } from 'zod';
import { CurrencySchema } from '../schemas/BaseSchemas';

export type Currency = z.infer<typeof CurrencySchema>;

export class CurrencyEngine {
    /**
     * Converts a currency object to its total value in copper pieces.
     */
    public static toCopper(currency: Currency): number {
        return ((currency.pp || 0) * 1000) +
            ((currency.gp || 0) * 100) +
            ((currency.ep || 0) * 50) +
            ((currency.sp || 0) * 10) +
            ((currency.cp || 0));
    }

    /**
     * Converts total copper back to the most efficient currency denominations.
     */
    public static fromCopper(totalCopper: number): Currency {
        let remaining = totalCopper;

        const pp = Math.floor(remaining / 1000);
        remaining %= 1000;

        const gp = Math.floor(remaining / 100);
        remaining %= 100;

        const ep = Math.floor(remaining / 50);
        remaining %= 50;

        const sp = Math.floor(remaining / 10);
        remaining %= 10;

        const cp = remaining;

        return { cp, sp, ep, gp, pp };
    }

    /**
     * Simplifies a currency object (e.g., 150cp -> 1gp 5sp).
     */
    public static normalize(currency: Currency): Currency {
        return this.fromCopper(this.toCopper(currency));
    }

    /**
     * Adds two currency amounts together.
     */
    public static add(a: Currency, b: Currency): Currency {
        return this.fromCopper(this.toCopper(a) + this.toCopper(b));
    }

    /**
     * Subtracts b from a. Returns null if result would be negative.
     */
    public static subtract(a: Currency, b: Currency): Currency | null {
        const totalA = this.toCopper(a);
        const totalB = this.toCopper(b);

        if (totalA < totalB) return null;

        return this.fromCopper(totalA - totalB);
    }

    /**
     * Checks if a wallet can afford a specific cost.
     */
    public static canAfford(wallet: Currency, cost: Currency): boolean {
        return this.toCopper(wallet) >= this.toCopper(cost);
    }

    /**
     * Formats currency for display (e.g., "1 gp, 5 sp").
     */
    public static format(currency: Currency): string {
        const parts: string[] = [];
        if (currency.pp > 0) parts.push(`${currency.pp}pp`);
        if (currency.gp > 0) parts.push(`${currency.gp}gp`);
        if (currency.ep > 0) parts.push(`${currency.ep}ep`);
        if (currency.sp > 0) parts.push(`${currency.sp}sp`);
        if (currency.cp > 0 || parts.length === 0) parts.push(`${currency.cp}cp`);

        return parts.join(', ');
    }
}
