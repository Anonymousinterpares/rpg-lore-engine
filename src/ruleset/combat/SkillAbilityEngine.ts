/**
 * SkillAbilityEngine — Manages Tier 3/4 passive and active skill abilities.
 * Each skill at Tier 3 and Tier 4 offers a choice between passive and active ability.
 * Passive: always-on effect. Active: limited uses per rest/encounter.
 *
 * Ability definitions are loaded from data/skills/skills.json.
 * Effects are dispatched by skill name + tier + choice (passive/active).
 */
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { SkillEngine } from './SkillEngine';

export interface AbilityDefinition {
    id: string;
    name: string;
    description: string;
    type: 'passive' | 'active';
    usesPerRest?: number;     // For active: uses per long rest (undefined = per encounter)
    usesPerEncounter?: number; // For active: uses per encounter
}

export interface AbilityChoice {
    passive: AbilityDefinition;
    active: AbilityDefinition;
}

// Loaded from skills.json at runtime
let abilityRegistry: Record<string, { tier3?: AbilityChoice; tier4?: AbilityChoice }> = {};

export class SkillAbilityEngine {

    /**
     * Load ability definitions from parsed skills.json data.
     */
    static loadAbilities(skillsData: Record<string, any>): void {
        abilityRegistry = {};
        for (const [skillName, def] of Object.entries(skillsData)) {
            if (skillName === '_meta') continue;
            if (def.abilities) {
                abilityRegistry[skillName] = def.abilities;
            }
        }
    }

    /**
     * Get the ability choices for a skill at a given tier.
     */
    static getAbilityChoices(skillName: string, tier: 3 | 4): AbilityChoice | undefined {
        const key = tier === 3 ? 'tier3' : 'tier4';
        return abilityRegistry[skillName]?.[key];
    }

    /**
     * Get the chosen ability for a character's skill at a given tier.
     * Returns the ability definition if chosen, undefined otherwise.
     */
    static getChosenAbility(pc: PlayerCharacter, skillName: string, tier: 3 | 4): AbilityDefinition | undefined {
        const skillData = (pc as any).skills?.[skillName];
        if (!skillData) return undefined;

        const choice = tier === 3 ? skillData.chosenAbility?.tier3 : skillData.chosenAbility?.tier4;
        if (!choice) return undefined;

        const choices = this.getAbilityChoices(skillName, tier);
        if (!choices) return undefined;
        return choice === 'passive' ? choices.passive : choice === 'active' ? choices.active : undefined;
    }

    /**
     * Choose an ability (passive or active) for a skill at a tier.
     * Requires the character to have reached that tier.
     */
    static chooseAbility(pc: PlayerCharacter, skillName: string, tier: 3 | 4, choice: 'passive' | 'active'): string {
        const currentTier = SkillEngine.getSkillTier(pc, skillName);
        if (currentTier < tier) return `${skillName} must be Tier ${tier} to choose this ability. Current: Tier ${currentTier}.`;

        const choices = this.getAbilityChoices(skillName, tier);
        if (!choices) return `No abilities defined for ${skillName} Tier ${tier}.`;

        const ability = choices[choice];
        if (!ability) return `Invalid choice: ${choice}.`;

        const skillData = (pc as any).skills?.[skillName];
        if (!skillData) return `${skillName} not found in character skills.`;

        if (!skillData.chosenAbility) skillData.chosenAbility = {};
        const tierKey = tier === 3 ? 'tier3' : 'tier4';
        skillData.chosenAbility[tierKey] = choice;

        return `Chose ${choice} ability for ${skillName} (Tier ${tier}): ${ability.name}`;
    }

    /**
     * Check if a character has a specific passive ability active.
     * Used by game systems to check for passive effects.
     */
    static hasPassiveAbility(pc: PlayerCharacter, skillName: string, tier: 3 | 4): boolean {
        const ability = this.getChosenAbility(pc, skillName, tier);
        return ability?.type === 'passive';
    }

    /**
     * Check if a character has a specific active ability and can use it.
     */
    static hasActiveAbility(pc: PlayerCharacter, skillName: string, tier: 3 | 4): boolean {
        const ability = this.getChosenAbility(pc, skillName, tier);
        return ability?.type === 'active';
    }

    /**
     * Get remaining uses of an active ability.
     * Tracks usage in character._abilityUses[abilityId].
     */
    static getRemainingUses(pc: PlayerCharacter, skillName: string, tier: 3 | 4): number {
        const ability = this.getChosenAbility(pc, skillName, tier);
        if (!ability || ability.type !== 'active') return 0;

        const maxUses = ability.usesPerRest || ability.usesPerEncounter || 1;
        const used = (pc as any)._abilityUses?.[ability.id] || 0;
        return Math.max(0, maxUses - used);
    }

    /**
     * Consume one use of an active ability. Returns true if successful.
     */
    static useAbility(pc: PlayerCharacter, skillName: string, tier: 3 | 4): { success: boolean; message: string } {
        const ability = this.getChosenAbility(pc, skillName, tier);
        if (!ability || ability.type !== 'active') {
            return { success: false, message: 'No active ability chosen.' };
        }

        const remaining = this.getRemainingUses(pc, skillName, tier);
        if (remaining <= 0) {
            return { success: false, message: `${ability.name} has no uses remaining.` };
        }

        if (!(pc as any)._abilityUses) (pc as any)._abilityUses = {};
        (pc as any)._abilityUses[ability.id] = ((pc as any)._abilityUses[ability.id] || 0) + 1;

        return { success: true, message: `Used ${ability.name}! (${remaining - 1} uses remaining)` };
    }

    /**
     * Reset ability uses on rest. Called by RestingEngine.
     * resetType: 'short' resets per-encounter, 'long' resets all.
     */
    static resetAbilityUses(pc: PlayerCharacter, resetType: 'short' | 'long'): void {
        if (!(pc as any)._abilityUses) return;

        if (resetType === 'long') {
            // Long rest resets everything
            (pc as any)._abilityUses = {};
            return;
        }

        // Short rest: only reset per-encounter abilities
        for (const [skillName, data] of Object.entries(abilityRegistry)) {
            for (const tierKey of ['tier3', 'tier4'] as const) {
                const choices = data[tierKey];
                if (!choices) continue;
                const active = choices.active;
                if (active?.usesPerEncounter) {
                    delete (pc as any)._abilityUses[active.id];
                }
            }
        }
    }

    /**
     * Reset per-encounter ability uses. Called when combat ends.
     */
    static resetEncounterUses(pc: PlayerCharacter): void {
        this.resetAbilityUses(pc, 'short');
    }

    /**
     * Get all active abilities a character has available (for command listing).
     */
    static getAvailableAbilities(pc: PlayerCharacter): { skillName: string; tier: number; ability: AbilityDefinition; remaining: number }[] {
        const result: { skillName: string; tier: number; ability: AbilityDefinition; remaining: number }[] = [];

        for (const skillName of Object.keys((pc as any).skills || {})) {
            for (const tier of [3, 4] as const) {
                const ability = this.getChosenAbility(pc, skillName, tier);
                if (ability?.type === 'active') {
                    result.push({
                        skillName,
                        tier,
                        ability,
                        remaining: this.getRemainingUses(pc, skillName, tier),
                    });
                }
            }
        }

        return result;
    }
}
