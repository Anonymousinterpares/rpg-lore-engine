import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { MechanicsEngine } from './MechanicsEngine';
import { SkillEngine } from './SkillEngine';
import { DataManager } from '../data/DataManager';

/** Levels at which ASI (Ability Score Improvement) is granted. */
const ASI_LEVELS = [4, 8, 12, 16, 19];

export class LevelingEngine {
    private static readonly XP_THRESHOLDS: Record<number, number> = {
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
    public static canLevelUp(pc: PlayerCharacter): boolean {
        if (pc.level >= 20) return false;
        const nextThreshold = this.XP_THRESHOLDS[pc.level + 1];
        return pc.xp >= nextThreshold;
    }

    /**
     * Applies level up changes to a character.
     * For multiclass characters, chosenClass determines which class gains the level.
     * Returns a summary of what changed. SP and ASI choices are deferred to player.
     */
    public static levelUp(pc: PlayerCharacter, chosenClass?: string): string {
        if (!this.canLevelUp(pc)) return `${pc.name} does not have enough XP to level up.`;

        const isMulticlass = !!(pc as any).secondaryClass;

        // Determine which class is leveling
        let levelingClass = pc.class;
        if (isMulticlass) {
            if (!chosenClass) {
                return `Multiclass character: specify class. Usage: /levelup ${pc.class} or /levelup ${(pc as any).secondaryClass}`;
            }
            const normalized = chosenClass.charAt(0).toUpperCase() + chosenClass.slice(1).toLowerCase();
            if (normalized !== pc.class && normalized !== (pc as any).secondaryClass) {
                return `${normalized} is not one of your classes (${pc.class} / ${(pc as any).secondaryClass}).`;
            }
            levelingClass = normalized;
        }

        pc.level++;

        // Track multiclass levels
        if (isMulticlass) {
            if (!pc.multiclassLevels) pc.multiclassLevels = {};
            pc.multiclassLevels[levelingClass] = (pc.multiclassLevels[levelingClass] || 0) + 1;
        }

        // HP Increase (uses the leveling class's hit die)
        const classData = DataManager.getClass(levelingClass);
        const hitDie = (classData as any)?.hitDie || pc.hitDice.dieType;
        const hitDieValue = parseInt(hitDie.replace('1d', ''));
        const conMod = MechanicsEngine.getModifier(pc.stats['CON'] || 10);
        const hpIncrease = Math.max(1, Math.floor(hitDieValue / 2) + 1 + conMod);

        pc.hp.max += hpIncrease;
        pc.hp.current = pc.hp.max;

        // Increase Hit Dice
        pc.hitDice.max++;
        pc.hitDice.current = pc.hitDice.max;

        // Grant Skill Points from the leveling class's config
        const spGrant = (classData as any)?.skillPointsPerLevel || 2;
        SkillEngine.grantSkillPoints(pc, spGrant);

        const classLabel = isMulticlass ? ` (${levelingClass})` : '';
        let summary = `${pc.name} reached Level ${pc.level}${classLabel}! HP +${hpIncrease} (max ${pc.hp.max}). Gained ${spGrant} SP.`;

        if (isMulticlass && pc.multiclassLevels) {
            const levels = Object.entries(pc.multiclassLevels).map(([c, l]) => `${c} ${l}`).join(' / ');
            summary += ` [${levels}]`;
        }

        // ASI at milestone character levels
        if (ASI_LEVELS.includes(pc.level)) {
            (pc as any)._pendingASI = ((pc as any)._pendingASI || 0) + 1;
            summary += ` ASI available!`;
        }

        return summary;
    }

    /**
     * Check if the character has a pending ASI to allocate.
     */
    public static hasPendingASI(pc: PlayerCharacter): boolean {
        return ((pc as any)._pendingASI || 0) > 0;
    }

    /**
     * Apply ASI: +2 to one ability score (capped at 20).
     */
    public static applyASISingle(pc: PlayerCharacter, ability: string): string {
        if (!this.hasPendingASI(pc)) return 'No pending ASI.';
        const stats = pc.stats as Record<string, number>;
        const current = stats[ability] || 10;
        if (current >= 20) return `${ability} is already at maximum (20).`;

        const increase = Math.min(2, 20 - current);
        stats[ability] = current + increase;
        (pc as any)._pendingASI--;

        if (ability === 'CON') {
            const hpBonus = (MechanicsEngine.getModifier(stats[ability]) - MechanicsEngine.getModifier(current)) * pc.level;
            pc.hp.max += hpBonus;
            pc.hp.current = Math.min(pc.hp.current + hpBonus, pc.hp.max);
        }

        return `${ability} increased by ${increase} (now ${stats[ability]}).`;
    }

    /**
     * Apply ASI: +1 to two different ability scores (each capped at 20).
     */
    public static applyASISplit(pc: PlayerCharacter, ability1: string, ability2: string): string {
        if (!this.hasPendingASI(pc)) return 'No pending ASI.';
        if (ability1 === ability2) return 'Must choose two different abilities.';

        const stats = pc.stats as Record<string, number>;
        const results: string[] = [];
        for (const ability of [ability1, ability2]) {
            const current = stats[ability] || 10;
            if (current >= 20) {
                results.push(`${ability} already at 20 — skipped.`);
                continue;
            }
            stats[ability] = current + 1;
            results.push(`${ability} +1 (now ${stats[ability]})`);

            if (ability === 'CON') {
                const hpBonus = (MechanicsEngine.getModifier(stats[ability]) - MechanicsEngine.getModifier(current)) * pc.level;
                pc.hp.max += hpBonus;
                pc.hp.current = Math.min(pc.hp.current + hpBonus, pc.hp.max);
            }
        }

        (pc as any)._pendingASI--;
        return `ASI applied: ${results.join(', ')}.`;
    }

    /**
     * Adds XP to a character and returns true if they reached a new level.
     */
    public static addXP(pc: PlayerCharacter, xp: number): { totalXP: number, leveledUp: boolean } {
        pc.xp += xp;
        return { totalXP: pc.xp, leveledUp: this.canLevelUp(pc) };
    }
}
