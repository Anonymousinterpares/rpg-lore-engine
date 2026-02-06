export class ContextBuilder {
    /**
     * Builds a tailored context object for LLM agents based on current game state and mode.
     */
    static build(state, hexManager, recentHistory) {
        const base = this.buildBaseContext(state, recentHistory);
        switch (state.mode) {
            case 'COMBAT':
                return this.buildCombatContext(base, state);
            case 'DIALOGUE':
                return this.buildDialogueContext(base, state);
            case 'EXPLORATION':
            default:
                return this.buildExplorationContext(base, state, hexManager);
        }
    }
    static buildBaseContext(state, recentHistory) {
        const char = state.character;
        return {
            mode: state.mode,
            player: {
                name: char.name,
                class: char.class,
                level: char.level,
                hpStatus: this.getHpStatus(char.hp),
                conditions: char.conditions
            },
            timeOfDay: this.getTimeOfDay(state.worldTime.hour),
            location: {
                name: this.getCurrentHex(state).name || 'Unknown Location',
                biome: this.getCurrentHex(state).biome || 'Unknown Biome',
                description: this.getCurrentHex(state).description || ''
            },
            storySummary: state.storySummary,
            recentHistory: recentHistory.slice(-5) // Smart trim: only last 5
        };
    }
    static buildExplorationContext(base, state, hexManager) {
        const hex = this.getCurrentHex(state);
        const neighbors = hexManager.getNeighbors(state.location.coordinates);
        // Only include neighbors if we just moved or looking around (logic can be refined)
        const neighborInfo = neighbors.map((n, i) => ({
            direction: ['N', 'S', 'NE', 'NW', 'SE', 'SW'][i], // Simplified mapping
            biome: n.biome
        }));
        return {
            ...base,
            hex: {
                interestPoints: hex.interest_points.map(p => p.name),
                resourceNodes: hex.resourceNodes.map(r => r.resourceType),
                neighbors: neighborInfo
            },
            activeQuests: state.activeQuests.map(q => ({
                title: q.title,
                currentObjective: q.objectives.find(o => !o.isCompleted)?.description || 'No active objective'
            }))
        };
    }
    static buildCombatContext(base, state) {
        const combat = state.combat;
        const enemies = combat.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
        // Summarize enemies: "2 Goblins, 1 Hobgoblin"
        const enemyCounts = {};
        enemies.forEach(e => {
            enemyCounts[e.name] = (enemyCounts[e.name] || 0) + 1;
        });
        const enemySummary = Object.entries(enemyCounts)
            .map(([name, count]) => `${count} ${name}${count > 1 ? 's' : ''}`)
            .join(', ');
        return {
            ...base,
            combat: {
                round: combat.round,
                enemySummary: enemySummary || 'No active enemies',
                isPlayerTurn: combat.combatants[combat.currentTurnIndex]?.isPlayer || false
            }
        };
    }
    static buildDialogueContext(base, state) {
        // Find the NPC we are talking to (assuming stored in location or state)
        // This is a placeholder as the Dialogue mode is yet to be fully implemented
        const npcId = state.location.subLocationId; // Placeholder
        const npc = state.worldNpcs.find(n => n.id === npcId);
        return {
            ...base,
            npc: {
                name: npc?.name || 'Unknown NPC',
                disposition: this.getFactionDisposition(npc?.relationship?.standing || 0),
                faction: npc?.factionId,
                isMerchant: npc?.isMerchant || false
            }
        };
    }
    static getHpStatus(hp) {
        const ratio = hp.current / hp.max;
        if (ratio >= 0.75)
            return 'healthy';
        if (ratio >= 0.50)
            return 'wounded';
        if (ratio >= 0.25)
            return 'bloodied';
        if (ratio > 0)
            return 'critical';
        return 'unconscious';
    }
    static getTimeOfDay(hour) {
        if (hour >= 5 && hour < 7)
            return 'dawn';
        if (hour >= 7 && hour < 12)
            return 'morning';
        if (hour >= 12 && hour < 14)
            return 'midday';
        if (hour >= 14 && hour < 17)
            return 'afternoon';
        if (hour >= 17 && hour < 20)
            return 'dusk';
        return 'night';
    }
    static getFactionDisposition(standing) {
        if (standing >= 50)
            return 'allied';
        if (standing >= 20)
            return 'friendly';
        if (standing >= -20)
            return 'neutral';
        if (standing >= -50)
            return 'unfriendly';
        return 'hostile';
    }
    static getCurrentHex(state) {
        return state.worldMap.hexes[state.location.hexId];
    }
}
