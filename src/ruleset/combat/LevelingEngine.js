import { MechanicsEngine } from './MechanicsEngine';
export class LevelingEngine {
    static XP_THRESHOLDS = {
        1: 0,
        2: 300,
        3: 900,
        4: 2700,
        5: 6500,
        6: 14000,
        7: 23000,
        8: 34000,
        9: 48000,
        10: 64000,
        11: 85000,
        12: 100000,
        13: 120000,
        14: 140000,
        15: 165000,
        16: 195000,
        17: 225000,
        18: 265000,
        19: 305000,
        20: 355000
    };
    /**
     * Checks if a character has enough XP to level up.
     */
    static canLevelUp(pc) {
        if (pc.level >= 20)
            return false;
        const nextThreshold = this.XP_THRESHOLDS[pc.level + 1];
        return pc.xp >= nextThreshold;
    }
    /**
     * Applies level up changes to a character.
     * Note: This is an engine-level apply. UI/Wizard would handle choices.
     */
    static levelUp(pc) {
        if (!this.canLevelUp(pc))
            return `${pc.name} does not have enough XP to level up.`;
        pc.level++;
        // HP Increase (Average of hit die + CON mod)
        const hitDieValue = parseInt(pc.hitDice.dieType.replace('1d', ''));
        const conMod = MechanicsEngine.getModifier(pc.stats['CON'] || 10);
        const hpIncrease = (Math.floor(hitDieValue / 2) + 1 + conMod) || 1;
        pc.hp.max += hpIncrease;
        pc.hp.current = pc.hp.max; // Heal on level up
        // Increase Hit Dice
        pc.hitDice.max++;
        pc.hitDice.current = pc.hitDice.max; // Restore hit dice
        // Proficiency Bonus implicitly increases (MechanicsEngine uses level)
        return `${pc.name} reached Level ${pc.level}! Max HP increased to ${pc.hp.max}.`;
    }
    /**
     * Adds XP to a character and returns true if they reached a new level.
     */
    static addXP(pc, xp) {
        pc.xp += xp;
        return { totalXP: pc.xp, leveledUp: this.canLevelUp(pc) };
    }
}
