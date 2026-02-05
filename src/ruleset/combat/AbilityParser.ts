import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { CharacterClass } from '../schemas/ClassSchema';
import { DataManager } from '../data/DataManager';

export interface CombatAbility {
    name: string;
    description: string;
    actionCost: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'NONE';
    usage?: {
        current: number;
        max: number;
        usageType: 'SHORT_REST' | 'LONG_REST' | 'PER_ROUND';
    };
    isPassive: boolean;
}

export class AbilityParser {
    /**
     * Extracts actionable combat abilities from a character's class features.
     */
    public static getCombatAbilities(pc: PlayerCharacter): CombatAbility[] {
        const charClass = DataManager.getClass(pc.class);
        if (!charClass) return [];

        const abilities: CombatAbility[] = [];

        // Filter features that the character has already unlocked by level
        const unlockedFeatures = charClass.allFeatures.filter(f => f.level <= pc.level);

        unlockedFeatures.forEach(feature => {
            const isPassive = !feature.usage || feature.usage.type === 'PASSIVE';
            const usageState = pc.featureUsages ? pc.featureUsages[feature.name] : undefined;
            const actionCost = feature.actionCost || 'NONE';

            abilities.push({
                name: feature.name,
                description: feature.description,
                actionCost: actionCost as any,
                isPassive: isPassive,
                usage: usageState ? {
                    current: usageState.current,
                    max: usageState.max,
                    usageType: usageState.usageType as any
                } : undefined
            });
        });

        return abilities;
    }

    /**
     * Filters for active abilities (those with an action cost or limited usage).
     */
    public static getActiveAbilities(pc: PlayerCharacter): CombatAbility[] {
        return this.getCombatAbilities(pc).filter(a => !a.isPassive || a.usage !== undefined);
    }
}
