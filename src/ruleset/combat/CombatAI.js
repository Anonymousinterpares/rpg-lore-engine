export var AITier;
(function (AITier) {
    AITier[AITier["FERAL"] = 0] = "FERAL";
    AITier[AITier["BEAST"] = 1] = "BEAST";
    AITier[AITier["CUNNING"] = 2] = "CUNNING";
    AITier[AITier["TACTICAL"] = 3] = "TACTICAL";
    AITier[AITier["STRATEGIC"] = 4] = "STRATEGIC"; // INT 16+: Advanced party analysis
})(AITier || (AITier = {}));
export class CombatAI {
    /**
     * Derives AI tier from INT score
     */
    static getTier(intScore) {
        if (intScore <= 2)
            return AITier.FERAL;
        if (intScore <= 6)
            return AITier.BEAST;
        if (intScore <= 12)
            return AITier.CUNNING;
        if (intScore <= 15)
            return AITier.TACTICAL;
        return AITier.STRATEGIC;
    }
    /**
     * Decides the best action for a combatant
     */
    static decideAction(actor, state) {
        const intScore = actor.stats['INT'] || 10;
        const tier = this.getTier(intScore);
        const targets = state.combatants.filter(c => c.type !== actor.type && c.hp.current > 0);
        if (targets.length === 0)
            return { type: 'MOVE', targetId: '' };
        // 1. Survival Check (Tier 1+)
        if (tier >= AITier.BEAST && actor.hp.current < actor.hp.max * 0.2) {
            // Low health survival instinct
            if (tier >= AITier.TACTICAL) {
                // Tactical might try to heal or retreat to cover
                // For now, just generic retreat
                return { type: 'RETREAT', targetId: '' };
            }
            return { type: 'ATTACK', targetId: this.getNearestTarget(actor, targets).id }; // Fight back?
        }
        // 2. Target Selection
        let target = targets[0];
        switch (tier) {
            case AITier.FERAL:
                target = this.getNearestTarget(actor, targets);
                break;
            case AITier.BEAST:
                // Prioritize same target as allies
                target = this.getAllyTarget(actor, state, targets) || this.getNearestTarget(actor, targets);
                break;
            case AITier.CUNNING:
                // Target lowest HP (squishy)
                target = targets.sort((a, b) => a.hp.current - b.hp.current)[0];
                break;
            case AITier.TACTICAL:
            case AITier.STRATEGIC:
                // Prioritize "threats" (simplified: target with lowest max HP usually indicates a caster)
                target = targets.sort((a, b) => a.hp.max - b.hp.max)[0];
                break;
        }
        return { type: 'ATTACK', targetId: target.id };
    }
    static getNearestTarget(actor, targets) {
        // Simplified distance (we don't have grid coords yet, so just pick first for now)
        // In a real grid, this would calculate actual distance
        return targets[0];
    }
    static getAllyTarget(actor, state, enemies) {
        const allies = state.combatants.filter(c => c.type === actor.type && c.id !== actor.id);
        // This would require tracking who allies are attacking (state currently doesn't track this)
        return null;
    }
}
