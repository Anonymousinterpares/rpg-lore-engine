import { IntentRouter, ParsedIntent } from './IntentRouter';
import { AbilityParser } from './AbilityParser';
import { GameStateManager, GameState } from './GameStateManager';
import { IStorageProvider } from './IStorageProvider';
import { Spell } from '../schemas/SpellSchema';
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
import { LoreService } from '../agents/LoreService';
import { CombatResolutionEngine } from './CombatResolutionEngine';
import { CombatAI } from './CombatAI';
import { CombatLogFormatter } from './CombatLogFormatter';
import { WeatherEngine } from './WeatherEngine';
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

    private turnProcessing: boolean = false;
    private listeners: ((state: GameState) => void)[] = [];

    constructor(initialState: GameState, basePath: string, storage?: IStorageProvider) {
        this.state = initialState;
        this.stateManager = new GameStateManager(basePath, storage);
        this.hexMapManager = new HexMapManager(basePath, 'world_01', storage);
        this.movementEngine = new MovementEngine(this.hexMapManager);

        // Save initial combat state to UI
        this.emitStateUpdate();

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
     * Subscribe to state changes.
     * @param listener Callback function
     * @returns Unsubscribe function
     */
    public subscribe(listener: (state: GameState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Internal helper to notify all subscribers of a state change.
     */
    private notifyListeners() {
        // We pass a shallow clone of the state to avoid direct mutation issues in React
        const stateClone = { ...this.state };
        this.listeners.forEach(listener => listener(stateClone));
    }

    /**
     * Centralized method to save state and notify the UI.
     */
    private emitStateUpdate() {
        this.stateManager.saveGame(this.state);
        this.notifyListeners();
    }

    public getStateManager() {
        return this.stateManager;
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
        } else if (intent.type === 'COMBAT_ACTION' && this.state.mode === 'COMBAT') {
            systemResponse = this.handleCombatAction(intent);
        }

        // If we are in combat, we skip the immediate Narrator generation to avoid latency
        if (this.state.mode === 'COMBAT') {
            this.emitStateUpdate();
            return systemResponse;
        }

        // 2. Agent Phase (Narrative & Pacing - Exploration Mode only)
        const currentHex = this.hexMapManager.getHex(this.state.location.hexId);

        // Director check for encounter
        const encounter = this.director.checkEncounter(this.state, currentHex || {});
        if (encounter) {
            await this.initializeCombat(encounter);
            systemResponse = `[ENCOUNTER] ${encounter.name}: ${encounter.description}`;
        }

        // Director Pacing Check
        const directive = await DirectorService.evaluatePacing(this.state);

        const narratorResponse = await NarratorService.generate(
            this.state,
            this.hexMapManager,
            input,
            this.contextManager.getRecentHistory(10),
            directive,
            encounter || undefined
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

        // Advance World Time (5 minutes per narrative turn) with interval processing
        if (this.state.mode === 'EXPLORATION' && !encounter) {
            await this.advanceTimeAndProcess(5);
        }

        // Scribe processing (summarization)
        await this.scribe.processTurn(this.state, this.contextManager.getRecentHistory(10));

        this.emitStateUpdate();

        return systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
    }

    /**
     * Centralized time advancement that processes intervals (Encounters, Weather)
     */
    private async advanceTimeAndProcess(totalMinutes: number, isResting: boolean = false): Promise<Encounter | null> {
        let remainingMinutes = totalMinutes;
        const INTERVAL = 30; // Check every 30 minutes
        let resultEncounter: Encounter | null = null;

        while (remainingMinutes > 0) {
            const step = Math.min(remainingMinutes, INTERVAL);

            // Advance clock state
            this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, step);
            remainingMinutes -= step;

            // Updated Weather logic
            if (this.state.weather.durationMinutes > 0) {
                this.state.weather.durationMinutes -= step;
            }
            if (this.state.weather.durationMinutes <= 0) {
                this.state.weather = WeatherEngine.generateWeather(this.state.worldTime);
            }

            // Encounter check every interval (if exploration)
            if (this.state.mode === 'EXPLORATION' && !resultEncounter) {
                const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
                const encounter = this.director.checkEncounter(this.state, currentHex || {});
                if (encounter) {
                    resultEncounter = encounter;
                    // Note: If encounter found, we stop the time advancement loop? 
                    // Usually yes, you get jumped during your activity.
                    break;
                }
            }
        }

        return resultEncounter;
    }

    /**
     * Handles technical system commands (/stats, /rest, /move, etc.)
     */
    private handleCommand(intent: ParsedIntent): string {
        switch (intent.command) {
            case 'stats':
                return `Name: ${this.state.character.name} | HP: ${this.state.character.hp.current}/${this.state.character.hp.max} | Level: ${this.state.character.level} | Location: ${this.state.location.hexId}`;
            case 'rest':
                const isLong = intent.args?.[0] === 'long';
                const restResult = isLong
                    ? RestingEngine.longRest(this.state.character)
                    : RestingEngine.shortRest(this.state.character);

                // Special handling for Ambush during rest
                this.advanceTimeAndProcess(restResult.timeCost, true).then(encounter => {
                    if (encounter) {
                        this.initializeCombat(encounter);
                        // We'd need a way to notify the UI about the ambush here
                    }
                });
                return restResult.message;
            case 'wait':
                const waitMins = parseInt(intent.args?.[0] || '60', 10);
                const waitResult = RestingEngine.wait(waitMins);
                this.advanceTimeAndProcess(waitResult.timeCost, false).then(encounter => {
                    if (encounter) this.initializeCombat(encounter);
                });
                return waitResult.message;
            case 'save':
                this.emitStateUpdate();
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
                    this.advanceTimeAndProcess(result.timeCost);
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
                    monsters: [targetName],
                    difficulty: this.state.character.level,
                    xpAward: 50
                };
                this.initializeCombat(manualEncounter);
                return `[SYSTEM] Entering COMBAT mode! ${manualEncounter.description}`;
            case 'combat':
                const entityType = intent.args?.[0] || 'Goblin';
                const count = parseInt(intent.args?.[1] || '1', 10) || 1;
                const devEncounter: Encounter = {
                    name: `Dev Combat: ${entityType} x${count}`,
                    description: `Manually triggered combat with ${count} ${entityType}(s).`,
                    monsters: Array(count).fill(entityType),
                    difficulty: this.state.character.level,
                    xpAward: 0
                };
                this.initializeCombat(devEncounter);
                return `[SYSTEM] Spawning ${count} ${entityType}(s) for combat.`;
            case 'target':
                if (this.state.combat && intent.args?.[0]) {
                    const targetId = intent.args[0];
                    const exists = this.state.combat.combatants.some(c => c.id === targetId);
                    if (exists) {
                        this.state.combat.selectedTargetId = targetId;
                        return ''; // Silent success
                    }
                }
                return 'Invalid target.';
                return `[SYSTEM] Exiting current mode. Returning to EXPLORATION.`;
            case 'use':
                return this.useAbility(intent.args?.join(' ') || '');
            case 'cast':
                const spellName = intent.args?.join(' ') || '';
                return this.castSpell(spellName);
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

        this.emitStateUpdate();
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

        this.emitStateUpdate();
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
            this.emitStateUpdate();
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

            this.emitStateUpdate();
            return `Equipped ${item.name}.`;
        }
    }

    public markQuestAsRead(questId: string) {
        const quest = this.state.activeQuests?.find(q => q.id === questId);
        if (quest && quest.isNew) {
            quest.isNew = false;
            this.emitStateUpdate();
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

        this.emitStateUpdate();
    }

    private async initializeCombat(encounter: Encounter) {
        this.state.mode = 'COMBAT';
        const combatants: Combatant[] = [];

        // 1. Add Player
        const pc = this.state.character;
        const playerInit = Dice.d20() + MechanicsEngine.getModifier(pc.stats.DEX || 10);
        combatants.push({
            id: 'player',
            name: pc.name,
            hp: { current: pc.hp.current, max: pc.hp.max },
            initiative: playerInit,
            isPlayer: true,
            type: 'player',
            ac: pc.ac || 10,
            stats: pc.stats as Record<string, number>,
            conditions: [],
            statusEffects: [],
            spellSlots: pc.spellSlots,
            isConcentrating: false,
            hasUsedAction: false,
            hasUsedBonusAction: false,
            hasMoved: false
        });

        // 2. Add Enemies
        await DataManager.loadMonsters(); // Ensure monsters are loaded
        for (let i = 0; i < encounter.monsters.length; i++) {
            const monsterName = encounter.monsters[i];
            const monsterData = DataManager.getMonster(monsterName);

            LoreService.registerMonsterEncounter(monsterName, this.state, () => this.emitStateUpdate());

            const initRoll = Dice.d20() + (monsterData ? MechanicsEngine.getModifier(monsterData.stats['DEX'] || 10) : 0);
            combatants.push({
                id: `enemy_${i}`,
                name: monsterName,
                hp: monsterData ? { current: monsterData.hp.average, max: monsterData.hp.average } : { current: 15, max: 15 },
                initiative: initRoll,
                isPlayer: false,
                type: 'enemy',
                ac: monsterData?.ac || 10,
                stats: (monsterData?.stats || { 'INT': 10, 'STR': 10, 'DEX': 10, 'CON': 10, 'WIS': 10, 'CHA': 10 }) as Record<string, number>,
                conditions: [],
                statusEffects: [],
                spellSlots: {},
                isConcentrating: false,
                hasUsedAction: false,
                hasUsedBonusAction: false,
                hasMoved: false
            });
        }

        // 3. Sort by initiative
        combatants.sort((a, b) => b.initiative - a.initiative);

        this.state.combat = {
            round: 1,
            currentTurnIndex: -1, // Start before the first turn
            combatants: combatants,
            logs: [{
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                type: 'info',
                message: `Combat started!`,
                turn: 0
            }],
            selectedTargetId: undefined,
            lastRoll: undefined,
            events: []
        };

        // Transition to the first turn
        await this.advanceCombatTurn();
    }

    private handleCombatAction(intent: ParsedIntent): string {
        if (!this.state.combat) return "Not in combat.";

        const currentCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];
        let resultMsg = '';

        // Action Economy Check
        const nonActionCommands = ['target', 'end turn'];
        if (currentCombatant.hasUsedAction && !nonActionCommands.includes(intent.command || '')) {
            return `You have already used your main action this turn. Use "End Turn" or a bonus action if available.`;
        }

        if (intent.command === 'attack') {
            const combatState = this.state.combat;
            const targets = combatState.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
            if (targets.length === 0) return "No valid targets.";

            // Use selected target if valid, otherwise default to first
            let target = targets.find(t => t.id === combatState.selectedTargetId);
            if (!target) target = targets[0];

            const pc = this.state.character;
            const strMod = MechanicsEngine.getModifier(pc.stats.STR || 10);
            const prof = MechanicsEngine.getProficiencyBonus(pc.level);

            const result = CombatResolutionEngine.resolveAttack(
                currentCombatant,
                target,
                strMod + prof,
                "1d8", // Placeholder weapon dice
                strMod
            );

            // Record roll and emit event
            combatState.lastRoll = (result.details?.roll || 0) + (result.details?.modifier || 0);
            this.emitCombatEvent(result.type, target.id, result.damage || 0);

            this.applyCombatDamage(target, result.damage);
            resultMsg = CombatLogFormatter.format(result, currentCombatant.name, target.name);

        } else if (intent.command === 'dodge') {
            currentCombatant.statusEffects.push({
                id: 'dodge',
                name: 'Dodge',
                type: 'BUFF',
                duration: 1,
                sourceId: currentCombatant.id
            });
            resultMsg = `${currentCombatant.name} takes a defensive stance. Attacks against them will have disadvantage until the start of their next turn.`;
        } else if (intent.command === 'dash') {
            resultMsg = `${currentCombatant.name} dashes, doubling their movement speed for this turn.`;
        } else if (intent.command === 'disengage') {
            currentCombatant.statusEffects.push({
                id: 'disengage',
                name: 'Disengage',
                type: 'BUFF',
                duration: 1,
                sourceId: currentCombatant.id
            });
            resultMsg = `${currentCombatant.name} focuses on defense while moving, preventing opportunity attacks.`;
        } else if (intent.command === 'hide') {
            const d20 = Dice.d20();
            const stealth = d20 + MechanicsEngine.getModifier(currentCombatant.stats.DEX || 10);
            resultMsg = `${currentCombatant.name} attempts to hide! (Roll: ${stealth})`;
        } else if (intent.command === 'use') {
            const abilityName = intent.args?.[0] || intent.originalInput.replace(/^use /i, '').trim();
            resultMsg = this.useAbility(abilityName);
        } else if (intent.command === 'end turn') {
            // Only players explicitly end turn via command. AI handles it internally.
            if (!currentCombatant.isPlayer) return "";
            resultMsg = `${currentCombatant.name} ends their turn.`;
        }

        this.addCombatLog(resultMsg);

        // Consuming action if it was an action command
        if (resultMsg && !nonActionCommands.includes(intent.command || '')) {
            currentCombatant.hasUsedAction = true;
        }

        // After player action, we don't advance the turn immediately if the action 
        // didn't explicitly end the turn. The player might still want to move or use bonus action.
        if (intent.command === 'end turn') {
            this.advanceCombatTurn();
        } else {
            this.emitStateUpdate();
        }

        return resultMsg;
    }

    /**
     * Public API for UI to trigger spellcasting. 
     * Bypasses the intent router / chat command logic.
     */
    public castSpell(spellName: string, targetId?: string): string {
        const combat = this.state.combat;
        if (this.state.mode === 'COMBAT' && combat) {
            const currentCombatant = combat.combatants[combat.currentTurnIndex];
            if (!currentCombatant.isPlayer) return "It is not your turn.";
            if (currentCombatant.hasUsedAction) return "You have already used your action this turn.";
            if (this.turnProcessing) return "Turn is already ending...";

            // Set target if provided
            if (targetId) combat.selectedTargetId = targetId;

            const result = this.handleCast(currentCombatant, spellName);
            this.addCombatLog(result);
            currentCombatant.hasUsedAction = true;
            this.emitStateUpdate();
            return result;
        } else {
            return this.handleExplorationCast(spellName);
        }
    }

    private handleCast(caster: Combatant, spellName: string): string {
        const spell = DataManager.getSpell(spellName);
        if (!spell) return `Unknown spell: ${spellName}`;

        const pc = this.state.character;

        // 1. Check Spell Slots (if not a cantrip)
        if (spell.level > 0) {
            const slotData = pc.spellSlots[spell.level.toString()];
            if (!slotData || slotData.current <= 0) {
                return `You have no ${spell.level}${this.getOrdinal(spell.level)} level spell slots remaining!`;
            }
        }

        // 2. Determine Targets
        let targets: Combatant[] = [];
        const combo = this.state.combat!;
        const effect = spell.effect;

        if (effect?.targets?.type === 'ENEMY' || spell.damage) {
            const potentialTargets = combo.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
            if (effect?.targets?.count === 'ALL_IN_AREA') {
                targets = potentialTargets;
            } else {
                let target = potentialTargets.find(t => t.id === combo.selectedTargetId);
                if (!target) target = potentialTargets[0];
                if (target) targets = [target];
            }
        } else if (effect?.targets?.type === 'ALLY' || effect?.category === 'HEAL' || effect?.category === 'BUFF') {
            const potentialTargets = combo.combatants.filter(c => (c.type === 'player' || c.type === 'companion') && c.hp.current > 0);
            if (effect?.targets?.count === 'ALL_IN_AREA') {
                targets = potentialTargets;
            } else {
                targets = [caster]; // Default to self for heals/buffs if no target logic
            }
        } else {
            targets = [caster];
        }

        if (targets.length === 0 && effect?.category !== 'SUMMON') return "No valid targets for this spell.";

        // 3. Resolve Spell for each target
        let fullMessage = `${caster.name} casts ${spell.name}! `;
        const spellAttackBonus = MechanicsEngine.getModifier(caster.stats['INT'] || caster.stats['WIS'] || caster.stats['CHA'] || 10) + MechanicsEngine.getProficiencyBonus(pc.level);
        const spellSaveDC = 8 + spellAttackBonus;

        for (const target of targets) {
            const result = CombatResolutionEngine.resolveSpell(caster, target, spell, spellAttackBonus, spellSaveDC);

            if (result.damage > 0) {
                this.applyCombatDamage(target, result.damage);
                this.emitCombatEvent(result.type, target.id, result.damage);
            }
            if (result.heal > 0) {
                CombatResolutionEngine.applyHealing(target, result.heal);
                this.emitCombatEvent('HEAL', target.id, result.heal);
            }

            // Apply Conditions/Effects
            if (result.type !== 'MISS' && result.type !== 'SAVE_SUCCESS') {
                if (spell.effect?.category === 'CONTROL' && spell.condition) {
                    target.conditions.push({
                        id: spell.condition.toLowerCase(),
                        name: spell.condition,
                        description: `Affected by ${spell.name}`,
                        duration: spell.effect.duration?.unit === 'ROUND' ? spell.effect.duration.value : 10,
                        sourceId: caster.id
                    });
                }
                if (spell.effect?.category === 'BUFF' || spell.effect?.category === 'DEBUFF') {
                    target.statusEffects.push({
                        id: spell.name.toLowerCase().replace(/ /g, '_'),
                        name: spell.name,
                        type: spell.effect.category as 'BUFF' | 'DEBUFF',
                        duration: spell.effect.duration?.unit === 'ROUND' ? spell.effect.duration.value : 10,
                        sourceId: caster.id
                    });
                }
            }

            fullMessage += result.message + " ";
        }

        // 4. Handle Summoning
        if (spell.effect?.category === 'SUMMON') {
            this.executeSummon(caster, spell);
            fullMessage += `Allies have arrived!`;
        }

        // 5. Handle Concentration
        if (spell.concentration || spell.effect?.timing === 'CONCENTRATION') {
            if (caster.isConcentrating && caster.concentratingOn) {
                fullMessage += ` (Ends concentration on ${caster.concentratingOn})`;
                this.breakConcentration(caster);
            }
            caster.isConcentrating = true;
            caster.concentratingOn = spell.name;
        }

        // 6. Consume Slot
        if (spell.level > 0) {
            pc.spellSlots[spell.level.toString()].current--;
        }

        return fullMessage;
    }

    private breakConcentration(caster: Combatant) {
        caster.isConcentrating = false;
        const spellName = caster.concentratingOn;
        caster.concentratingOn = undefined;

        if (!this.state.combat) return;

        // Remove all combatants summoned by this caster for this spell
        // Note: In D&D 5e, concentration breaking usually ends the summon.
        this.state.combat.combatants = this.state.combat.combatants.filter(c => {
            if (c.type === 'summon' && c.sourceId === caster.id) {
                this.addCombatLog(`${c.name} vanishes as ${caster.name} loses concentration on ${spellName}.`);
                return false;
            }
            return true;
        });

        // Re-calculate turn index if combatants were removed
        const currentIndex = this.state.combat.currentTurnIndex;
        // This is a bit complex, but for now we'll just sort and hope turn index logic in advanceCombatTurn handles it.
        this.state.combat.combatants.sort((a, b) => b.initiative - a.initiative);
    }

    private async executeSummon(caster: Combatant, spell: Spell, optionIndex: number = 0) {
        if (!this.state.combat) return;

        const option = spell.summon?.options?.[optionIndex] || spell.summon?.options?.[0] || { count: 1, maxCR: 0.25, type: 'beast' };

        // 1. Roll for count if it's a dice formula
        let count = 1;
        if (typeof option.count === 'string') {
            count = Dice.roll(option.count);
        } else {
            count = option.count;
        }

        await DataManager.loadMonsters();

        // 2. Select a monster based on CR and Type
        // Improvement: Try to find monsters matching the requested type
        const biome = this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'Plains';
        const availableMonsters = DataManager.getMonstersByBiome(biome).filter(m => m.cr <= option.maxCR);

        // In a real scenario, we might want to filter m.type === option.type, 
        // but for now we'll pick the most appropriate one from the biome.
        const monsterId = availableMonsters.length > 0 ? availableMonsters[0].id : 'Wolf';
        const monsterData = DataManager.getMonster(monsterId);

        // 3. Roll Shared Initiative
        const dexMod = monsterData ? MechanicsEngine.getModifier(monsterData.stats['DEX'] || 10) : 0;
        const sharedInit = Dice.d20() + dexMod;

        const newSummons: Combatant[] = [];

        for (let i = 0; i < count; i++) {
            const summon: Combatant = {
                id: `summon_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                name: `${monsterData?.name || monsterId} (Summoned)`,
                hp: monsterData ? { current: monsterData.hp.average, max: monsterData.hp.average } : { current: 10, max: 10 },
                initiative: sharedInit,
                isPlayer: false, // ALLY NPC, not directly controlled by player UI
                type: 'summon',
                ac: monsterData?.ac || 12,
                stats: (monsterData?.stats || { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10 }) as Record<string, number>,
                conditions: [],
                statusEffects: [],
                spellSlots: {},
                sourceId: caster.id,
                isConcentrating: false,
                hasUsedAction: false,
                hasUsedBonusAction: false,
                hasMoved: false
            };
            newSummons.push(summon);
            this.state.combat.combatants.push(summon);
        }

        // 4. Re-sort initiative and preserve round order
        this.state.combat.combatants.sort((a, b) => b.initiative - a.initiative);

        // Ensure turn index is still valid (it might have shifted)
        const currentCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];
        if (currentCombatant?.id !== caster.id) {
            // Find the caster again to keep the turn index synchronized
            this.state.combat.currentTurnIndex = this.state.combat.combatants.findIndex(c => c.id === caster.id);
        }
    }

    private getOrdinal(n: number): string {
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }

    private handleExplorationCast(spellName: string): string {
        const spell = DataManager.getSpell(spellName);
        if (!spell) return `Unknown spell: ${spellName}`;

        const pc = this.state.character;

        // 1. Check Spell Slots
        if (spell.level > 0) {
            const slotData = pc.spellSlots[spell.level.toString()];
            if (!slotData || slotData.current <= 0) {
                return `You have no ${spell.level}${this.getOrdinal(spell.level)} level spell slots remaining!`;
            }
        }

        // 2. Resolve Effect
        const category = spell.effect?.category || 'UTILITY';

        if (category === 'HEAL') {
            const heal = Dice.roll(spell.damage?.dice || '1d8') + MechanicsEngine.getModifier(pc.stats['WIS'] || pc.stats['CHA'] || pc.stats['INT'] || 10);
            pc.hp.current = Math.min(pc.hp.max, pc.hp.current + heal);
            if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;
            return `You cast ${spell.name}, healing ${heal} HP. Current HP: ${pc.hp.current}/${pc.hp.max}`;
        }

        if (category === 'SUMMON') {
            // Out of combat summon adds a companion to state.companions for 1 hour
            // This is a simplified version for now
            return `You cast ${spell.name}. A companion arrives and will aid you in the coming struggles.`;
        }

        return `You cast ${spell.name}, but its primary effects are best seen in the heat of battle.`;
    }

    private applyCombatDamage(target: Combatant, damage: number) {
        if (damage <= 0) return;

        CombatResolutionEngine.applyDamage(target, damage);

        // Concentration Check
        if (target.isConcentrating && target.hp.current > 0) {
            const dc = Math.max(10, Math.floor(damage / 2));
            const conMod = MechanicsEngine.getModifier(target.stats['CON'] || 10);
            const roll = Dice.d20();
            const total = roll + conMod;

            if (total < dc) {
                this.addCombatLog(`${target.name} fails a CON save (rolled ${total} vs DC ${dc}) and loses concentration!`);
                this.breakConcentration(target);
            } else {
                this.addCombatLog(`${target.name} maintains concentration (rolled ${total} vs DC ${dc}).`);
            }
        }
    }

    private async advanceCombatTurn() {
        if (!this.state.combat || this.turnProcessing) return;

        // Loop to find next VALID (alive) combatant
        let validNextFound = false;
        let loops = 0;

        while (!validNextFound && loops < 50) { // Safety break
            this.state.combat.currentTurnIndex++;
            if (this.state.combat.currentTurnIndex >= this.state.combat.combatants.length) {
                this.state.combat.currentTurnIndex = 0;
                this.state.combat.round++;
            }

            const check = this.state.combat.combatants[this.state.combat.currentTurnIndex];
            if (check && check.hp.current > 0) {
                validNextFound = true;
            }
            loops++;
        }

        // Trigger the Central Orchestrator Queue
        await this.processCombatQueue();
    }

    /**
     * The Central Combat Orchestrator.
     * Sequentially processes turns until it reaches the Player's turn.
     */
    private async processCombatQueue() {
        if (!this.state.combat || this.turnProcessing) return;

        this.turnProcessing = true;

        try {
            while (this.state.combat && !this.checkCombatEnd()) {
                const actor = this.state.combat.combatants[this.state.combat.currentTurnIndex];

                // --- 1. Reset Turn Economy ---
                actor.hasUsedAction = false;
                actor.hasUsedBonusAction = false;
                actor.hasMoved = false;

                // --- 2. Determine Banner Type ---
                let bannerType: 'PLAYER' | 'ENEMY' | 'NAME' = 'PLAYER';
                if (actor.type === 'enemy') bannerType = 'ENEMY';
                else if (actor.type === 'companion' || actor.type === 'summon') bannerType = 'NAME'; // Use Name banner for allies

                this.state.combat.activeBanner = {
                    type: bannerType,
                    text: bannerType === 'NAME' ? `${actor.name.toUpperCase()} TURN` : undefined,
                    visible: true
                };

                // Tick effects
                this.processStartOfTurn(actor);
                this.emitStateUpdate();

                // --- 3. Handle Control Flow ---
                if (actor.isPlayer) {
                    // Control handed back to player. Exit loop and unlock UI.
                    this.turnProcessing = false;
                    return;
                } else {
                    // AI Turn (Enemy, Companion, or Summon)
                    // Wait for Banner
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Execute AI Logic
                    await this.performAITurn(actor);

                    // Pacing delay after action
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Move to NEXT in loop
                    if (!this.state.combat) break;

                    let validNextFound = false;
                    let loops = 0;
                    while (!validNextFound && loops < 50) {
                        this.state.combat.currentTurnIndex++;
                        if (this.state.combat.currentTurnIndex >= this.state.combat.combatants.length) {
                            this.state.combat.currentTurnIndex = 0;
                            this.state.combat.round++;
                        }
                        const check = this.state.combat.combatants[this.state.combat.currentTurnIndex];
                        if (check && check.hp.current > 0) validNextFound = true;
                        loops++;
                    }
                }
            }
        } catch (error) {
            console.error("Critical Error in processCombatQueue:", error);
        } finally {
            this.turnProcessing = false;
        }
    }

    private processStartOfTurn(actor: Combatant) {
        // Tick down status effects
        if (actor.statusEffects) {
            actor.statusEffects = actor.statusEffects.filter(effect => {
                if (effect.duration !== undefined) {
                    effect.duration--;
                    return effect.duration > 0;
                }
                return true;
            });
        }

        // Tick down conditions
        if (actor.conditions) {
            actor.conditions = actor.conditions.filter(condition => {
                if (condition.duration !== undefined) {
                    condition.duration--;
                    return condition.duration > 0;
                }
                return true;
            });
        }
    }

    private async performAITurn(actor: Combatant) {
        if (!this.state.combat) return;

        // 1. Visual feedback: Secondary banner for specific action?
        // We'll skip secondary banner for now for speed, or just use the Name banner already up.

        // 2. Decide Action
        const action = CombatAI.decideAction(actor, this.state.combat);
        const pcCombatant = this.state.combat.combatants.find(c => c.isPlayer);

        if (action.type === 'ATTACK' && action.targetId) {
            const target = this.state.combat.combatants.find(c => c.id === action.targetId);
            if (!target) return;

            const strMod = MechanicsEngine.getModifier(actor.stats['STR'] || 10);
            const result = CombatResolutionEngine.resolveAttack(
                actor,
                target,
                strMod + 2, // Generic monster bonus
                "1d6", // Generic damage
                strMod
            );

            // Record roll and emit event
            this.state.combat.lastRoll = (result.details?.roll || 0) + (result.details?.modifier || 0);
            this.emitCombatEvent(result.type, target.id, result.damage || 0);

            this.applyCombatDamage(target, result.damage);

            // Sync PC state if player was hit
            if (target.isPlayer) {
                this.state.character.hp.current = target.hp.current;
            }

            const logMsg = CombatLogFormatter.format(result, actor.name, target.name);
            this.addCombatLog(logMsg);
        } else {
            // Fallback for other actions
            this.addCombatLog(`${actor.name} waits for an opening.`);
        }

        this.emitStateUpdate();
    }

    public useAbility(abilityName: string): string {
        const char = this.state.character;
        const ability = AbilityParser.getCombatAbilities(char).find(a => a.name.toLowerCase() === abilityName.toLowerCase());

        if (!ability) return `You don't have an ability named "${abilityName}".`;

        const combat = this.state.combat;
        const currentCombatant = combat?.combatants[combat.currentTurnIndex];

        // Action Economy Check
        if (currentCombatant && ability.actionCost === 'ACTION' && currentCombatant.hasUsedAction) {
            return "You have already used your action this turn.";
        }

        // Check usage
        const usage = this.state.character.featureUsages?.[ability.name];
        if (usage && usage.current <= 0) {
            return `You have no more uses of "${ability.name}" left until you ${usage.usageType === 'LONG_REST' ? 'take a long rest' : 'rest'}.`;
        }

        let result = `You use ${ability.name}. `;

        // Execute effect based on name
        if (ability.name === 'Arcane Recovery') {
            if (this.state.mode === 'COMBAT') {
                return "Arcane Recovery can only be used during a short rest (outside of combat).";
            }
            result += "You focus your mind to recover some of your spent magical energy.";
        } else if (ability.name === 'Second Wind') {
            const heal = Dice.roll("1d10") + char.level;
            char.hp.current = Math.min(char.hp.max, char.hp.current + heal);
            result += `Recovering ${heal} HP.`;
        } else if (ability.name === 'Action Surge') {
            result += "You push yourself beyond your normal limits for a moment.";
            // Note: In a full implementation, this would grant an extra action
        }

        // Consume usage
        if (usage) {
            usage.current--;
        }

        if (this.state.mode === 'COMBAT' && currentCombatant) {
            if (ability.actionCost === 'ACTION') {
                currentCombatant.hasUsedAction = true;
            } else if (ability.actionCost === 'BONUS_ACTION') {
                currentCombatant.hasUsedBonusAction = true;
            }

            this.addCombatLog(result);
            if (!this.turnProcessing) {
                setTimeout(() => this.advanceCombatTurn(), 1500);
            }
        }

        return result;
    }

    private addCombatLog(message: string) {
        if (!this.state.combat) return;
        this.state.combat.logs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'info',
            message: message,
            turn: this.state.combat.round
        });
    }

    private emitCombatEvent(type: string, targetId: string, value: number) {
        if (!this.state.combat) return;

        // Map engine types to UI event types
        const eventType = type === 'CRIT' ? 'CRIT' : (type === 'HIT' ? 'HIT' : 'MISS');

        this.state.combat.events.push({
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: eventType as any,
            targetId,
            value,
            timestamp: Date.now()
        });

        // Limit event history to avoid bloating save state
        if (this.state.combat.events.length > 10) {
            this.state.combat.events.shift();
        }
    }

    private checkCombatEnd(): boolean {
        if (!this.state.combat) return false;

        const enemiesAlive = this.state.combat.combatants.some(c => c.type === 'enemy' && c.hp.current > 0);
        const playersAlive = this.state.combat.combatants.some(c => c.type === 'player' && c.hp.current > 0);

        if (!enemiesAlive || !playersAlive) {
            this.endCombat(!enemiesAlive);
            return true;
        }

        return false;
    }

    private async endCombat(victory: boolean) {
        if (!this.state.combat) return;

        const summaryMsg = victory
            ? "Victory! All enemies have been defeated."
            : "Defeat... You have been overcome by your foes.";

        this.addCombatLog(summaryMsg);

        // --- Award XP on Victory ---
        if (victory) {
            let totalXP = 0;
            // Get all enemies that were in the combat
            const enemies = this.state.combat.combatants.filter(c => c.type === 'enemy');

            for (const enemy of enemies) {
                // Get monster data to find CR
                const monsterData = DataManager.getMonster(enemy.name);
                if (monsterData) {
                    totalXP += MechanicsEngine.getCRtoXP(monsterData.cr);
                } else {
                    // Fallback to CR 1/4 if missing (50 XP)
                    totalXP += 50;
                }
            }

            // Apply difficulty modifier from settings (Phase 25H preview)
            const difficulty = this.state.settings?.gameplay?.difficulty || 'normal';
            if (difficulty === 'hard') {
                totalXP = Math.floor(totalXP * 1.25);
                this.addCombatLog(`Bonus XP awarded for Hard difficulty!`);
            }

            const char = this.state.character;
            char.xp += totalXP;
            this.addCombatLog(`You gained ${totalXP} Experience Points! (Total: ${char.xp})`);

            // Check for Level Up
            const nextThreshold = MechanicsEngine.getNextLevelXP(char.level);
            if (char.xp >= nextThreshold && char.level < 20) {
                char.level++;
                this.addCombatLog(`*** LEVEL UP! *** You have reached level ${char.level}!`);

                // Increase HP on level up (Simple version: heal to full and add 10 to max)
                // In D&D 5e it's Hit Die + CON mod, but we'll do 10 for now as a celebration event
                char.hp.max += 10;
                char.hp.current = char.hp.max;

                // Recover spell slots
                Object.values(char.spellSlots).forEach(slot => {
                    slot.current = slot.max;
                });
            }
        }

        // Transition back to exploration or game over
        if (victory) {
            this.state.mode = 'EXPLORATION';

            // Mark hex as cleared for the 4-hour window
            if (!this.state.clearedHexes) this.state.clearedHexes = {};
            this.state.clearedHexes[this.state.location.hexId] = this.state.worldTime.totalTurns;

            // Calculate time passed (Round * 6s) + 5 minutes recovery
            const combatSeconds = (this.state.combat?.round || 0) * 6;
            const totalMinutes = Math.ceil(combatSeconds / 60) + 5;
            this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, totalMinutes);

            // Trigger LLM Summarization
            const summary = await NarratorService.summarizeCombat(this.state, this.state.combat?.logs || []);
            this.state.lastNarrative = summary;
            this.state.combat = undefined;

            this.emitStateUpdate();
        } else {
            this.state.mode = 'GAME_OVER';
            // We keep the combat state so the UI can still display some info if needed,
            // or just to avoid crashing if components expect it.
            this.emitStateUpdate();
        }
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
