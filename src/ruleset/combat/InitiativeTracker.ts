import { CombatantState } from './types';

export class InitiativeTracker {
    private combatants: CombatantState[] = [];
    private currentIndex: number = 0;
    private round: number = 1;

    constructor(participants: CombatantState[]) {
        this.combatants = [...participants].sort((a, b) => {
            if (b.initiative !== a.initiative) {
                return b.initiative - a.initiative;
            }
            // Tie-breaker: higher Dexterity score
            return b.dexterityScore - a.dexterityScore;
        });
    }

    public getCurrentCombatant(): CombatantState {
        return this.combatants[this.currentIndex];
    }

    public nextTurn(): { combatant: CombatantState; round: number; newRound: boolean } {
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

    public getOrder(): CombatantState[] {
        return [...this.combatants];
    }

    public removeCombatant(id: string) {
        this.combatants = this.combatants.filter(c => c.id !== id);
        if (this.currentIndex >= this.combatants.length) {
            this.currentIndex = 0;
        }
    }
}
