import { Dice } from './Dice';
export class MechanicsEngine {
    /**
     * Calculates ability modifier from a score: floor((score - 10) / 2)
     */
    static getModifier(score) {
        return Math.floor((score - 10) / 2);
    }
    /**
     * Calculates proficiency bonus based on level
     */
    static getProficiencyBonus(level) {
        if (level >= 17)
            return 6;
        if (level >= 13)
            return 5;
        if (level >= 9)
            return 4;
        if (level >= 5)
            return 3;
        return 2;
    }
    /**
     * Resolves a skill check or saving throw
     */
    static resolveCheck(actor, ability, skill, dc, advantage = 'none') {
        const stats = actor.stats;
        const score = stats[ability] || 10;
        const modifier = this.getModifier(score);
        // Proficiency logic
        let profBonus = 0;
        if ('level' in actor) {
            // Player
            const pc = actor;
            const isProficient = (skill && pc.skillProficiencies.includes(skill)) ||
                (!skill && pc.savingThrowProficiencies.includes(ability));
            if (isProficient) {
                profBonus = this.getProficiencyBonus(pc.level);
            }
        }
        else {
            // Monster
            const m = actor;
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
        }
        else if (advantage === 'disadvantage') {
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
    static resolveHazard(actor, hazard) {
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
    /**
     * Calculates passive perception: 10 + WIS mod + Proficiency
     */
    static getPassivePerception(actor) {
        const stats = actor.stats;
        const wisMod = this.getModifier(stats['WIS'] || 10);
        let profBonus = 0;
        if ('level' in actor) {
            const pc = actor;
            if (pc.skillProficiencies.includes('Perception')) {
                profBonus = this.getProficiencyBonus(pc.level);
            }
        }
        else {
            // Monsters often have explicit passive perception, 
            // but we'll calculate if it's a generic poll
        }
        return 10 + wisMod + profBonus;
    }
    /**
     * Resolves group stealth: if half or more succeed, the group succeeds.
     */
    static resolveGroupStealth(actors, dc) {
        const results = actors.map(a => this.resolveCheck(a, 'DEX', 'Stealth', dc));
        const successes = results.filter(r => r.success).length;
        const groupSuccess = successes >= actors.length / 2;
        return {
            success: groupSuccess,
            messages: results.map(r => r.message)
        };
    }
}
