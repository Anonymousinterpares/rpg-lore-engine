import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';
import { SkillEngine } from './SkillEngine';
import { SkillAbilityEngine } from './SkillAbilityEngine';

export interface RestResult {
    message: string;
    timeCost: number; // In minutes
    arcaneRecoveryAvailable?: boolean; // Wizard-only: can recover spell slots after short rest
    arcaneRecoveryBudget?: number;     // Max total spell levels to recover
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

        // Medicine T4 passive: party gains temp HP equal to WIS mod after long rest (8h)
        if (durationMinutes >= 480 && SkillAbilityEngine.hasPassiveAbility(pc, 'Medicine', 4)) {
            const wisMod = Math.max(1, MechanicsEngine.getModifier(pc.stats['WIS'] || 10));
            pc.hp.temp = (pc.hp.temp || 0) + wisMod;
            message += `Vital Ward: +${wisMod} temp HP. `;
        }

        // Reset ability uses on rest
        SkillAbilityEngine.resetAbilityUses(pc, durationMinutes >= 480 ? 'long' : 'short');

        // Reset class feature usages (featureUsages) based on rest type
        const isLongRest = durationMinutes >= 480;
        if (pc.featureUsages) {
            for (const [name, usage] of Object.entries(pc.featureUsages)) {
                if (isLongRest) {
                    // Long rest resets everything
                    usage.current = usage.max;
                } else if (usage.usageType === 'SHORT_REST') {
                    // Short rest only resets SHORT_REST features
                    usage.current = usage.max;
                }
            }
        }

        // Arcane Recovery: Wizard feature, available once per short rest
        let arcaneRecoveryAvailable = false;
        let arcaneRecoveryBudget = 0;
        if (!isLongRest && pc.class === 'Wizard') {
            const arUsage = pc.featureUsages?.['Arcane Recovery'];
            if (arUsage && arUsage.current > 0) {
                // Check if any spell slots are missing
                const hasMissingSlots = Object.values(pc.spellSlots).some(s => s.current < s.max);
                if (hasMissingSlots) {
                    arcaneRecoveryAvailable = true;
                    arcaneRecoveryBudget = Math.ceil(pc.level / 2); // Up to half wizard level, rounded up
                }
            }
        }

        return {
            message: message.trim(),
            timeCost: durationMinutes,
            arcaneRecoveryAvailable,
            arcaneRecoveryBudget
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
     * Apply Arcane Recovery choices. Consumes the feature usage.
     * @param choices Map of spell level → number of slots to recover
     */
    public static applyArcaneRecovery(pc: PlayerCharacter, choices: Record<number, number>): string {
        const arUsage = pc.featureUsages?.['Arcane Recovery'];
        if (!arUsage || arUsage.current <= 0) return 'Arcane Recovery is not available.';

        const budget = Math.ceil(pc.level / 2);
        let totalLevels = 0;
        const recovered: string[] = [];

        for (const [lvStr, count] of Object.entries(choices)) {
            const lv = Number(lvStr);
            if (lv >= 6) continue; // Cannot recover 6th level or higher
            const slot = pc.spellSlots[lv.toString()];
            if (!slot) continue;
            const space = slot.max - slot.current;
            const actual = Math.min(count, space);
            if (actual <= 0) continue;
            if (totalLevels + lv * actual > budget) continue; // Would exceed budget
            slot.current += actual;
            totalLevels += lv * actual;
            recovered.push(`${actual}x L${lv}`);
        }

        if (recovered.length === 0) return 'No spell slots recovered.';

        arUsage.current--;
        return `Arcane Recovery: Restored ${recovered.join(', ')} (${totalLevels}/${budget} levels used).`;
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
