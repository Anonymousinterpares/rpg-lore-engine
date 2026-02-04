import { IntentRouter } from './IntentRouter';
import { GameStateManager } from './GameStateManager';
import { ContextManager } from '../agents/ContextManager';
import { RestingEngine } from './RestingEngine';
import { HexMapManager } from './HexMapManager';
import { MovementEngine } from './MovementEngine';
import { WorldClockEngine } from './WorldClockEngine';
import { StoryScribe } from './StoryScribe';
import { EncounterDirector } from './EncounterDirector';
/**
 * The GameLoop is the central heart of the RPG engine.
 * It coordinates Intent, Logic, AI, and Persistence.
 */
export class GameLoop {
    state;
    stateManager;
    contextManager = new ContextManager();
    hexMapManager;
    movementEngine;
    scribe = new StoryScribe();
    director = new EncounterDirector();
    constructor(initialState, basePath, storage) {
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
    async processTurn(input) {
        const intent = IntentRouter.parse(input, this.state.mode === 'COMBAT');
        let systemResponse = '';
        // 1. Logic Phase (Deterministic)
        if (intent.type === 'COMMAND') {
            systemResponse = this.handleCommand(intent);
        }
        else if (intent.type === 'COMBAT_ACTION') {
            systemResponse = 'Combat action logic not yet fully wired to loop.';
        }
        // 2. Agent Phase (Narrative & Pacing)
        const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
        // Director check for encounter
        const encounter = this.director.checkEncounter(this.state, currentHex || {});
        if (encounter) {
            this.state.mode = 'COMBAT';
            systemResponse = `[ENCOUNTER] ${encounter.name}: ${encounter.description}`;
        }
        const narratorContext = this.contextManager.getNarratorContext(this.state.character, currentHex || {});
        const narratorOutput = `[SIMULATED NARRATOR] You said: "${input}". 
        Location: ${currentHex?.name || 'Unknown'}. The world reacts to your ${intent.type.toLowerCase()}...`;
        // 3. State Update & Persistence Phase
        this.contextManager.addEvent('player', input);
        this.contextManager.addEvent('narrator', narratorOutput);
        // Scribe processing (summarization)
        await this.scribe.processTurn(this.state, this.contextManager.getNarratorContext(this.state.character, {}).recentHistory);
        this.stateManager.saveGame(this.state);
        return systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
    }
    /**
     * Handles technical system commands (/stats, /rest, /move, etc.)
     */
    handleCommand(intent) {
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
                const direction = (intent.args?.[0]?.toUpperCase() || 'N');
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
                if (!hex)
                    return 'You are in an unknown void.';
                return `[${hex.name || 'Unnamed Hex'}] (${hex.biome || 'Unknown Biome'})\n${hex.description || 'No description.'}`;
            case 'attack':
                this.state.mode = 'COMBAT';
                return `[SYSTEM] Entering COMBAT mode! ${intent.args?.[0] || 'Target'} is being attacked.`;
            case 'exit':
                this.state.mode = 'EXPLORATION';
                return `[SYSTEM] Exiting current mode. Returning to EXPLORATION.`;
            default:
                return `Unknown command: /${intent.command}`;
        }
    }
    pickupItem(instanceId) {
        const char = this.state.character;
        const droppedItems = this.state.location.droppedItems || [];
        const itemIndex = droppedItems.findIndex(i => i.instanceId === instanceId);
        if (itemIndex === -1)
            return "Item not found on the ground.";
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
        }
        else {
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
    dropItem(instanceId) {
        const char = this.state.character;
        const itemIndex = char.inventory.items.findIndex(i => i.instanceId === instanceId);
        if (itemIndex === -1)
            return "Item not found in inventory.";
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
            if (char.equipmentSlots[slot] === instanceId) {
                char.equipmentSlots[slot] = undefined;
            }
        });
        this.stateManager.saveGame(this.state);
        return `Dropped ${item.name}.`;
    }
    equipItem(instanceId) {
        const char = this.state.character;
        const item = char.inventory.items.find(i => i.instanceId === instanceId);
        if (!item)
            return "Item not found.";
        if (item.equipped) {
            // Unequip
            item.equipped = false;
            Object.keys(char.equipmentSlots).forEach(slot => {
                if (char.equipmentSlots[slot] === instanceId) {
                    char.equipmentSlots[slot] = undefined;
                }
            });
            this.stateManager.saveGame(this.state);
            return `Unequipped ${item.name}.`;
        }
        else {
            // Equip
            const type = (item.type || '').toLowerCase();
            let slot = '';
            if (type.includes('weapon'))
                slot = 'mainHand';
            else if (type.includes('armor'))
                slot = 'armor';
            else if (type.includes('shield'))
                slot = 'offHand';
            if (!slot)
                return `${item.name} cannot be equipped.`;
            // Unequip current item in slot if any
            const currentInSlotId = char.equipmentSlots[slot];
            if (currentInSlotId) {
                const currentItem = char.inventory.items.find(i => i.instanceId === currentInSlotId);
                if (currentItem)
                    currentItem.equipped = false;
            }
            char.equipmentSlots[slot] = instanceId;
            item.equipped = true;
            // Recalculate AC if armor or shield
            if (slot === 'armor' || slot === 'offHand') {
                this.recalculateAC();
            }
            this.stateManager.saveGame(this.state);
            return `Equipped ${item.name}.`;
        }
    }
    markQuestAsRead(questId) {
        const quest = this.state.activeQuests?.find(q => q.id === questId);
        if (quest && quest.isNew) {
            quest.isNew = false;
            this.stateManager.saveGame(this.state);
        }
    }
    /**
     * Tracks tutorial-related events and updates quest progress.
     */
    trackTutorialEvent(eventId) {
        if (!this.state.triggeredEvents)
            this.state.triggeredEvents = [];
        if (this.state.triggeredEvents.includes(eventId))
            return;
        this.state.triggeredEvents.push(eventId);
        const tutorialQuest = this.state.activeQuests?.find(q => q.id === 'tutorial_01');
        if (!tutorialQuest)
            return;
        // 1. Master the Booklet (view pages)
        if (eventId.startsWith('viewed_page:')) {
            const tutorialPages = ['character', 'world_map', 'quests', 'equipment', 'codex'];
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_master_booklet');
            if (obj && !obj.isCompleted) {
                const viewedTutorialPages = this.state.triggeredEvents.filter(e => e.startsWith('viewed_page:') && tutorialPages.includes(e.split(':')[1]));
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
    recalculateAC() {
        const char = this.state.character;
        let baseAC = 10 + Math.floor(((char.stats.DEX || 10) - 10) / 2);
        // Add armor stats if we add AC to items later
        // For now, let's keep it simple
        this.state.character.ac = baseAC;
    }
    getState() {
        return this.state;
    }
}
