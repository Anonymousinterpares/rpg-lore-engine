import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { DataManager } from '../data/DataManager';
import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';

// ─── Input ───

export interface AttackContext {
    isRanged: boolean;
    isFinesseWeapon: boolean;
    isTwoHanded: boolean;
    hasOffhand: boolean;
    weaponType: 'melee' | 'ranged';
    hasAllyNearTarget: boolean;
    hasAdvantage: boolean;
    wearingArmor: boolean;
    targetHasNotActed?: boolean;   // For Assassinate
    targetIsSurprised?: boolean;   // For Assassinate
    gwmEnabled?: boolean;          // GWM -5/+10 toggle
    sharpshooterEnabled?: boolean; // Sharpshooter -5/+10 toggle
}

// ─── Output ───

export interface AttackModifiers {
    attackBonus: number;
    damageBonus: number;
    acBonus: number;
    critRange: number;
    extraAttacks: number;
    sneakAttackDice: number;
    sneakEligible: boolean;
    rerollDamageBelow: number;
    bonusDamageOnHit: BonusDamage[];
    forceAdvantage: boolean;       // Reckless Attack, Assassinate
    forceDisadvantage: boolean;    // Imposed on self (Reckless enemies)
    forceCrit: boolean;            // Assassinate on surprised target
    ignoreCover: boolean;          // Sharpshooter
}

export interface BonusDamage {
    dice: string;
    type: string;
    source: string;
    optional: boolean;
    slotLevel?: number;
}

export interface ActivatedFeatureResult {
    success: boolean;
    message: string;
    healAmount?: number;
    statusEffect?: { id: string; name: string; type: 'BUFF' | 'DEBUFF'; duration?: number; stat?: string; modifier?: number };
    grantExtraAction?: boolean;    // Action Surge
}

/** Defensive modifiers for when this PC is TARGETED by an attack. */
export interface DefenseModifiers {
    acBonus: number;               // Defense style, Unarmored Defense
    evasion: boolean;              // DEX save half=0, fail=half
    dangerSense: boolean;          // Advantage on DEX saves
    uncannyDodge: boolean;         // Reaction: halve attack damage
    rageResistance: boolean;       // Half bludgeoning/piercing/slashing
    saveProficiencies: string[];   // From Resilient feat
}

// ─── Fighting Style Data ───

interface FightingStyleData {
    id: string;
    name: string;
    description: string;
    effects: {
        attackBonus?: number;
        damageBonus?: number;
        acBonus?: number;
        rerollDamageBelow?: number;
        twoWeaponDamageModifier?: boolean;
        reactive?: boolean;
        condition?: Record<string, any>;
    };
}

// ─── Extra Attack Lookup ───

const EXTRA_ATTACK_TABLE: Record<string, (level: number, subclass?: string) => number> = {
    Fighter: (lv) => lv >= 20 ? 3 : lv >= 11 ? 2 : lv >= 5 ? 1 : 0,
    Ranger: (lv) => lv >= 5 ? 1 : 0,
    Paladin: (lv) => lv >= 5 ? 1 : 0,
    Monk: (lv) => lv >= 5 ? 1 : 0,
    Bard: (lv, sc) => (sc === 'College of Valor' || sc === 'College of Swords') && lv >= 6 ? 1 : 0,
};

function rageDamageBonus(level: number): number {
    if (level >= 16) return 4;
    if (level >= 9) return 3;
    return 2;
}

// ─── Engine ───

export class FeatureEffectEngine {
    private static fightingStyles: FightingStyleData[] = [];

    public static loadFightingStyles(data: FightingStyleData[]): void {
        this.fightingStyles = data;
    }

    public static getFightingStyles(): FightingStyleData[] {
        return this.fightingStyles;
    }

    public static getFightingStyle(name: string): FightingStyleData | undefined {
        return this.fightingStyles.find(s => s.name === name);
    }

    // ════════════════════════════════════════════
    //  ATTACK MODIFIERS (passive, before attack)
    // ════════════════════════════════════════════

    public static getAttackModifiers(pc: PlayerCharacter, context: AttackContext): AttackModifiers {
        const result: AttackModifiers = {
            attackBonus: 0,
            damageBonus: 0,
            acBonus: 0,
            critRange: 20,
            extraAttacks: 0,
            sneakAttackDice: 0,
            sneakEligible: false,
            rerollDamageBelow: 0,
            bonusDamageOnHit: [],
            forceAdvantage: false,
            forceDisadvantage: false,
            forceCrit: false,
            ignoreCover: false,
        };

        // 1. Crit range (Improved/Superior Critical)
        result.critRange = this.computeCritRange(pc);

        // 2. Extra attacks
        result.extraAttacks = this.computeExtraAttacks(pc);

        // 3. Sneak Attack
        const sneak = this.computeSneakAttack(pc, context);
        result.sneakAttackDice = sneak.dice;
        result.sneakEligible = sneak.eligible;

        // 4. Fighting style
        const style = this.computeFightingStyleBonuses(pc, context);
        result.attackBonus += style.attackBonus ?? 0;
        result.damageBonus += style.damageBonus ?? 0;
        result.acBonus += style.acBonus ?? 0;
        result.rerollDamageBelow = style.rerollDamageBelow ?? 0;

        // 5. Rage bonuses (if active, melee only)
        if (this.isRaging(pc) && !context.isRanged) {
            result.damageBonus += rageDamageBonus(pc.level);
        }

        // 6. Reckless Attack (Barbarian status effect)
        if (this.hasActiveEffect(pc, 'reckless_attack') && !context.isRanged) {
            result.forceAdvantage = true;
            // Note: enemies also get advantage on the Barbarian — tracked via status effect on combatant
        }

        // 7. Assassinate (Assassin Rogue L3+)
        if (pc.class === 'Rogue' && pc.subclass === 'Assassin' && pc.level >= 3) {
            if (context.targetHasNotActed) {
                result.forceAdvantage = true;
            }
            if (context.targetIsSurprised) {
                result.forceCrit = true;
            }
        }

        // 8. Great Weapon Master feat (-5/+10)
        if (context.gwmEnabled && pc.feats?.includes('Great Weapon Master') && !context.isRanged && context.isTwoHanded) {
            result.attackBonus -= 5;
            result.damageBonus += 10;
        }

        // 9. Sharpshooter feat (-5/+10 + ignore cover)
        if (context.sharpshooterEnabled && pc.feats?.includes('Sharpshooter') && context.isRanged) {
            result.attackBonus -= 5;
            result.damageBonus += 10;
            result.ignoreCover = true;
        }

        return result;
    }

    // ════════════════════════════════════════════
    //  DEFENSE MODIFIERS (when PC is targeted)
    // ════════════════════════════════════════════

    public static getDefenseModifiers(pc: PlayerCharacter): DefenseModifiers {
        const result: DefenseModifiers = {
            acBonus: 0,
            evasion: false,
            dangerSense: false,
            uncannyDodge: false,
            rageResistance: false,
            saveProficiencies: [...(pc.savingThrowProficiencies || [])],
        };

        // Defense Fighting Style (handled in EquipmentEngine for AC, but expose here too)
        if (pc.fightingStyle === 'Defense' && (pc.equipmentSlots as any)?.armor) {
            result.acBonus += 1;
        }

        // Unarmored Defense (Barbarian: 10+DEX+CON, Monk: 10+DEX+WIS)
        // This is handled in AC calculation, but we track it as a flag
        // Note: actual AC is in EquipmentEngine — this is for informational queries

        // Evasion (Rogue 7+, Monk 7+)
        if ((pc.class === 'Rogue' || pc.class === 'Monk') && pc.level >= 7) {
            result.evasion = true;
        }

        // Danger Sense (Barbarian 2+): advantage on DEX saves you can see
        if (pc.class === 'Barbarian' && pc.level >= 2) {
            result.dangerSense = true;
        }

        // Uncanny Dodge (Rogue 5+): reaction to halve one attack's damage
        if (pc.class === 'Rogue' && pc.level >= 5) {
            result.uncannyDodge = true;
        }

        // Rage resistance
        if (this.isRaging(pc)) {
            result.rageResistance = true;
        }

        // Resilient feat: add save proficiency
        if (pc.feats?.includes('Resilient')) {
            // Resilient grants proficiency in one saving throw (stored as the feat's chosen ability)
            // For now, check if any ability was specified in feat effects
            // The ability is tracked via ability_increase effect in feat data
            // Since we don't have a separate "resilient_ability" field, we check savingThrowProficiencies
            // which was updated when the feat was selected
        }

        return result;
    }

    // ════════════════════════════════════════════
    //  UNARMORED DEFENSE AC
    // ════════════════════════════════════════════

    /** Calculate Unarmored Defense AC. Returns undefined if not applicable. */
    public static getUnarmoredDefenseAC(pc: PlayerCharacter): number | undefined {
        const stats = pc.stats as Record<string, number>;
        const dexMod = MechanicsEngine.getModifier(stats.DEX || 10);

        if (pc.class === 'Barbarian') {
            const conMod = MechanicsEngine.getModifier(stats.CON || 10);
            return 10 + dexMod + conMod;
        }
        if (pc.class === 'Monk') {
            const wisMod = MechanicsEngine.getModifier(stats.WIS || 10);
            return 10 + dexMod + wisMod;
        }
        return undefined;
    }

    // ════════════════════════════════════════════
    //  REMARKABLE ATHLETE (Champion Fighter 7+)
    // ════════════════════════════════════════════

    /** Returns half proficiency bonus for unproficient STR/DEX/CON checks. 0 if not applicable. */
    public static getRemarkableAthleteBonus(pc: PlayerCharacter, ability: string): number {
        if (pc.class !== 'Fighter' || pc.subclass !== 'Champion' || pc.level < 7) return 0;
        if (!['STR', 'DEX', 'CON'].includes(ability)) return 0;
        return Math.ceil(MechanicsEngine.getProficiencyBonus(pc.level) / 2);
    }

    // ════════════════════════════════════════════
    //  MOVEMENT SPEED MODIFIERS
    // ════════════════════════════════════════════

    /** Get bonus movement speed from feats/features. */
    public static getMovementSpeedBonus(pc: PlayerCharacter): number {
        let bonus = 0;
        // Mobile feat: +10 speed
        if (pc.feats?.includes('Mobile')) bonus += 10;
        // Barbarian fast movement (level 5+, not in heavy armor)
        if (pc.class === 'Barbarian' && pc.level >= 5) bonus += 10;
        // Monk unarmored movement (level 2+)
        if (pc.class === 'Monk' && pc.level >= 2) {
            const monkBonus = pc.level >= 18 ? 30 : pc.level >= 14 ? 25 : pc.level >= 10 ? 20 : pc.level >= 6 ? 15 : 10;
            bonus += monkBonus;
        }
        return bonus;
    }

    // ── Sub-computations (private) ──

    private static computeCritRange(pc: PlayerCharacter): number {
        if (!pc.subclass) return 20;
        const classData = DataManager.getClass(pc.class);
        if (!classData?.subclasses) return 20;

        const subclass = classData.subclasses.find(sc => sc.name === pc.subclass);
        if (!subclass?.features) return 20;

        if (subclass.features.some(f => f.name === 'Superior Critical' && f.level <= pc.level)) return 18;
        if (subclass.features.some(f => f.name === 'Improved Critical' && f.level <= pc.level)) return 19;

        return 20;
    }

    private static computeExtraAttacks(pc: PlayerCharacter): number {
        const fn = EXTRA_ATTACK_TABLE[pc.class];
        return fn ? fn(pc.level, pc.subclass) : 0;
    }

    private static computeSneakAttack(pc: PlayerCharacter, context: AttackContext): { dice: number; eligible: boolean } {
        if (pc.class !== 'Rogue') return { dice: 0, eligible: false };
        const dice = Math.ceil(pc.level / 2);
        const hasAdvOrAlly = context.hasAdvantage || context.hasAllyNearTarget;
        const assassinateAdv = pc.subclass === 'Assassin' && pc.level >= 3 && !!context.targetHasNotActed;
        const eligible = (context.isFinesseWeapon || context.isRanged) &&
            (hasAdvOrAlly || assassinateAdv);
        return { dice, eligible };
    }

    private static computeFightingStyleBonuses(pc: PlayerCharacter, context: AttackContext): Partial<AttackModifiers> {
        if (!pc.fightingStyle) return {};
        const style = this.getFightingStyle(pc.fightingStyle);
        if (!style) return {};

        if (style.effects.condition && !this.matchesCondition(style.effects.condition, context)) {
            return {};
        }

        return {
            attackBonus: style.effects.attackBonus ?? 0,
            damageBonus: style.effects.damageBonus ?? 0,
            acBonus: style.effects.acBonus ?? 0,
            rerollDamageBelow: style.effects.rerollDamageBelow ?? 0,
        };
    }

    private static matchesCondition(condition: Record<string, any>, context: AttackContext): boolean {
        for (const [key, value] of Object.entries(condition)) {
            if ((context as any)[key] !== value) return false;
        }
        return true;
    }

    // ════════════════════════════════════════════
    //  ACTIVATED FEATURES
    // ════════════════════════════════════════════

    public static resolveActivatedFeature(
        pc: PlayerCharacter,
        featureName: string,
        options?: { spellSlotLevel?: number; healAmount?: number }
    ): ActivatedFeatureResult {
        switch (featureName) {
            case 'Second Wind': return this.resolveSecondWind(pc);
            case 'Rage': return this.resolveRage(pc);
            case 'Reckless Attack': return this.resolveRecklessAttack(pc);
            case 'Divine Smite': return this.resolveDivineSmite(pc, options?.spellSlotLevel ?? 1);
            case 'Lay on Hands': return this.resolveLayOnHands(pc, options?.healAmount ?? 0);
            case 'Action Surge': return this.resolveActionSurge(pc);
            case 'Cunning Action': return this.resolveCunningAction(pc);
            default: return { success: false, message: `No automated effect for "${featureName}".` };
        }
    }

    private static resolveSecondWind(pc: PlayerCharacter): ActivatedFeatureResult {
        const usage = pc.featureUsages?.['Second Wind'];
        if (!usage || usage.current <= 0) return { success: false, message: 'Second Wind not available.' };
        const heal = Dice.roll('1d10') + pc.level;
        usage.current--;
        return { success: true, message: `Second Wind! Healed ${heal} HP.`, healAmount: heal };
    }

    private static resolveRage(pc: PlayerCharacter): ActivatedFeatureResult {
        if (this.isRaging(pc)) return { success: false, message: 'Already raging!' };
        const usage = pc.featureUsages?.['Rage'];
        if (!usage || usage.current <= 0) return { success: false, message: 'No rages remaining.' };
        usage.current--;
        const dmgBonus = rageDamageBonus(pc.level);
        return {
            success: true,
            message: `RAGE! +${dmgBonus} melee damage, resistance to physical damage for 10 rounds.`,
            statusEffect: { id: 'rage', name: 'Rage', type: 'BUFF', duration: 10 },
        };
    }

    private static resolveRecklessAttack(pc: PlayerCharacter): ActivatedFeatureResult {
        if (pc.class !== 'Barbarian' || pc.level < 2) {
            return { success: false, message: 'Reckless Attack requires Barbarian level 2+.' };
        }
        // No resource cost — always available. Applies for this turn.
        return {
            success: true,
            message: 'Reckless Attack! Advantage on melee attacks this turn, but enemies have advantage on you.',
            statusEffect: { id: 'reckless_attack', name: 'Reckless', type: 'BUFF', duration: 1 },
        };
    }

    private static resolveActionSurge(pc: PlayerCharacter): ActivatedFeatureResult {
        const usage = pc.featureUsages?.['Action Surge'];
        if (!usage || usage.current <= 0) return { success: false, message: 'Action Surge not available.' };
        usage.current--;
        return {
            success: true,
            message: 'Action Surge! You gain an additional action this turn.',
            grantExtraAction: true,
        };
    }

    private static resolveCunningAction(pc: PlayerCharacter): ActivatedFeatureResult {
        if (pc.class !== 'Rogue' || pc.level < 2) {
            return { success: false, message: 'Cunning Action requires Rogue level 2+.' };
        }
        // Cunning Action is passive — always available as bonus action
        // This just confirms availability; actual Dash/Disengage/Hide is handled by the action system
        return {
            success: true,
            message: 'Cunning Action: You can Dash, Disengage, or Hide as a bonus action.',
        };
    }

    private static resolveDivineSmite(pc: PlayerCharacter, slotLevel: number): ActivatedFeatureResult {
        if (pc.class !== 'Paladin') {
            return { success: false, message: 'Only Paladins can use Divine Smite.' };
        }
        const slot = pc.spellSlots?.[slotLevel.toString()];
        if (!slot || slot.current <= 0) {
            return { success: false, message: `No level ${slotLevel} spell slots remaining.` };
        }
        const diceCount = Math.min(5, 2 + (slotLevel - 1));
        let totalDmg = 0;
        for (let i = 0; i < diceCount; i++) totalDmg += Dice.roll('1d8');
        slot.current--;
        return {
            success: true,
            message: `Divine Smite! ${diceCount}d8 = ${totalDmg} radiant damage (Level ${slotLevel} slot consumed).`,
            healAmount: -totalDmg,
        };
    }

    private static resolveLayOnHands(pc: PlayerCharacter, healAmount: number): ActivatedFeatureResult {
        const pool = this.getLayOnHandsPool(pc);
        if (pool <= 0) return { success: false, message: 'Lay on Hands pool is empty.' };
        const actual = Math.min(healAmount, pool);
        if (actual <= 0) return { success: false, message: 'Specify an amount to heal.' };
        if (!pc.featureUsages) (pc as any).featureUsages = {};
        if (!pc.featureUsages['Lay on Hands']) {
            pc.featureUsages['Lay on Hands'] = { current: pc.level * 5, max: pc.level * 5, usageType: 'LONG_REST' };
        }
        pc.featureUsages['Lay on Hands'].current -= actual;
        return { success: true, message: `Lay on Hands: healed ${actual} HP.`, healAmount: actual };
    }

    // ════════════════════════════════════════════
    //  STATE QUERIES
    // ════════════════════════════════════════════

    public static isRaging(pc: PlayerCharacter): boolean {
        return (pc as any).statusEffects?.some((e: any) => e.id === 'rage') ?? false;
    }

    public static hasActiveEffect(pc: PlayerCharacter, effectId: string): boolean {
        return (pc as any).statusEffects?.some((e: any) => e.id === effectId) ?? false;
    }

    public static getLayOnHandsPool(pc: PlayerCharacter): number {
        const usage = pc.featureUsages?.['Lay on Hands'];
        if (usage) return usage.current;
        return pc.level * 5;
    }

    public static getRageDamageBonus(level: number): number {
        return rageDamageBonus(level);
    }

    /** Check if a character has a specific feat. */
    public static hasFeat(pc: PlayerCharacter, featName: string): boolean {
        return pc.feats?.includes(featName) ?? false;
    }

    /** Check if character has Evasion (Rogue 7+, Monk 7+). */
    public static hasEvasion(pc: PlayerCharacter): boolean {
        return (pc.class === 'Rogue' || pc.class === 'Monk') && pc.level >= 7;
    }

    /** Check if character has Danger Sense (Barbarian 2+). */
    public static hasDangerSense(pc: PlayerCharacter): boolean {
        return pc.class === 'Barbarian' && pc.level >= 2;
    }

    /** Check if character has Uncanny Dodge (Rogue 5+). */
    public static hasUncannyDodge(pc: PlayerCharacter): boolean {
        return pc.class === 'Rogue' && pc.level >= 5;
    }
}
