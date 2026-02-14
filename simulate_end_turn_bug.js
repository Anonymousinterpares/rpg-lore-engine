
// Mocking the classes to test the flow logic

class MockCombatManager {
    constructor(state) {
        this.state = state;
    }

    advanceTurn() {
        const combat = this.state.combat;
        combat.currentTurnIndex = (combat.currentTurnIndex + 1) % combat.combatants.length;
        const actor = combat.combatants[combat.currentTurnIndex];
        return `Round X: ${actor.name}'s turn.`;
    }

    moveCombatant(actor, pos) { return `${actor.name} moves.`; }
}

class MockOrchestrator {
    constructor() {
        this.state = {
            combat: {
                combatants: [
                    { name: 'Dam', isPlayer: true, id: 'p1', initiative: 20, type: 'player', resources: {} },
                    { name: 'Cat', isPlayer: false, id: 'e1', initiative: 10, type: 'enemy', resources: {}, tactical: { isRanged: false } }
                ],
                currentTurnIndex: 0,
                turnActions: []
            },
            lastNarrative: ''
        };
        this.combatManager = new MockCombatManager(this.state);
        this.turnProcessing = false;
    }

    log(msg) { console.log(`[LOG] ${msg}`); }

    async emitStateUpdate() { console.log(`[STATE] Updated`); }

    async processCombatQueue() {
        console.log(`[Queue] Start. Locked: ${this.turnProcessing}`);
        if (this.turnProcessing) return;
        this.turnProcessing = true;
        try {
            // Emulate loop
            let loopCount = 0;
            while (this.state.combat && loopCount < 5) {
                const actor = this.state.combat.combatants[this.state.combat.currentTurnIndex];
                console.log(`[Queue] Actor: ${actor.name}`);

                if (actor.isPlayer) {
                    this.turnProcessing = false;
                    console.log("[Queue] Player turn, yielding.");
                    return;
                }

                // NPC Turn
                await new Promise(r => setTimeout(r, 100)); // AI Think
                this.state.combat.turnActions.push("Cat attacks!");
                const summary = "Cat attacks!";
                this.log(summary);
                this.state.lastNarrative = summary;
                await this.emitStateUpdate();
                this.state.combat.turnActions = [];

                // Advance (Manually inside loop?? No, backup calls advanceTurn)
                // In CombatOrchestrator.ts:
                // const nextMsg = this.combatManager.advanceTurn();
                // this.addCombatLog(nextMsg);

                const msg = this.combatManager.advanceTurn();
                this.log(msg);
                loopCount++;
            }
        } finally {
            this.turnProcessing = false;
            console.log(`[Queue] End.`);
        }
    }

    async advanceTurn() {
        console.log("[Advancing]");
        const msg = this.combatManager.advanceTurn();
        this.log(msg);
        await this.processCombatQueue();
    }

    async handleCombatAction(cmd) {
        if (cmd === 'end turn') {
            const summary = `Dam ends their turn.`;
            this.log(summary);
            this.state.lastNarrative = summary;
            await this.emitStateUpdate();

            await this.advanceTurn();
            return summary;
        }
    }
}

// Run
async function run() {
    const orch = new MockOrchestrator();
    console.log("--- Player Ends Turn ---");
    await orch.handleCombatAction('end turn');
    console.log("--- Done ---");
}

run();
