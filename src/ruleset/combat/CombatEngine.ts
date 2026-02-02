import { CombatantState } from './types';
import { Dice } from './Dice';

export interface AttackResult {
    hit: boolean;
    crit: boolean;
    roll: number;
    total: number;
    damageDice?: string;
    damageTotal?: number;
    message: string;
}

export class CombatEngine {
    /**
     * Resolves an attack roll d20 + mod vs AC
     */
    public static resolveAttack(
        attacker: CombatantState,
        target: CombatantState,
        attackBonus: number,
        damageDice: string,
        damageBonus: number,
        advantage: 'none' | 'advantage' | 'disadvantage' = 'none'
    ): AttackResult {
        let d20 = Dice.d20();

        if (advantage === 'advantage') {
            d20 = Math.max(d20, Dice.d20());
        } else if (advantage === 'disadvantage') {
            d20 = Math.min(d20, Dice.d20());
        }

        const crit = d20 === 20;
        const miss = d20 === 1;
        const total = d20 + attackBonus;

        // Cover calculation
        let effectiveAC = target.ac;
        if (target.tactical.cover === 'Half') effectiveAC += 2;
        else if (target.tactical.cover === 'Three-Quarters') effectiveAC += 5;

        const hit = !miss && (crit || total >= effectiveAC);
        const hitNormalAC = !miss && (crit || total >= target.ac);
        const targetACWithCover = effectiveAC;

        if (target.tactical.cover === 'Full' && !crit) {
            return {
                hit: false,
                crit: false,
                roll: d20,
                total,
                message: `${attacker.name} cannot target ${target.name} due to Full Cover.`
            };
        }

        let resultMessage = '';
        let damageTotal = 0;

        if (miss) {
            resultMessage = `${attacker.name} rolled a natural 1 and missed ${target.name} spectacularly.`;
        } else if (crit) {
            damageTotal = Dice.roll(damageDice) + Dice.roll(damageDice) + damageBonus;
            resultMessage = `${attacker.name} scored a CRITICAL HIT on ${target.name}!`;
        } else if (hit) {
            damageTotal = Dice.roll(damageDice) + damageBonus;
            resultMessage = `${attacker.name} hits ${target.name} (Roll: ${total} vs AC: ${targetACWithCover}${target.tactical.cover !== 'None' ? ' [Covered]' : ''}).`;
        } else {
            resultMessage = `${attacker.name} missed ${target.name} (Roll: ${total} vs AC: ${targetACWithCover}${target.tactical.cover !== 'None' ? ' [Covered]' : ''}).`;
        }

        if (hit) {
            this.applyDamage(target, damageTotal);
        }

        return {
            hit,
            crit,
            roll: d20,
            total,
            damageDice,
            damageTotal,
            message: resultMessage
        };
    }

    /**
     * Applies damage to a target, considering temporary HP first
     */
    public static applyDamage(target: CombatantState, amount: number) {
        let remaining = amount;

        if (target.hp.temp > 0) {
            const absorbed = Math.min(target.hp.temp, remaining);
            target.hp.temp -= absorbed;
            remaining -= absorbed;
        }

        target.hp.current = Math.max(0, target.hp.current - remaining);
    }

    /**
     * Applies healing to a target
     */
    public static applyHealing(target: CombatantState, amount: number) {
        target.hp.current = Math.min(target.hp.max, target.hp.current + amount);
    }
}
