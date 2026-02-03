export class InitiativeTracker {
    combatants = [];
    currentIndex = 0;
    round = 1;
    constructor(participants) {
        this.combatants = [...participants].sort((a, b) => {
            if (b.initiative !== a.initiative) {
                return b.initiative - a.initiative;
            }
            // Tie-breaker: higher Dexterity score
            return b.dexterityScore - a.dexterityScore;
        });
    }
    getCurrentCombatant() {
        return this.combatants[this.currentIndex];
    }
    nextTurn() {
        this.currentIndex++;
        let newRound = false;
        if (this.currentIndex >= this.combatants.length) {
            this.currentIndex = 0;
            this.round++;
            newRound = true;
        }
        const current = this.combatants[this.currentIndex];
        // Handle Surprise
        const isSurprised = current.conditions.includes('Surprised');
        // Reset resources for the new turn
        current.resources = {
            actionSpent: isSurprised,
            bonusActionSpent: isSurprised,
            reactionSpent: false // Reactions are allowed AFTER the surprised turn ends
        };
        if (isSurprised) {
            // Remove surprised condition after the turn "ends" (which is now)
            current.conditions = current.conditions.filter(c => c !== 'Surprised');
        }
        return {
            combatant: current,
            round: this.round,
            newRound: newRound
        };
    }
    getOrder() {
        return [...this.combatants];
    }
    removeCombatant(id) {
        this.combatants = this.combatants.filter(c => c.id !== id);
        if (this.currentIndex >= this.combatants.length) {
            this.currentIndex = 0;
        }
    }
}
