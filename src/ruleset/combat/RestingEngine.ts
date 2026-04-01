import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';
import { SkillEngine } from './SkillEngine';

export interface RestResult {
    message: string;
    timeCost: number; // In minutes
}

export class RestingEngine {
    /**
     * Executes a proportional rest based on time spent.
     * @param pc The character resting
     * @param durationMinutes Total minutes actually spent
     * @param type Whether this was a 'rest' (recovering) or 'wait' (passing time)
     */
    public static applyProportionalRest(pc: PlayerCharacter, durationMinutes: number, type: 'rest' | 'wait'): RestResult {
        if (type === 'wait') {
            return {
                message: `You wait for ${durationMinutes} minutes.`,
                timeCost: durationMinutes
            };
        }

        // Rest ratio (based on 8-hour long rest)
        const ratio = Math.min(1.0, durationMinutes / 480);

        // 1. HP Recovery (Medicine tier boosts short rest healing)
        // Long rest (8h) recovers 100%. Fractional rest recovers ratio * max.
        // Medicine: Tier 2 +25%, Tier 3+ +50% bonus to HP recovery (short rests only)
        let medicineMult = 1.0;
        if (durationMinutes < 480) { // Only for short rests (not long rests which are already 100%)
            const medicineTier = SkillEngine.getSkillTier(pc, 'Medicine');
            if (medicineTier >= 3) medicineMult = 1.5;
            else if (medicineTier >= 2) medicineMult = 1.25;
        }
        const oldHp = pc.hp.current;
        const hpToRecover = Math.floor(pc.hp.max * ratio * medicineMult);
        pc.hp.current = Math.min(pc.hp.max, pc.hp.current + hpToRecover);
        const actualHpHealed = pc.hp.current - oldHp;

        // 2. Hit Dice Recovery
        // Long rest (8h) recovers 50% max dice. Fractional recovers ratio * 50% max.
        const maxRegain = Math.max(1, Math.floor(pc.hitDice.max / 2));
        const regainAmount = Math.floor(maxRegain * ratio);
        const oldDice = pc.hitDice.current;
        pc.hitDice.current = Math.min(pc.hitDice.max, pc.hitDice.current + regainAmount);
        const actualDiceRegained = pc.hitDice.current - oldDice;

        // 3. Spell Slot Recovery
        // We calculate total "slot levels" missing and recover a proportional amount.
        let totalMissingSlots = 0;
        let totalMaxSlots = 0;
        Object.values(pc.spellSlots).forEach(slot => {
            totalMissingSlots += (slot.max - slot.current);
            totalMaxSlots += slot.max;
        });

        let slotsToRecover = Math.floor(totalMaxSlots * ratio);
        let actualSlotsRegained = 0;

        if (slotsToRecover > 0) {
            // Restore from lowest level up
            const levels = Object.keys(pc.spellSlots).sort((a, b) => parseInt(a) - parseInt(b));
            for (const level of levels) {
                const slot = pc.spellSlots[level];
                const space = slot.max - slot.current;
                const canRecover = Math.min(space, slotsToRecover);
                slot.current += canRecover;
                slotsToRecover -= canRecover;
                actualSlotsRegained += canRecover;
                if (slotsToRecover <= 0) break;
            }
        }

        let message = `${pc.name} rested for ${durationMinutes} minutes. `;
        if (actualHpHealed > 0) message += `Recovered ${actualHpHealed} HP. `;
        if (actualDiceRegained > 0) message += `Regained ${actualDiceRegained} Hit Dice. `;
        if (actualSlotsRegained > 0) message += `Restored ${actualSlotsRegained} spell slots. `;

        if (actualHpHealed === 0 && actualDiceRegained === 0 && actualSlotsRegained === 0) {
            message += `The rest was too short to provide significant recovery.`;
        }

        return {
            message: message.trim(),
            timeCost: durationMinutes
        };
    }

    /**
     * Executes a Short Rest (1 hour) - Legacy wrapper or specific logic
     */
    public static shortRest(pc: PlayerCharacter, diceToSpend: number = 0): RestResult {
        // We keep the hit dice spending mechanic for explicit short rests if called
        if (diceToSpend > pc.hitDice.current) {
            return { message: `Not enough hit dice remaining (Current: ${pc.hitDice.current}).`, timeCost: 0 };
        }

        let totalHealed = 0;
        const conMod = MechanicsEngine.getModifier(pc.stats['CON'] || 10);

        // Medicine tier bonus for hit dice healing
        const medicineTier = SkillEngine.getSkillTier(pc, 'Medicine');
        const medicineMult = medicineTier >= 3 ? 1.5 : medicineTier >= 2 ? 1.25 : 1.0;

        for (let i = 0; i < diceToSpend; i++) {
            const roll = Dice.roll(pc.hitDice.dieType);
            totalHealed += Math.max(0, Math.floor((roll + conMod) * medicineMult));
            pc.hitDice.current--;
        }

        const oldHp = pc.hp.current;
        pc.hp.current = Math.min(pc.hp.max, pc.hp.current + totalHealed);
        const actualHealed = pc.hp.current - oldHp;

        // Also apply 1/8th of long rest benefits because 1 hour passed
        const propResult = this.applyProportionalRest(pc, 60, 'rest');

        return {
            message: `Short Rest: Spent ${diceToSpend} Hit Dice, healed ${actualHealed} HP. ` + propResult.message,
            timeCost: 60
        };
    }

    /**
     * Executes a Long Rest (8 hours) - Regains all
     */
    public static longRest(pc: PlayerCharacter): RestResult {
        return this.applyProportionalRest(pc, 480, 'rest');
    }

    /**
     * Executes a Wait (Pass Time)
     * No healing, just time cost.
     */
    public static wait(minutes: number): RestResult {
        return {
            message: `You wait for ${minutes} minutes.`,
            timeCost: minutes
        };
    }
}
