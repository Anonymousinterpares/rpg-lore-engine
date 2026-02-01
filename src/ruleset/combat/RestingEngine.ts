import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';

export class RestingEngine {
    /**
     * Executes a Short Rest (1 hour)
     * Allows spending hit dice to heal.
     * @param pc The character resting
     * @param diceToSpend Number of hit dice the player chooses to spend
     */
    public static shortRest(pc: PlayerCharacter, diceToSpend: number = 0): string {
        if (diceToSpend > pc.hitDice.current) {
            return `Not enough hit dice remaining (Current: ${pc.hitDice.current}).`;
        }

        let totalHealed = 0;
        const conMod = MechanicsEngine.getModifier(pc.stats['CON'] || 10);

        for (let i = 0; i < diceToSpend; i++) {
            const roll = Dice.roll(pc.hitDice.dieType);
            totalHealed += Math.max(0, roll + conMod);
            pc.hitDice.current--;
        }

        const oldHp = pc.hp.current;
        pc.hp.current = Math.min(pc.hp.max, pc.hp.current + totalHealed);
        const actualHealed = pc.hp.current - oldHp;

        let msg = `${pc.name} takes a Short Rest. Spent ${diceToSpend} Hit Dice. Healed ${actualHealed} HP.`;

        // Refreshes (Simplified: Warlock slots, etc. would go here)
        if (pc.class === 'Warlock') {
            Object.keys(pc.spellSlots).forEach(level => {
                pc.spellSlots[level].current = pc.spellSlots[level].max;
            });
            msg += ` Spell slots refreshed.`;
        }

        return msg;
    }

    /**
     * Executes a Long Rest (8 hours)
     * Full HP, regain half hit dice, regain all spell slots.
     */
    public static longRest(pc: PlayerCharacter): string {
        pc.hp.current = pc.hp.max;

        // Regain half hit dice (minimum 1)
        const regainAmount = Math.max(1, Math.floor(pc.hitDice.max / 2));
        pc.hitDice.current = Math.min(pc.hitDice.max, pc.hitDice.current + regainAmount);

        // Regain all spell slots
        Object.keys(pc.spellSlots).forEach(level => {
            pc.spellSlots[level].current = pc.spellSlots[level].max;
        });

        // Clear inspiration if applicable (depends on variant rules, but usually kept)

        return `${pc.name} takes a Long Rest. HP and Spell Slots fully restored. Regained ${regainAmount} Hit Dice (Current: ${pc.hitDice.current}/${pc.hitDice.max}).`;
    }
}
