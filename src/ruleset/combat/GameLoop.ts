import { IntentRouter, ParsedIntent } from './IntentRouter';
import { GameStateManager, GameState } from './GameStateManager';
import { ContextManager } from '../agents/ContextManager';
import { MechanicsEngine } from './MechanicsEngine';
import { RestingEngine } from './RestingEngine';
import { HexMapManager } from './HexMapManager';
import { MovementEngine } from './MovementEngine';
import { HexDirection } from '../schemas/HexMapSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

/**
 * The GameLoop is the central heart of the RPG engine.
 * It coordinates Intent, Logic, AI, and Persistence.
 */
export class GameLoop {
    private state: GameState;
    private stateManager: GameStateManager;
    private contextManager: ContextManager = new ContextManager();
    private hexMapManager: HexMapManager;
    private movementEngine: MovementEngine;
    private inCombat: boolean = false;

    constructor(initialState: GameState, basePath: string = process.cwd()) {
        this.state = initialState;
        this.stateManager = new GameStateManager(basePath);
        this.hexMapManager = new HexMapManager(basePath);
        this.movementEngine = new MovementEngine(this.hexMapManager);

        // Initialize starting hex if it doesn't exist
        const startHexKey = this.state.location.hexId;
        if (!this.hexMapManager.getHex(startHexKey)) {
            this.hexMapManager.setHex({
                coordinates: this.state.location.coordinates,
                generated: true,
                visited: true,
                biome: 'Grassland',
                name: 'Starting Clearing',
                description: 'A calm meadow where your adventure begins.',
                interest_points: []
            });
        }
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
        const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
        const narratorContext = this.contextManager.getNarratorContext(this.state.character, currentHex || {});
        const narratorOutput = `[SIMULATED NARRATOR] You said: "${input}". 
        Location: ${currentHex?.name || 'Unknown'}. The world reacts to your ${intent.type.toLowerCase()}...`;

        // 3. State Update & Persistence Phase
        this.contextManager.addEvent('player', input);
        this.contextManager.addEvent('narrator', narratorOutput);
        this.stateManager.saveGame(this.state);

        return systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
    }

    /**
     * Handles technical system commands (/stats, /rest, /move, etc.)
     */
    private handleCommand(intent: ParsedIntent): string {
        switch (intent.command) {
            case 'stats':
                return `Name: ${this.state.character.name} | HP: ${this.state.character.hp.current}/${this.state.character.hp.max} | Level: ${this.state.character.level} | Location: ${this.state.location.hexId}`;
            case 'rest':
                if (intent.args?.[0] === 'long') {
                    return RestingEngine.longRest(this.state.character);
                }
                return RestingEngine.shortRest(this.state.character);
            case 'save':
                this.stateManager.saveGame(this.state);
                return 'Game saved.';
            case 'move':
                const direction = (intent.args?.[0]?.toUpperCase() || 'N') as HexDirection;
                const result = this.movementEngine.move(this.state.location.coordinates, direction);
                if (result.success && result.newHex) {
                    this.state.location.coordinates = result.newHex.coordinates;
                    this.state.location.hexId = `${result.newHex.coordinates[0]},${result.newHex.coordinates[1]}`;
                }
                return result.message;
            case 'look':
                const hex = this.hexMapManager.getHex(this.state.location.hexId);
                if (!hex) return 'You are in an unknown void.';
                return `[${hex.name || 'Unnamed Hex'}] (${hex.biome || 'Unknown Biome'})\n${hex.description || 'No description.'}`;
            default:
                return `Unknown command: /${intent.command}`;
        }
    }

    public getState(): GameState {
        return this.state;
    }
}
