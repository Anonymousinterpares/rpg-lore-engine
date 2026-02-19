import { Dice } from './Dice';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Monster } from '../schemas/MonsterSchema';
import { Item } from '../schemas/ItemSchema';
import { Combatant } from '../schemas/CombatSchema';
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
     * Calculates proficiency bonus based on CR
     */
    public static getMonsterProficiency(cr: number): number {
        if (cr >= 29) return 9;
        if (cr >= 25) return 8;
        if (cr >= 21) return 7;
        if (cr >= 17) return 6;
        if (cr >= 13) return 5;
        if (cr >= 9) return 4;
        if (cr >= 5) return 3;
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
    public static resolveHazard(actor: any, hazard: any): { message: string, damage: number, success: boolean } {
        let msg = `${actor.name} encounters ${hazard.description || 'a hazardous area'}. `;
        let damage = 0;
        let success = true;

        if (hazard.saveDC && hazard.saveAbility) {
            const result = this.resolveCheck(actor, hazard.saveAbility, undefined, hazard.saveDC);
            msg += result.message;
            success = result.success || false;

            if (success) {
                msg += " Damage halved! ";
            }
        }

        if (hazard.damageDice) {
            const roll = Dice.roll(hazard.damageDice);
            damage = success ? Math.floor(roll / 2) : roll;
            msg += ` Taking ${damage} ${hazard.damageType || ''} damage.`;
        }

        return { message: msg, damage, success };
    }

    /**
     * Calculates passive perception: 10 + WIS mod + Proficiency
     */
    public static getPassivePerception(actor: PlayerCharacter | Monster): number {
        const stats = (actor as any).stats;
        const wisMod = this.getModifier(stats['WIS'] || 10);
        let profBonus = 0;

        if ('level' in actor) {
            const pc = actor as PlayerCharacter;
            if (pc.skillProficiencies.includes('Perception')) {
                profBonus = this.getProficiencyBonus(pc.level);
            }
        } else {
            // Monsters often have explicit passive perception, 
            // but we'll calculate if it's a generic poll
        }

        return 10 + wisMod + profBonus;
    }

    /**
     * Resolves group stealth: if half or more succeed, the group succeeds.
     */
    public static resolveGroupStealth(actors: (PlayerCharacter | Monster)[], dc: number): { success: boolean; messages: string[] } {
        const results = actors.map(a => this.resolveCheck(a, 'DEX', 'Stealth', dc));
        const successes = results.filter(r => r.success).length;
        const groupSuccess = successes >= actors.length / 2;

        return {
            success: groupSuccess,
            messages: results.map(r => r.message)
        };
    }

    /**
     * Returns the XP required to reach the given level.
     */
    public static getXPThreshold(level: number): number {
        const thresholds: Record<number, number> = {
            1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
            6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
            11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
            16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
        };
        return thresholds[level] ?? thresholds[20];
    }

    /**
     * Returns the XP threshold for the NEXT level.
     */
    public static getNextLevelXP(currentLevel: number): number {
        return this.getXPThreshold(currentLevel + 1);
    }

    /**
     * Converts CR to XP value (D&D 5e).
     */
    public static getCRtoXP(crInput: number | string): number {
        let cr = 0;
        if (typeof crInput === 'string') {
            if (crInput === '1/8') cr = 0.125;
            else if (crInput === '1/4') cr = 0.25;
            else if (crInput === '1/2') cr = 0.5;
            else cr = parseFloat(crInput);
        } else {
            cr = crInput;
        }

        if (cr === 0) return 10;
        if (cr === 0.125) return 25;
        if (cr === 0.25) return 50;
        if (cr === 0.5) return 100;
        if (cr === 1) return 200;
        if (cr === 2) return 450;
        if (cr === 3) return 700;
        if (cr === 4) return 1100;
        if (cr === 5) return 1800;
        if (cr === 6) return 2300;
        if (cr === 7) return 2900;
        if (cr === 8) return 3900;
        if (cr === 9) return 5000;
        if (cr === 10) return 5900;
        // higher CRs can be added as needed or calculated roughly
        return Math.floor(cr * 600); // Very rough approximation for CR > 10
    }

    /**
     * Calculates the effective stat of a character after all modifiers.
     */
    public static getEffectiveStat(actor: PlayerCharacter | Monster | Combatant, stat: AbilityScore): number {
        const base = (actor as any).stats[stat] || 10;
        let bonus = 0;

        // 1. From Equipment (if PC)
        if ('equipmentSlots' in actor) {
            const pc = actor as PlayerCharacter;
            // Scan all items for StatBonus modifiers
            pc.inventory.items.forEach(item => {
                if (item.equipped && (item as any).modifiers) {
                    (item as any).modifiers.forEach((mod: any) => {
                        if (mod.type === 'StatBonus' && mod.target === stat) {
                            bonus += mod.value;
                        }
                    });
                }
            });
        }

        // 2. From Status Effects
        const statusEffects = (actor as any).statusEffects;
        if (statusEffects && Array.isArray(statusEffects)) {
            statusEffects.forEach((effect: any) => {
                if (effect.type === 'BUFF' && (effect as any).stat === stat) {
                    bonus += (effect as any).value || (effect as any).modifier || 0;
                }
            });
        }

        return base + bonus;
    }

    /**
     * Calculates proportional range penalty for a ranged attack.
     */
    public static calculateRangePenalty(
        attacker: PlayerCharacter | Monster | Combatant,
        distance: number,
        weapon: Item | { range?: { normal: number, long: number }, properties?: string[] } | null | undefined,
        ammoModifier: number = 0
    ): { penalty: number; log: string } {
        const weaponAny = weapon as any;
        if (!weapon || !weaponAny.range || (weaponAny.type !== 'Weapon' && !weaponAny.range)) return { penalty: 0, log: "" };

        const normalRangeCells = Math.floor(weaponAny.range.normal / 5);
        if (distance <= normalRangeCells) return { penalty: 0, log: "" };

        // Proportional Penalty Logic
        // For each full range increment beyond the first, apply -2
        // distance 1-30 (normal) -> 0
        // distance 31-60 -> -2
        // distance 61-90 -> -4
        const increments = Math.floor((distance - 1) / normalRangeCells);

        // Base penalty
        let penaltyPerIncrement = -2;

        // Item/Ammo Reductions
        let reduction = ammoModifier;
        if ((weapon as any).modifiers) {
            (weapon as any).modifiers.forEach((mod: any) => {
                if (mod.type === 'RangePenaltyReduction') {
                    reduction += mod.value;
                }
            });
        }

        const effectivePenaltyPerInc = Math.min(0, penaltyPerIncrement + reduction);
        const basePenalty = increments * effectivePenaltyPerInc;

        // Mitigation (Stats)
        const dexMod = this.getModifier(this.getEffectiveStat(attacker, 'DEX'));
        const wisMod = this.getModifier(this.getEffectiveStat(attacker, 'WIS'));
        const statMitigation = Math.max(dexMod, wisMod);

        // Mitigation (Skills - Perception)
        let skillMitigation = 0;
        if ('skillProficiencies' in attacker) {
            const pc = attacker as PlayerCharacter;
            if (pc.skillProficiencies.includes('Perception')) {
                skillMitigation = this.getProficiencyBonus(pc.level);
            }
        }

        const totalPenalty = Math.min(0, basePenalty + statMitigation + skillMitigation);

        let log = `Range: ${distance * 5}ft (Inc: ${increments}). Penalty: ${basePenalty}. Mitigation: +${statMitigation + skillMitigation}. Total: ${totalPenalty}`;

        return {
            penalty: totalPenalty,
            log
        };
    }
}
