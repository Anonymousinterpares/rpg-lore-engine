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

// ─── Rage Damage by Barbarian Level ───

function rageDamageBonus(level: number): number {
    if (level >= 16) return 4;
    if (level >= 9) return 3;
    return 2;
}

// ─── Engine ───

export class FeatureEffectEngine {
    private static fightingStyles: FightingStyleData[] = [];

    /** Load fighting styles data. Call during app initialization. */
    public static loadFightingStyles(data: FightingStyleData[]): void {
        this.fightingStyles = data;
    }

    /** Get all fighting style definitions. */
    public static getFightingStyles(): FightingStyleData[] {
        return this.fightingStyles;
    }

    /** Get a single fighting style by name. */
    public static getFightingStyle(name: string): FightingStyleData | undefined {
        return this.fightingStyles.find(s => s.name === name);
    }

    // ════════════════════════════════════════════
    //  PASSIVE MODIFIERS (called before attack)
    // ════════════════════════════════════════════

    /**
     * Compute all passive attack modifiers for a player's attack.
     * CombatOrchestrator calls this ONCE per attack action, then uses the result
     * for all attacks in the Extra Attack loop.
     */
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
        };

        // 1. Critical hit range (from subclass features like Improved Critical)
        result.critRange = this.computeCritRange(pc);

        // 2. Extra attacks
        result.extraAttacks = this.computeExtraAttacks(pc);

        // 3. Sneak Attack
        const sneak = this.computeSneakAttack(pc, context);
        result.sneakAttackDice = sneak.dice;
        result.sneakEligible = sneak.eligible;

        // 4. Fighting style bonuses
        const style = this.computeFightingStyleBonuses(pc, context);
        result.attackBonus += style.attackBonus ?? 0;
        result.damageBonus += style.damageBonus ?? 0;
        result.acBonus += style.acBonus ?? 0;
        result.rerollDamageBelow = style.rerollDamageBelow ?? 0;

        // 5. Rage bonuses (if active)
        if (this.isRaging(pc) && !context.isRanged) {
            result.damageBonus += rageDamageBonus(pc.level);
        }

        return result;
    }

    // ── Sub-computations ──

    private static computeCritRange(pc: PlayerCharacter): number {
        if (!pc.subclass) return 20;
        const classData = DataManager.getClass(pc.class);
        if (!classData?.subclasses) return 20;

        const subclass = classData.subclasses.find(sc => sc.name === pc.subclass);
        if (!subclass?.features) return 20;

        // Check for crit-expanding features by name
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
        const eligible = (context.isFinesseWeapon || context.isRanged) &&
            (context.hasAdvantage || context.hasAllyNearTarget);
        return { dice, eligible };
    }

    private static computeFightingStyleBonuses(pc: PlayerCharacter, context: AttackContext): Partial<AttackModifiers> {
        if (!pc.fightingStyle) return {};
        const style = this.getFightingStyle(pc.fightingStyle);
        if (!style) return {};

        // Check if style's condition matches current context
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
    //  ACTIVATED FEATURES (player choice)
    // ════════════════════════════════════════════

    /**
     * Resolve an activated feature. Validates resources, consumes them, returns result.
     */
    public static resolveActivatedFeature(
        pc: PlayerCharacter,
        featureName: string,
        options?: { spellSlotLevel?: number; healAmount?: number }
    ): ActivatedFeatureResult {
        switch (featureName) {
            case 'Second Wind': return this.resolveSecondWind(pc);
            case 'Rage': return this.resolveRage(pc);
            case 'Divine Smite': return this.resolveDivineSmite(pc, options?.spellSlotLevel ?? 1);
            case 'Lay on Hands': return this.resolveLayOnHands(pc, options?.healAmount ?? 0);
            default: return { success: false, message: `No automated effect for "${featureName}".` };
        }
    }

    // ── Second Wind (Fighter) ──

    private static resolveSecondWind(pc: PlayerCharacter): ActivatedFeatureResult {
        const usage = pc.featureUsages?.['Second Wind'];
        if (!usage || usage.current <= 0) return { success: false, message: 'Second Wind not available.' };

        const heal = Dice.roll('1d10') + pc.level;
        usage.current--;
        return { success: true, message: `Second Wind! Healed ${heal} HP.`, healAmount: heal };
    }

    // ── Rage (Barbarian) ──

    private static resolveRage(pc: PlayerCharacter): ActivatedFeatureResult {
        if (this.isRaging(pc)) return { success: false, message: 'Already raging!' };

        const usage = pc.featureUsages?.['Rage'];
        if (!usage || usage.current <= 0) return { success: false, message: 'No rages remaining.' };

        usage.current--;
        const dmgBonus = rageDamageBonus(pc.level);

        return {
            success: true,
            message: `RAGE! +${dmgBonus} melee damage, resistance to physical damage for 10 rounds.`,
            statusEffect: {
                id: 'rage',
                name: 'Rage',
                type: 'BUFF',
                duration: 10,
            },
        };
    }

    // ── Divine Smite (Paladin) ──

    private static resolveDivineSmite(pc: PlayerCharacter, slotLevel: number): ActivatedFeatureResult {
        if (pc.class !== 'Paladin' && pc.class !== 'Fighter') {
            return { success: false, message: 'Only Paladins can use Divine Smite.' };
        }

        const slot = pc.spellSlots?.[slotLevel.toString()];
        if (!slot || slot.current <= 0) {
            return { success: false, message: `No level ${slotLevel} spell slots remaining.` };
        }

        // 2d8 base + 1d8 per slot level above 1st (max 5d8), +1d8 vs undead/fiend
        const diceCount = Math.min(5, 2 + (slotLevel - 1));
        let totalDmg = 0;
        for (let i = 0; i < diceCount; i++) totalDmg += Dice.roll('1d8');

        slot.current--;

        return {
            success: true,
            message: `Divine Smite! ${diceCount}d8 = ${totalDmg} radiant damage (Level ${slotLevel} slot consumed).`,
            healAmount: -totalDmg, // Negative = damage to apply to target
        };
    }

    // ── Lay on Hands (Paladin) ──

    private static resolveLayOnHands(pc: PlayerCharacter, healAmount: number): ActivatedFeatureResult {
        const pool = this.getLayOnHandsPool(pc);
        if (pool <= 0) return { success: false, message: 'Lay on Hands pool is empty.' };

        const actual = Math.min(healAmount, pool);
        if (actual <= 0) return { success: false, message: 'Specify an amount to heal.' };

        // Track spent amount in featureUsages
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

    /** Check if Rage is currently active (status effect present). */
    public static isRaging(pc: PlayerCharacter): boolean {
        return (pc as any).statusEffects?.some((e: any) => e.id === 'rage') ?? false;
    }

    /** Get Lay on Hands remaining pool. */
    public static getLayOnHandsPool(pc: PlayerCharacter): number {
        const usage = pc.featureUsages?.['Lay on Hands'];
        if (usage) return usage.current;
        return pc.level * 5; // Full pool if never used
    }

    /** Get rage damage bonus for a given level. */
    public static getRageDamageBonus(level: number): number {
        return rageDamageBonus(level);
    }
}
