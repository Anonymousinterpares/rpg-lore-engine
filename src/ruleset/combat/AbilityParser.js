import { DataManager } from '../data/DataManager';
export class AbilityParser {
    /**
     * Extracts actionable combat abilities from a character's class features.
     */
    static getCombatAbilities(pc) {
        const charClass = DataManager.getClass(pc.class);
        if (!charClass)
            return [];
        const abilities = [];
        // Filter features that the character has already unlocked by level
        const unlockedFeatures = charClass.allFeatures.filter(f => f.level <= pc.level);
        unlockedFeatures.forEach(feature => {
            const isPassive = !feature.usage || feature.usage.type === 'PASSIVE';
            const usageState = pc.featureUsages ? pc.featureUsages[feature.name] : undefined;
            const actionCost = feature.actionCost || 'NONE';
            abilities.push({
                name: feature.name,
                description: feature.description,
                actionCost: actionCost,
                isPassive: isPassive,
                usage: usageState ? {
                    current: usageState.current,
                    max: usageState.max,
                    usageType: usageState.usageType
                } : undefined
            });
        });
        return abilities;
    }
    /**
     * Filters for active abilities (those with an action cost or limited usage).
     */
    static getActiveAbilities(pc) {
        return this.getCombatAbilities(pc).filter(a => !a.isPassive || a.usage !== undefined);
    }
}
