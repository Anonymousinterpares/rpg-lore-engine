/**
 * SkillEngine — Manages skill tier progression, investment, and reset.
 * Data-driven: reads tier costs and level gates from skills.json registry.
 */
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

// Loaded at runtime from data/skills/skills.json
let skillRegistry: Record<string, SkillDefinition> = {};

export interface SkillDefinition {
    ability: string;
    description: string;
    tierCosts: number[];       // [tier1Cost, tier2Cost, tier3Cost, tier4Cost]
    levelGates: number[];      // [tier1MinLevel, tier2MinLevel, tier3MinLevel, tier4MinLevel]
    tierMultipliers: number[]; // [tier1Mult, tier2Mult, tier3Mult, tier4Mult]
}

export interface SkillState {
    tier: number;
    pointsInvested: number;
    chosenAbility: {
        tier3?: 'passive' | 'active';
        tier4?: 'passive' | 'active';
    };
}

const TIER_NAMES = ['Untrained', 'Proficient', 'Expert', 'Master', 'Grandmaster'];

export class SkillEngine {

    /**
     * Initialize the skill registry from loaded JSON data.
     */
    static loadRegistry(data: Record<string, any>): void {
        skillRegistry = {};
        for (const [name, def] of Object.entries(data)) {
            if (name === '_meta') continue;
            skillRegistry[name] = def as SkillDefinition;
        }
    }

    static getRegistry(): Record<string, SkillDefinition> {
        return skillRegistry;
    }

    static getSkillDef(skillName: string): SkillDefinition | undefined {
        return skillRegistry[skillName];
    }

    /**
     * Get the tier name for a given tier number.
     */
    static getTierName(tier: number): string {
        return TIER_NAMES[tier] || 'Unknown';
    }

    /**
     * Get the proficiency multiplier for a skill at a given tier.
     * Tier 0 = 0 (untrained), Tier 1 = 1x, Tier 2 = 2x, Tier 3 = 2x, Tier 4 = 3x
     */
    static getTierMultiplier(skillName: string, tier: number): number {
        const def = skillRegistry[skillName];
        if (!def || tier <= 0) return 0;
        return def.tierMultipliers[tier - 1] || 1;
    }

    /**
     * Get the current tier for a skill on a character.
     */
    static getSkillTier(pc: PlayerCharacter, skillName: string): number {
        const skill = (pc as any).skills?.[skillName];
        if (skill) return skill.tier || 0;
        // Legacy fallback: check old skillProficiencies array
        if (pc.skillProficiencies?.includes(skillName as any)) return 1;
        return 0;
    }

    /**
     * Get the total skill check bonus for a character's skill.
     * = abilityMod + (profBonus * tierMultiplier)
     */
    static getSkillBonus(pc: PlayerCharacter, skillName: string, profBonus: number): number {
        const tier = this.getSkillTier(pc, skillName);
        const multiplier = this.getTierMultiplier(skillName, tier);
        return profBonus * multiplier;
    }

    /**
     * Get the SP cost to advance a skill to the next tier.
     * Returns null if already at max tier.
     */
    static getCostToNextTier(skillName: string, currentTier: number): number | null {
        const def = skillRegistry[skillName];
        if (!def || currentTier >= 4) return null;
        return def.tierCosts[currentTier] || null;
    }

    /**
     * Get the minimum character level required for the next tier.
     */
    static getLevelGateForTier(skillName: string, targetTier: number): number {
        const def = skillRegistry[skillName];
        if (!def || targetTier <= 0 || targetTier > 4) return 1;
        return def.levelGates[targetTier - 1] || 1;
    }

    /**
     * Check if a character can invest in a skill (advance to next tier).
     * Returns { canInvest: true } or { canInvest: false, reason: string }.
     */
    static canInvest(pc: PlayerCharacter, skillName: string): { canInvest: boolean; reason?: string } {
        const def = skillRegistry[skillName];
        if (!def) return { canInvest: false, reason: `Unknown skill: ${skillName}` };

        const currentTier = this.getSkillTier(pc, skillName);
        if (currentTier >= 4) return { canInvest: false, reason: `${skillName} is already at Grandmaster tier.` };

        const cost = def.tierCosts[currentTier];
        const sp = (pc as any).skillPoints?.available || 0;
        if (sp < cost) return { canInvest: false, reason: `Need ${cost} SP, have ${sp}.` };

        const levelGate = def.levelGates[currentTier];
        if (pc.level < levelGate) return { canInvest: false, reason: `Requires character level ${levelGate}. Current: ${pc.level}.` };

        return { canInvest: true };
    }

    /**
     * Invest skill points to advance a skill to the next tier.
     * Mutates the character in place. Returns success message or error.
     */
    static invest(pc: PlayerCharacter, skillName: string): string {
        const check = this.canInvest(pc, skillName);
        if (!check.canInvest) return check.reason!;

        const currentTier = this.getSkillTier(pc, skillName);
        const def = skillRegistry[skillName]!;
        const cost = def.tierCosts[currentTier];
        const newTier = currentTier + 1;

        // Initialize if needed (legacy character protection)
        if (!(pc as any).skills) (pc as any).skills = {};
        if (!(pc as any).skillPoints) (pc as any).skillPoints = { available: 0, totalEarned: 0 };
        if (!(pc as any).skills[skillName]) {
            (pc as any).skills[skillName] = { tier: 0, pointsInvested: 0, chosenAbility: {} };
        }

        (pc as any).skills[skillName].tier = newTier;
        (pc as any).skills[skillName].pointsInvested += cost;
        (pc as any).skillPoints.available -= cost;

        const tierName = TIER_NAMES[newTier];
        return `${skillName} advanced to ${tierName} (Tier ${newTier}). Spent ${cost} SP.`;
    }

    /**
     * Full respec: reset ALL skills to Tier 0, return all invested SP to pool.
     */
    static resetAll(pc: PlayerCharacter): string {
        if (!(pc as any).skillPoints) (pc as any).skillPoints = { available: 0, totalEarned: 0 };
        let totalRefunded = 0;
        const skills = (pc as any).skills || {};

        for (const skillName of Object.keys(skills)) {
            totalRefunded += skills[skillName].pointsInvested || 0;
            skills[skillName].tier = 0;
            skills[skillName].pointsInvested = 0;
            skills[skillName].chosenAbility = {};
        }

        (pc as any).skillPoints.available += totalRefunded;
        return `Reset all skills. Refunded ${totalRefunded} SP. Available: ${(pc as any).skillPoints.available} SP.`;
    }

    /**
     * Initialize skills Record from legacy skillProficiencies array.
     * Used during migration and character creation.
     */
    static initFromProficiencies(pc: PlayerCharacter): void {
        if (!(pc as any).skills) (pc as any).skills = {};
        if (!(pc as any).skillPoints) (pc as any).skillPoints = { available: 0, totalEarned: 0 };

        for (const skillName of pc.skillProficiencies || []) {
            if (!(pc as any).skills[skillName]) {
                (pc as any).skills[skillName] = { tier: 1, pointsInvested: 0, chosenAbility: {} };
            }
        }
    }

    /**
     * Grant skill points to a character (called on level up).
     */
    static grantSkillPoints(pc: PlayerCharacter, amount: number): void {
        if (!(pc as any).skillPoints) (pc as any).skillPoints = { available: 0, totalEarned: 0 };
        (pc as any).skillPoints.available += amount;
        (pc as any).skillPoints.totalEarned += amount;
    }
}
