import { IntentRouter, ParsedIntent } from './IntentRouter';
import { GameStateManager, GameState } from './GameStateManager';
import { ContextManager } from '../agents/ContextManager';
import { MechanicsEngine } from './MechanicsEngine';
import { RestingEngine } from './RestingEngine';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

/**
 * The GameLoop is the central heart of the RPG engine.
 * It coordinates Intent, Logic, AI, and Persistence.
 */
export class GameLoop {
    private state: GameState;
    private stateManager: GameStateManager;
    private contextManager: ContextManager = new ContextManager();
    private inCombat: boolean = false;

    constructor(initialState: GameState) {
        this.state = initialState;
        this.stateManager = new GameStateManager(process.cwd());
    }

    /**
     * The primary entry point for player interaction.
     * @param input Raw text from the player
     */
    public async processTurn(input: string): Promise<string> {
        const intent = IntentRouter.parse(input, this.inCombat);
        let systemResponse = '';

        // 1. Logic Phase (Deterministic)
        if (intent.type === 'COMMAND') {
            systemResponse = this.handleCommand(intent);
        } else if (intent.type === 'COMBAT_ACTION') {
            systemResponse = 'Combat action logic not yet fully wired to loop.';
        }

        // 2. Agent Phase (Narrative)
        // In a real implementation, we'd call the LLM here using the ContextManager.
        // For now, we simulate the Narrator response.
        const narratorOutput = `[SIMULATED NARRATOR] You said: "${input}". 
        The world reacts to your ${intent.type.toLowerCase()}...`;

        // 3. State Update & Persistence Phase
        this.contextManager.addEvent('player', input);
        this.contextManager.addEvent('narrator', narratorOutput);
        this.stateManager.saveGame(this.state);

        return systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
    }

    /**
     * Handles technical system commands (/stats, /rest, etc.)
     */
    private handleCommand(intent: ParsedIntent): string {
        switch (intent.command) {
            case 'stats':
                return `Name: ${this.state.character.name} | HP: ${this.state.character.hp.current}/${this.state.character.hp.max} | Level: ${this.state.character.level}`;
            case 'rest':
                if (intent.args?.[0] === 'long') {
                    return RestingEngine.longRest(this.state.character);
                }
                return RestingEngine.shortRest(this.state.character);
            case 'save':
                this.stateManager.saveGame(this.state);
                return 'Game saved.';
            default:
                return `Unknown command: /${intent.command}`;
        }
    }

    public getState(): GameState {
        return this.state;
    }
}
