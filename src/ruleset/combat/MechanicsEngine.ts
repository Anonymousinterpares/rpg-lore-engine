import { Dice } from './Dice';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Monster } from '../schemas/MonsterSchema';
import { AbilityScore, SkillName } from '../schemas/BaseSchemas';

export interface RollResult {
    roll: number;
    modifier: number;
    proficiencyBonus: number;
    total: number;
    success: boolean | null; // null if no DC was provided
    message: string;
}

export class MechanicsEngine {
    /**
     * Calculates ability modifier from a score: floor((score - 10) / 2)
     */
    public static getModifier(score: number): number {
        return Math.floor((score - 10) / 2);
    }

    /**
     * Calculates proficiency bonus based on level
     */
    public static getProficiencyBonus(level: number): number {
        if (level >= 17) return 6;
        if (level >= 13) return 5;
        if (level >= 9) return 4;
        if (level >= 5) return 3;
        return 2;
    }

    /**
     * Resolves a skill check or saving throw
     */
    public static resolveCheck(
        actor: PlayerCharacter | Monster,
        ability: AbilityScore,
        skill?: SkillName,
        dc?: number,
        advantage: 'none' | 'advantage' | 'disadvantage' = 'none'
    ): RollResult {
        const stats = (actor as any).stats;
        const score = stats[ability] || 10;
        const modifier = this.getModifier(score);

        // Proficiency logic
        let profBonus = 0;
        if ('level' in actor) {
            // Player
            const pc = actor as PlayerCharacter;
            const isProficient = (skill && pc.skillProficiencies.includes(skill)) ||
                (!skill && pc.savingThrowProficiencies.includes(ability));
            if (isProficient) {
                profBonus = this.getProficiencyBonus(pc.level);
            }
        } else {
            // Monster
            const m = actor as Monster;
            // Monsters have explicit skill/save bonuses in SRD, 
            // but for simplicity we'll check if the skill/save is listed in their record
            if (skill && m.skills && m.skills[skill] !== undefined) {
                // In our current MonsterSchema, skills/saves are the TOTAL bonus, 
                // but we might want to calculate it if missing.
                // For now, let's assume we use the stat and potentially add proficiency.
            }
        }

        let d20 = Dice.d20();
        if (advantage === 'advantage') {
            d20 = Math.max(d20, Dice.d20());
        } else if (advantage === 'disadvantage') {
            d20 = Math.min(d20, Dice.d20());
        }

        const total = d20 + modifier + profBonus;
        const success = dc !== undefined ? total >= dc : null;

        const typeLabel = skill ? `${skill} (${ability})` : `${ability} Save`;
        let msg = `${actor.name} rolled a ${typeLabel} check: ${d20} + ${modifier} (mod) + ${profBonus} (prof) = ${total}.`;
        if (success !== null) {
            msg += success ? ` SUCCESS (DC ${dc})` : ` FAILURE (DC ${dc})`;
        }

        return {
            roll: d20,
            modifier,
            proficiencyBonus: profBonus,
            total,
            success,
            message: msg
        };
    }

    /**
     * Resolves an environmental hazard against an actor.
     */
    public static resolveHazard(actor: PlayerCharacter | Monster, hazard: any): string {
        let msg = `${actor.name} encounters ${hazard.name} (${hazard.type}). `;

        if (hazard.saveDC && hazard.saveAbility) {
            const result = this.resolveCheck(actor, hazard.saveAbility, undefined, hazard.saveDC);
            msg += result.message;
            if (result.success) {
                msg += " Damage avoided or halved.";
                // Logic for half damage or avoiding would go here
                return msg;
            }
        }

        if (hazard.damage) {
            msg += ` Taking ${hazard.damage} ${hazard.damageType || ''} damage.`;
        }

        return msg;
    }
}
