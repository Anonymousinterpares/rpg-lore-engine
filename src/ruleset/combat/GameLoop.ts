import { IntentRouter, ParsedIntent } from './IntentRouter';
import { GameStateManager, GameState } from './GameStateManager';
import { IStorageProvider } from './IStorageProvider';
import { ContextManager } from '../agents/ContextManager';
import { MechanicsEngine } from './MechanicsEngine';
import { RestingEngine } from './RestingEngine';
import { HexMapManager } from './HexMapManager';
import { MovementEngine } from './MovementEngine';
import { WorldClockEngine } from './WorldClockEngine';
import { HexDirection } from '../schemas/HexMapSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { StoryScribe } from './StoryScribe';
import { EncounterDirector } from './EncounterDirector';
import { FactionEngine } from './FactionEngine';
import { Dice } from './Dice';
import { DataManager } from '../data/DataManager';
import { Monster } from '../schemas/MonsterSchema';
import { Encounter } from './EncounterDirector';
import { CombatantSchema } from '../schemas/FullSaveStateSchema';
import { NarratorService } from '../agents/NarratorService';
import { NarratorOutput } from '../agents/ICPSchemas';
import { EngineDispatcher } from '../agents/EngineDispatcher';
import { DirectorService } from '../agents/DirectorService';
import { NPCService } from '../agents/NPCService';
import { z } from 'zod';

type Combatant = z.infer<typeof CombatantSchema>;

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
    private scribe: StoryScribe = new StoryScribe();
    private director: EncounterDirector = new EncounterDirector();

    constructor(initialState: GameState, basePath: string, storage?: IStorageProvider) {
        this.state = initialState;
        this.stateManager = new GameStateManager(basePath, storage);
        this.hexMapManager = new HexMapManager(basePath, 'world_01', storage);
        this.movementEngine = new MovementEngine(this.hexMapManager);

        // Initialize factions if empty
        if (!this.state.factions || this.state.factions.length === 0) {
            this.state.factions = [
                { id: 'commoners', name: 'Commoners', description: 'Ordinary folk of the realm.', standing: 0, isPlayerMember: false },
                { id: 'crown', name: 'The Crown', description: 'The royal authority.', standing: 10, isPlayerMember: false },
                { id: 'thieves', name: 'Shadow Guild', description: 'Underworld organization.', standing: -20, isPlayerMember: false }
            ];
        }

        // Initialize starting hex if it doesn't exist
        const startHexKey = this.state.location.hexId;
        if (!this.hexMapManager.getHex(startHexKey)) {
            this.hexMapManager.setHex({
                coordinates: this.state.location.coordinates,
                generated: true,
                visited: true,
                biome: 'Plains',
                name: 'Starting Clearing',
                description: 'A calm meadow where your adventure begins.',
                interest_points: [],
                resourceNodes: [],
                openedContainers: {},
                namingSource: 'engine',
                visualVariant: 1
            });
        }
    }

    /**
     * The primary entry point for player interaction.
     * @param input Raw text from the player
     */
    public async processTurn(input: string): Promise<string> {
        const intent = IntentRouter.parse(input, this.state.mode === 'COMBAT');
        let systemResponse = '';

        // 1. Logic Phase (Deterministic)
        if (intent.type === 'COMMAND') {
            systemResponse = this.handleCommand(intent);
        } else if (intent.type === 'COMBAT_ACTION') {
            systemResponse = this.handleCombatAction(intent);
        }

        // 2. Agent Phase (Narrative & Pacing)
        const currentHex = this.hexMapManager.getHex(this.state.location.hexId);

        // Director check for encounter
        const encounter = this.director.checkEncounter(this.state, currentHex || {});
        if (encounter) {
            this.initializeCombat(encounter);
            systemResponse = `[ENCOUNTER] ${encounter.name}: ${encounter.description}`;
        }

        // Director Pacing Check
        const directive = await DirectorService.evaluatePacing(this.state);

        const narratorResponse = await NarratorService.generate(
            this.state,
            this.hexMapManager,
            input,
            this.contextManager.getRecentHistory(10),
            directive
        );

        let narratorOutput = narratorResponse.narrative_output;

        // NPC Companion Chatter
        const chatter = await NPCService.generateChatter(this.state, this.contextManager.getNarratorContext(this.state, this.hexMapManager));
        if (chatter) {
            narratorOutput += `\n\n${chatter}`;
        }

        // 3. State Update & Persistence Phase
        const turn = this.state.worldTime.totalTurns;

        // Push to persistent conversation history in state
        this.state.conversationHistory.push({ role: 'player', content: input, turnNumber: turn });
        this.state.conversationHistory.push({ role: 'narrator', content: narratorOutput, turnNumber: turn });

        // Set ephemeral display field
        this.state.lastNarrative = narratorOutput;

        // Internal context manager history (for LLM context window)
        this.contextManager.addEvent('player', input);
        this.contextManager.addEvent('narrator', narratorOutput);

        // Execute narrator suggested effects
        this.applyNarratorEffects(narratorResponse);

        // Scribe processing (summarization)
        await this.scribe.processTurn(this.state, this.contextManager.getRecentHistory(10));

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
                const restResult = intent.args?.[0] === 'long'
                    ? RestingEngine.longRest(this.state.character)
                    : RestingEngine.shortRest(this.state.character);

                this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, restResult.timeCost);
                return restResult.message;
            case 'save':
                this.stateManager.saveGame(this.state);
                return 'Game saved.';
            case 'move':
                const char = this.state.character;
                const currentWeight = char.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
                const capacity = (char.stats.STR || 10) * 15;

                if (currentWeight > capacity) {
                    return "You are overencumbered and cannot move! Drop some items first.";
                }

                const direction = (intent.args?.[0]?.toUpperCase() || 'N') as HexDirection;
                const result = this.movementEngine.move(this.state.location.coordinates, direction);
                if (result.success && result.newHex) {
                    this.state.location.coordinates = result.newHex.coordinates;
                    this.state.location.hexId = `${result.newHex.coordinates[0]},${result.newHex.coordinates[1]}`;
                    this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, result.timeCost);
                    this.trackTutorialEvent('moved_hex');
                }
                return result.message;
            case 'look':
                const hex = this.hexMapManager.getHex(this.state.location.hexId);
                if (!hex) return 'You are in an unknown void.';
                return `[${hex.name || 'Unnamed Hex'}] (${hex.biome || 'Unknown Biome'})\n${hex.description || 'No description.'}`;
            case 'attack':
                const targetName = intent.args?.[0] || 'Unknown Foe';
                const manualEncounter: Encounter = {
                    name: `Assault on ${targetName}`,
                    description: `You initiate combat against ${targetName}!`,
                    monsters: ['Goblin'], // Placeholder for manual attack
                    difficulty: this.state.character.level
                };
                this.initializeCombat(manualEncounter);
                return `[SYSTEM] Entering COMBAT mode! ${manualEncounter.description}`;
            case 'exit':
                this.state.mode = 'EXPLORATION';
                this.state.combat = undefined;
                return `[SYSTEM] Exiting current mode. Returning to EXPLORATION.`;
            default:
                return `Unknown command: /${intent.command}`;
        }
    }

    public pickupItem(instanceId: string): string {
        const char = this.state.character;
        const droppedItems = this.state.location.droppedItems || [];
        const itemIndex = droppedItems.findIndex(i => i.instanceId === instanceId);

        if (itemIndex === -1) return "Item not found on the ground.";

        const item = droppedItems[itemIndex];

        // Weight check
        const currentWeight = char.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
        if (currentWeight + (item.weight * (item.quantity || 1)) > (char.stats.STR || 10) * 15) {
            return "You are carrying too much to pick this up.";
        }

        // Add to inventory (stack if possible, but for now just add)
        // Check if item already exists in inventory to stack
        const existingItem = char.inventory.items.find(i => i.id === item.id);
        if (existingItem && !['weapon', 'armor', 'shield'].some(t => item.type.toLowerCase().includes(t))) {
            existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
        } else {
            char.inventory.items.push({
                ...item,
                equipped: false
            });
        }

        // Remove from dropped items
        droppedItems.splice(itemIndex, 1);

        this.stateManager.saveGame(this.state);
        return `Picked up ${item.name}.`;
    }

    public dropItem(instanceId: string): string {
        const char = this.state.character;
        const itemIndex = char.inventory.items.findIndex(i => i.instanceId === instanceId);

        if (itemIndex === -1) return "Item not found in inventory.";

        const item = char.inventory.items[itemIndex];

        // Remove from inventory
        char.inventory.items.splice(itemIndex, 1);

        // Add to dropped items at current location
        if (!this.state.location.droppedItems) {
            this.state.location.droppedItems = [];
        }

        this.state.location.droppedItems.push({
            ...item,
            instanceId: item.instanceId || `${item.id}-${Date.now()}`
        });

        // If it was equipped, unequip it
        Object.keys(char.equipmentSlots).forEach(slot => {
            if ((char.equipmentSlots as any)[slot] === instanceId) {
                (char.equipmentSlots as any)[slot] = undefined;
            }
        });

        this.stateManager.saveGame(this.state);
        return `Dropped ${item.name}.`;
    }

    public equipItem(instanceId: string): string {
        const char = this.state.character;
        const item = char.inventory.items.find(i => i.instanceId === instanceId);

        if (!item) return "Item not found.";

        if (item.equipped) {
            // Unequip
            item.equipped = false;
            Object.keys(char.equipmentSlots).forEach(slot => {
                if ((char.equipmentSlots as any)[slot] === instanceId) {
                    (char.equipmentSlots as any)[slot] = undefined;
                }
            });
            this.stateManager.saveGame(this.state);
            return `Unequipped ${item.name}.`;
        } else {
            // Equip
            const type = (item.type || '').toLowerCase();
            let slot = '';

            if (type.includes('weapon')) slot = 'mainHand';
            else if (type.includes('armor')) slot = 'armor';
            else if (type.includes('shield')) slot = 'offHand';

            if (!slot) return `${item.name} cannot be equipped.`;

            // Unequip current item in slot if any
            const currentInSlotId = (char.equipmentSlots as any)[slot];
            if (currentInSlotId) {
                const currentItem = char.inventory.items.find(i => i.instanceId === currentInSlotId);
                if (currentItem) currentItem.equipped = false;
            }

            (char.equipmentSlots as any)[slot] = instanceId;
            item.equipped = true;

            // Recalculate AC if armor or shield
            if (slot === 'armor' || slot === 'offHand') {
                this.recalculateAC();
            }

            this.stateManager.saveGame(this.state);
            return `Equipped ${item.name}.`;
        }
    }

    public markQuestAsRead(questId: string) {
        const quest = this.state.activeQuests?.find(q => q.id === questId);
        if (quest && quest.isNew) {
            quest.isNew = false;
            this.stateManager.saveGame(this.state);
        }
    }

    /**
     * Tracks tutorial-related events and updates quest progress.
     */
    public trackTutorialEvent(eventId: string) {
        if (!this.state.triggeredEvents) this.state.triggeredEvents = [];
        if (this.state.triggeredEvents.includes(eventId)) return;

        this.state.triggeredEvents.push(eventId);

        const tutorialQuest = this.state.activeQuests?.find(q => q.id === 'tutorial_01');
        if (!tutorialQuest) return;

        // 1. Master the Booklet (view pages)
        if (eventId.startsWith('viewed_page:')) {
            const tutorialPages = ['character', 'world_map', 'quests', 'equipment', 'codex'];
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_master_booklet');
            if (obj && !obj.isCompleted) {
                const viewedTutorialPages = this.state.triggeredEvents.filter(e =>
                    e.startsWith('viewed_page:') && tutorialPages.includes(e.split(':')[1])
                );
                obj.currentProgress = viewedTutorialPages.length;
                if (obj.currentProgress >= obj.maxProgress) {
                    obj.isCompleted = true;
                }
            }
        }

        // 2. Study Your Gear (examine item)
        if (eventId.startsWith('examined_item:')) {
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_study_gear');
            if (obj && !obj.isCompleted) {
                obj.currentProgress = 1;
                obj.isCompleted = true;
            }
        }

        // 3. Begin the Journey (move hex)
        if (eventId === 'moved_hex') {
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_begin_journey');
            if (obj && !obj.isCompleted) {
                obj.currentProgress = 1;
                obj.isCompleted = true;
            }
        }

        this.stateManager.saveGame(this.state);
    }

    private initializeCombat(encounter: Encounter) {
        this.state.mode = 'COMBAT';
        const combatants: Combatant[] = [];

        // 1. Add Player
        const playerInit = Dice.d20() + MechanicsEngine.getModifier(this.state.character.stats.DEX || 10);
        combatants.push({
            id: 'player',
            name: this.state.character.name,
            hp: { current: this.state.character.hp.current, max: this.state.character.hp.max },
            initiative: playerInit,
            isPlayer: true,
            type: 'player'
        });

        // 2. Add Enemies
        encounter.monsters.forEach((monsterName, index) => {
            // Ideally we get stats from DataManager, but for now placeholders
            const initRoll = Dice.d20() + 1; // Generic bonus for now
            combatants.push({
                id: `enemy_${index}`,
                name: monsterName,
                hp: { current: 15, max: 15 },
                initiative: initRoll,
                isPlayer: false,
                type: 'enemy'
            });
        });

        // 3. Sort by initiative
        combatants.sort((a, b) => b.initiative - a.initiative);

        this.state.combat = {
            round: 1,
            currentTurnIndex: 0,
            combatants: combatants,
            logs: [{
                id: `log-${Date.now()}`,
                type: 'info',
                message: `Combat started! ${combatants[0].name} takes the first turn.`,
                turn: 0
            }]
        };
    }

    private handleCombatAction(intent: ParsedIntent): string {
        if (!this.state.combat) return "Not in combat.";

        const currentCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];
        let message = '';

        if (intent.command === 'attack') {
            message = `${currentCombatant.name} attacks! (Logic pending)`;
        } else if (intent.command === 'dodge') {
            message = `${currentCombatant.name} is dodging.`;
        }

        this.state.combat.logs.push({
            id: `log-${Date.now()}`,
            type: 'info',
            message: message,
            turn: this.state.combat.round
        });

        this.advanceCombatTurn();
        return message;
    }

    private advanceCombatTurn() {
        if (!this.state.combat) return;

        this.state.combat.currentTurnIndex++;
        if (this.state.combat.currentTurnIndex >= this.state.combat.combatants.length) {
            this.state.combat.currentTurnIndex = 0;
            this.state.combat.round++;
        }

        const nextCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];
        this.state.combat.logs.push({
            id: `log-${Date.now()}`,
            type: 'info',
            message: `Next turn: ${nextCombatant.name}`,
            turn: this.state.combat.round
        });
    }

    private recalculateAC() {
        const char = this.state.character;
        let baseAC = 10 + Math.floor(((char.stats.DEX || 10) - 10) / 2);

        // Add armor stats if we add AC to items later
        // For now, let's keep it simple
        this.state.character.ac = baseAC;
    }

    public getState(): GameState {
        return this.state;
    }

    public loadSession(saveId: string): boolean {
        const loaded = this.stateManager.loadGame(saveId);
        if (loaded) {
            this.state = loaded;
            NarratorService.setFirstTurnAfterLoad(true);
            return true;
        }
        return false;
    }

    private applyNarratorEffects(output: NarratorOutput) {
        EngineDispatcher.dispatch(
            output.engine_calls || [],
            this.state,
            this.hexMapManager,
            {
                combatInitializer: (enc: Encounter) => this.initializeCombat(enc),
                worldClock: { advanceTime: (s: any, h: number) => { this.state.worldTime.hour += h; } } // Example shim
            }
        );
    }
}
