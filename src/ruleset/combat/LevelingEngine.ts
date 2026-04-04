import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { MechanicsEngine } from './MechanicsEngine';
import { SkillEngine } from './SkillEngine';
import { DataManager } from '../data/DataManager';

/** Levels at which ASI (Ability Score Improvement) is granted. */
const ASI_LEVELS = [4, 8, 12, 16, 19];

/** Level at which each class gets Fighting Style. */
const FIGHTING_STYLE_LEVELS: Record<string, number> = {
    Fighter: 1, Paladin: 2, Ranger: 2
};

/** Level at which each class chooses their subclass. */
const SUBCLASS_LEVELS: Record<string, number> = {
    Cleric: 1, Sorcerer: 1, Warlock: 1,
    Wizard: 2, Druid: 2,
    Barbarian: 3, Bard: 3, Fighter: 3, Monk: 3,
    Paladin: 3, Ranger: 3, Rogue: 3
};

/**
 * Build the spellSlots Record from class progression data for a given level.
 * Progression spellSlots is a 9-element array: index 0 = 1st-level slots, index 8 = 9th-level.
 * Returns Record<string, { current, max }> keyed by spell level ("1"–"9").
 */
export function buildSpellSlotsFromProgression(
    classData: any,
    level: number
): Record<string, { current: number; max: number }> {
    const progression = classData?.progression;
    if (!progression || !Array.isArray(progression)) return {};

    // Find the highest progression entry at or below this level
    const entry = progression
        .filter((p: any) => p.level <= level)
        .sort((a: any, b: any) => b.level - a.level)[0];

    if (!entry?.spellSlots) return {};

    const slots: Record<string, { current: number; max: number }> = {};
    entry.spellSlots.forEach((count: number, index: number) => {
        if (count > 0) {
            const spellLevel = (index + 1).toString();
            slots[spellLevel] = { current: count, max: count };
        }
    });

    return slots;
}

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
        // Tough feat: +2 HP per level (applied on each level-up)
        if (pc.feats?.includes('Tough')) pc.hp.max += 2;
        pc.hp.current = pc.hp.max;

        // Increase Hit Dice
        pc.hitDice.max++;
        pc.hitDice.current = pc.hitDice.max;

        // Grant Skill Points from the leveling class's config
        const spGrant = (classData as any)?.skillPointsPerLevel || 2;
        SkillEngine.grantSkillPoints(pc, spGrant);

        // Update spell slots from class progression
        if (classData?.progression) {
            const newSlots = buildSpellSlotsFromProgression(classData, pc.level);
            if (Object.keys(newSlots).length > 0) {
                // Preserve current usage: only reset max and add new slot levels
                const oldSlots = pc.spellSlots || {};
                for (const [lvl, slot] of Object.entries(newSlots)) {
                    const old = (oldSlots as any)[lvl];
                    if (old) {
                        // Existing slot level: update max, add any gained slots to current
                        const gained = slot.max - (old.max || 0);
                        (oldSlots as any)[lvl] = { current: old.current + Math.max(0, gained), max: slot.max };
                    } else {
                        // New slot level unlocked
                        (oldSlots as any)[lvl] = { current: slot.max, max: slot.max };
                    }
                }
                pc.spellSlots = oldSlots;
            }
        }

        // Activate new class features at this level
        const newFeatures: string[] = [];
        if (classData?.allFeatures) {
            for (const feat of classData.allFeatures) {
                if (feat.level === pc.level && feat.usage && feat.usage.type !== 'PASSIVE') {
                    if (!pc.featureUsages) (pc as any).featureUsages = {};
                    if (!pc.featureUsages[feat.name]) {
                        pc.featureUsages[feat.name] = {
                            current: feat.usage.limit || 0,
                            max: feat.usage.limit || 0,
                            usageType: feat.usage.type
                        };
                    }
                }
                if (feat.level === pc.level) {
                    newFeatures.push(feat.name);
                }
            }
        }
        // Track new features for UI highlighting
        if (newFeatures.length > 0) {
            (pc as any)._newFeatures = newFeatures;
        }

        // Spell learning: track pending spell choices for casters
        const spellLearningClasses: Record<string, number> = {
            'Wizard': 2, 'Sorcerer': 1, 'Bard': 1, 'Ranger': 1, 'Warlock': 1
        };
        const spellsToLearn = spellLearningClasses[levelingClass] || 0;
        if (spellsToLearn > 0 && pc.level > 1) {
            (pc as any)._pendingSpellChoices = ((pc as any)._pendingSpellChoices || 0) + spellsToLearn;
            // Update unseenSpells with newly accessible spell levels
            const maxSpellLevel = Math.min(9, Math.ceil(pc.level / 2));
            const allClassSpells = DataManager.getSpellsByClass(levelingClass, maxSpellLevel);
            const known = new Set([
                ...(pc.cantripsKnown || []),
                ...(pc.knownSpells || []),
                ...(pc.spellbook || []),
                ...(pc.preparedSpells || [])
            ]);
            pc.unseenSpells = allClassSpells.filter(s => !known.has(s.name)).map(s => s.name);
        }

        // Subclass selection or subclass feature activation
        const subclassLevel = SUBCLASS_LEVELS[levelingClass];
        if (subclassLevel && pc.level >= subclassLevel && !pc.subclass) {
            // Trigger subclass selection UI (also catches retroactive cases)
            (pc as any)._pendingSubclass = true;
        } else if (pc.subclass && classData?.subclasses) {
            // Activate subclass features at this level
            const subclassData = classData.subclasses.find((sc: any) => sc.name === pc.subclass);
            if (subclassData?.features) {
                for (const feat of subclassData.features) {
                    if (feat.level === pc.level) {
                        newFeatures.push(feat.name);
                        if (feat.usage && feat.usage.type !== 'PASSIVE') {
                            if (!pc.featureUsages) (pc as any).featureUsages = {};
                            if (!pc.featureUsages[feat.name]) {
                                pc.featureUsages[feat.name] = {
                                    current: feat.usage.limit || 0,
                                    max: feat.usage.limit || 0,
                                    usageType: feat.usage.type
                                };
                            }
                        }
                    }
                }
                // Auto-prepare subclass domain/oath spells at this level
                if (subclassData.spells) {
                    const spellLevel = pc.level.toString();
                    const domainSpells = subclassData.spells[spellLevel];
                    if (domainSpells && Array.isArray(domainSpells)) {
                        for (const spellName of domainSpells) {
                            if (!pc.preparedSpells.includes(spellName)) {
                                pc.preparedSpells.push(spellName);
                            }
                        }
                    }
                }
            }
            // Update _newFeatures if subclass added features
            if (newFeatures.length > 0) {
                (pc as any)._newFeatures = newFeatures;
            }
        }

        const classLabel = isMulticlass ? ` (${levelingClass})` : '';
        let summary = `${pc.name} reached Level ${pc.level}${classLabel}! HP +${hpIncrease} (max ${pc.hp.max}). Gained ${spGrant} SP.`;
        // Fighting Style trigger
        const fsLevel = FIGHTING_STYLE_LEVELS[levelingClass];
        if (fsLevel && pc.level >= fsLevel && !pc.fightingStyle) {
            (pc as any)._pendingFightingStyle = true;
        }

        if (newFeatures.length > 0) summary += ` New features: ${newFeatures.join(', ')}.`;
        if (spellsToLearn > 0 && pc.level > 1) summary += ` Choose ${spellsToLearn} new spell(s)!`;
        if ((pc as any)._pendingSubclass) summary += ` Choose your subclass!`;
        if ((pc as any)._pendingFightingStyle) summary += ` Choose your Fighting Style!`;

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

        // Track for respec
        if (!(pc as any)._asiHistory) (pc as any)._asiHistory = [];
        (pc as any)._asiHistory.push({ type: 'single', ability, increase });

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
        // Track for respec
        if (!(pc as any)._asiHistory) (pc as any)._asiHistory = [];
        (pc as any)._asiHistory.push({ type: 'split', abilities: { [ability1]: 1, [ability2]: 1 } });
        return `ASI applied: ${results.join(', ')}.`;
    }

    /**
     * Select a feat instead of ASI. Consumes one pending ASI.
     * Returns success message or error.
     */
    public static selectFeat(pc: PlayerCharacter, featName: string): string {
        if (!this.hasPendingASI(pc)) return 'No pending ASI/Feat choice available.';

        // Load feat data
        const featRegistry = (globalThis as any).__featRegistry;
        if (!featRegistry) return 'Feat data not loaded.';

        const feat = featRegistry[featName];
        if (!feat) return `Unknown feat: ${featName}. Use /feat list to see available feats.`;

        // Check if already has this feat (most feats can only be taken once)
        if (pc.feats?.includes(featName)) return `You already have ${featName}.`;

        // Check prerequisites
        if (feat.prerequisites?.spellcaster) {
            const isSpellcaster = Object.values(pc.spellSlots || {}).some((s: any) => s.max > 0);
            if (!isSpellcaster) return `${featName} requires spellcasting ability.`;
        }

        // Apply feat
        if (!pc.feats) (pc as any).feats = [];
        pc.feats.push(featName);
        (pc as any)._pendingASI--;

        // Apply immediate effects
        const results: string[] = [`Feat acquired: ${featName}!`];

        for (const effect of (feat.effects || [])) {
            if (effect.type === 'ability_increase' && effect.ability) {
                const stats = pc.stats as Record<string, number>;
                const current = stats[effect.ability] || 10;
                if (current < 20) {
                    stats[effect.ability] = Math.min(20, current + effect.value);
                    results.push(`${effect.ability} +${effect.value} (now ${stats[effect.ability]})`);
                }
            }
            if (effect.type === 'hp_per_level') {
                // Tough: retroactive HP bonus
                const bonus = effect.value * pc.level;
                pc.hp.max += bonus;
                pc.hp.current += bonus;
                results.push(`+${bonus} max HP (${effect.value} per level)`);
            }
            if (effect.type === 'initiative_bonus') {
                results.push(`+${effect.value} Initiative`);
            }
            if (effect.type === 'speed_bonus') {
                results.push(`+${effect.value}ft movement speed`);
            }
        }

        return results.join(' ');
    }

    /**
     * Get all available feats (not already taken).
     */
    public static getAvailableFeats(pc: PlayerCharacter): any[] {
        const registry = (globalThis as any).__featRegistry || {};
        const taken = new Set(pc.feats || []);
        return Object.values(registry).filter((f: any) => f.name && !taken.has(f.name));
    }

    /**
     * Select a subclass. Applies initial subclass features and domain spells.
     */
    public static selectSubclass(pc: PlayerCharacter, subclassName: string): string {
        if (pc.subclass) return `Already has subclass: ${pc.subclass}.`;

        const classData = DataManager.getClass(pc.class);
        if (!classData?.subclasses) return `No subclass data for ${pc.class}.`;

        const subclass = classData.subclasses.find((sc: any) => sc.name === subclassName);
        if (!subclass) return `Unknown subclass: ${subclassName}.`;

        pc.subclass = subclassName;
        delete (pc as any)._pendingSubclass;

        const results: string[] = [`Subclass chosen: ${subclassName}!`];
        const newFeatures: string[] = [];

        // Apply all subclass features at or below current level
        for (const feat of (subclass.features || [])) {
            if (feat.level <= pc.level) {
                newFeatures.push(feat.name);
                if (feat.usage && feat.usage.type !== 'PASSIVE') {
                    if (!pc.featureUsages) (pc as any).featureUsages = {};
                    if (!pc.featureUsages[feat.name]) {
                        pc.featureUsages[feat.name] = {
                            current: feat.usage.limit || 0,
                            max: feat.usage.limit || 0,
                            usageType: feat.usage.type
                        };
                    }
                }
            }
        }

        // Apply domain/oath spells up to current level
        if (subclass.spells) {
            for (const [lvStr, spells] of Object.entries(subclass.spells)) {
                if (parseInt(lvStr) <= pc.level && Array.isArray(spells)) {
                    for (const spellName of spells as string[]) {
                        if (!pc.preparedSpells.includes(spellName)) {
                            pc.preparedSpells.push(spellName);
                        }
                    }
                }
            }
        }

        if (newFeatures.length > 0) {
            results.push(`Features: ${newFeatures.join(', ')}.`);
            (pc as any)._newFeatures = newFeatures;
        }

        return results.join(' ');
    }

    /**
     * Get available subclasses for a class.
     */
    public static getAvailableSubclasses(className: string): any[] {
        const classData = DataManager.getClass(className);
        return classData?.subclasses || [];
    }

    /**
     * Get the level at which a class chooses their subclass.
     */
    public static getSubclassLevel(className: string): number {
        return SUBCLASS_LEVELS[className] || 3;
    }

    /**
     * Select a Fighting Style.
     */
    public static selectFightingStyle(pc: PlayerCharacter, styleName: string): string {
        if (pc.fightingStyle) return `Already has Fighting Style: ${pc.fightingStyle}.`;
        const { FeatureEffectEngine } = require('./FeatureEffectEngine');
        const style = FeatureEffectEngine.getFightingStyle(styleName);
        if (!style) return `Unknown Fighting Style: ${styleName}.`;
        pc.fightingStyle = styleName;
        delete (pc as any)._pendingFightingStyle;
        return `Fighting Style chosen: ${styleName}! ${style.description}`;
    }

    /**
     * Check if a class gets a Fighting Style.
     */
    public static getFightingStyleLevel(className: string): number | undefined {
        return FIGHTING_STYLE_LEVELS[className];
    }

    /**
     * Adds XP to a character and returns true if they reached a new level.
     */
    public static addXP(pc: PlayerCharacter, xp: number): { totalXP: number, leveledUp: boolean } {
        pc.xp += xp;
        return { totalXP: pc.xp, leveledUp: this.canLevelUp(pc) };
    }

    /**
     * Auto-levels all companions to player.level - 1.
     * Centralized function — call from ANY path that grants XP and levels the player.
     * Sets pendingLevelUp on each companion that leveled for UI notification.
     * Returns messages for each companion that leveled.
     */
    public static autoLevelCompanions(
        playerLevel: number,
        companions: any[],
        logCallback?: (msg: string) => void
    ): string[] {
        const targetLevel = Math.max(1, playerLevel - 1);
        const messages: string[] = [];

        for (const comp of companions) {
            if (comp.character.level >= targetLevel) continue;

            const oldLevel = comp.character.level;
            const oldMaxHp = comp.character.hp.max;
            const oldAc = comp.character.ac;
            const oldSlots: Record<string, number> = {};
            for (const [lv, s] of Object.entries(comp.character.spellSlots || {})) {
                oldSlots[lv] = (s as any).max || 0;
            }

            let safety = 0;
            while (comp.character.level < targetLevel && safety < 20) {
                const prevLevel = comp.character.level;
                comp.character.xp = MechanicsEngine.getNextLevelXP(comp.character.level);
                const msg = this.levelUp(comp.character);
                const fullMsg = `${comp.character.name}: ${msg}`;
                messages.push(fullMsg);
                logCallback?.(fullMsg);
                if (comp.character.level === prevLevel) break;
                safety++;
            }

            if (comp.character.level > oldLevel) {
                const newSlots: Record<string, number> = {};
                for (const [lv, s] of Object.entries(comp.character.spellSlots || {})) {
                    newSlots[lv] = (s as any).max || 0;
                }
                comp.meta.pendingLevelUp = {
                    oldLevel, newLevel: comp.character.level,
                    oldMaxHp, newMaxHp: comp.character.hp.max,
                    oldAc, newAc: comp.character.ac,
                    oldSpellSlots: oldSlots, newSpellSlots: newSlots,
                };
            }
        }

        return messages;
    }
}
