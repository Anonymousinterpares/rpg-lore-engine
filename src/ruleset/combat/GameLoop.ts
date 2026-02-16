import { GameState, CombatantSchema } from '../schemas/FullSaveStateSchema';
import { IntentRouter, ParsedIntent } from './IntentRouter';
import { DataManager } from '../data/DataManager';
import { HexMapManager } from './HexMapManager';
import { BiomePoolManager } from './BiomeRegistry';
import { Encounter } from './EncounterDirector';
import { EncounterDirector } from './EncounterDirector';
import { CombatManager } from './CombatManager';
import { ContextManager } from '../agents/ContextManager';
import { NarratorService } from '../agents/NarratorService';
import { NarratorOutput } from '../agents/ICPSchemas';
import { LoreService } from '../agents/LoreService';
import { NPCService } from '../agents/NPCService';
import { MovementEngine } from './MovementEngine';
import { GameStateManager } from './GameStateManager';
import { StoryScribe } from './StoryScribe';
import { DirectorService } from '../agents/DirectorService';
import { EngineDispatcher } from '../agents/EngineDispatcher';
import { CombatAnalysisEngine, TacticalOption } from './grid/CombatAnalysisEngine';
import { CODEX_LORE } from '../data/CodexRegistry';
import { CombatGridManager } from './grid/CombatGridManager';
import { IStorageProvider } from './IStorageProvider';

// New Managers
import { ExplorationManager } from './managers/ExplorationManager';
import { InventoryManager } from './managers/InventoryManager';
import { SpellManager } from './managers/SpellManager';
import { TimeManager } from './managers/TimeManager';
import { CombatOrchestrator } from './managers/CombatOrchestrator';

import { z } from 'zod';

type Combatant = z.infer<typeof CombatantSchema>;

/**
 * The Central Orchestrator for the RPG Engine.
 * Following the refactor, this class routes intents to specialized managers.
 */
export class GameLoop {
    private state: GameState;
    private hexMapManager: HexMapManager;
    private biomePool: BiomePoolManager;
    private director: EncounterDirector;
    private combatManager: CombatManager;
    private contextManager: ContextManager;
    private movementEngine: MovementEngine;
    private stateManager: GameStateManager;

    // Specialized Managers
    private exploration: ExplorationManager;
    private inventory: InventoryManager;
    private spells: SpellManager;
    private time: TimeManager;
    private combatOrchestrator: CombatOrchestrator;
    private scribe: StoryScribe;

    private onStateUpdate?: (state: GameState) => Promise<void>;
    private listeners: ((state: GameState) => void)[] = [];

    constructor(
        initialState: GameState,
        basePath: string = './',
        storage?: IStorageProvider,
        onStateUpdate?: (state: GameState) => Promise<void>
    ) {
        this.state = initialState;
        this.onStateUpdate = onStateUpdate;

        // Initialize Core Engines
        this.stateManager = new GameStateManager(basePath, storage);
        this.hexMapManager = new HexMapManager(basePath, this.state.worldMap, this.state.worldMap.grid_id || 'world_01', storage);
        this.biomePool = new BiomePoolManager();
        this.director = new EncounterDirector();
        this.combatManager = new CombatManager(this.state);
        this.contextManager = new ContextManager();
        this.movementEngine = new MovementEngine(this.hexMapManager);
        this.scribe = new StoryScribe();

        // Initialize Specialized Managers
        this.exploration = new ExplorationManager(
            this.state,
            this.hexMapManager,
            this.biomePool,
            () => this.emitStateUpdate()
        );

        this.inventory = new InventoryManager(
            this.state,
            () => this.emitStateUpdate(),
            (msg) => this.addCombatLog(msg)
        );

        this.spells = new SpellManager(
            this.state,
            this.hexMapManager,
            () => this.emitStateUpdate(),
            (msg) => this.addCombatLog(msg),
            (type, target, val) => this.emitCombatEvent(type, target, val),
            async (target, dmg) => await this.combatOrchestrator.applyCombatDamage(target, dmg)
        );

        this.time = new TimeManager(
            this.state,
            this.hexMapManager,
            this.director,
            () => this.emitStateUpdate(),
            (enc) => this.initializeCombat(enc)
        );

        this.combatOrchestrator = new CombatOrchestrator(
            this.state,
            this.combatManager,
            this.contextManager,
            () => this.emitStateUpdate(),
            (msg) => this.addCombatLog(msg),
            (type, target, val) => this.emitCombatEvent(type, target, val)
        );
    }

    public async initialize() {
        // Initial map expansion if needed
        await this.exploration.expandHorizon(this.state.location.coordinates);
        await this.emitStateUpdate();
    }

    /**
     * Main entry point for player input.
     */
    public async processTurn(input: string): Promise<string> {
        const intent = IntentRouter.parse(input, this.state.mode === 'COMBAT');

        let systemResponse = '';

        if (intent.type === 'COMMAND') {
            systemResponse = await this.handleCommand(intent);
        } else if (intent.type === 'COMBAT_ACTION' && this.state.mode === 'COMBAT') {
            systemResponse = await this.combatOrchestrator.handleCombatAction(intent);

            if ((this.state.mode as any) === 'EXPLORATION') {
                systemResponse = this.state.lastNarrative;
            } else {
                // Fix: Do not overwrite narrative on "end turn" (Orchestrator handles it)
                if (intent.command !== 'end turn') {
                    this.state.lastNarrative = systemResponse;
                }
                this.unlockLoreCategories(systemResponse);
            }
            await this.emitStateUpdate();
            return systemResponse;
        } else {
            systemResponse = "I don't understand that action in this context.";
        }

        // Exploration Phase Logic
        if (this.state.mode === 'EXPLORATION') {
            const currentHex = this.hexMapManager.getHex(this.state.location.hexId);

            // Director Pacing Check
            const directive = await DirectorService.evaluatePacing(this.state);

            // Narrator Generation
            const narratorResponse = await NarratorService.generate(
                this.state,
                this.hexMapManager,
                input,
                this.contextManager.getRecentHistory(10),
                directive
            );

            let narratorOutput = narratorResponse.narrative_output;

            // Companion Chatter
            const companionMsg = await NPCService.generateChatter(this.state, {
                location: { name: currentHex?.name || 'Unknown' },
                mode: this.state.mode,
                player: { hpStatus: `${this.state.character.hp.current}/${this.state.character.hp.max}` }
            });
            if (companionMsg) {
                narratorOutput += `\n\n${companionMsg}`;
            }

            // Sync Narrative State
            this.state.lastNarrative = narratorOutput;
            this.unlockLoreCategories(narratorOutput);

            // History Update
            const turn = this.state.worldTime.totalTurns;
            this.state.conversationHistory.push({ role: 'player', content: input, turnNumber: turn });
            this.state.conversationHistory.push({ role: 'narrator', content: narratorOutput, turnNumber: turn });

            this.contextManager.addEvent('player', input);
            this.contextManager.addEvent('narrator', narratorOutput);

            // Execute Effects
            this.applyNarratorEffects(narratorResponse);

            // Time Advancement (5 mins per turn)
            if (intent.type !== 'COMMAND') {
                const encounter = await this.time.advanceTimeAndProcess(5);
                if (encounter) {
                    await this.initializeCombat(encounter);
                    narratorOutput += `\n\n[AMBUSH] You are interrupted by ${encounter.description}`;
                }
            }

            // Scribe summarization
            await this.scribe.processTurn(this.state, this.contextManager.getRecentHistory(10));

            systemResponse = systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
        }

        await this.emitStateUpdate();
        return systemResponse;
    }

    private async handleCommand(intent: ParsedIntent): Promise<string> {
        const cmd = intent.command;
        const args = intent.args || [];

        switch (cmd) {
            case 'move':
                if (this.state.mode === 'COMBAT') {
                    return await this.combatOrchestrator.handleCombatAction(intent);
                }

                // Block if already moving
                if (this.state.location.travelAnimation) return "You are already traveling.";

                const direction = args[0] as any;
                const result = this.movementEngine.move(this.state.location.coordinates, direction, this.state.travelPace || 'Normal' as any);
                if (!result.success) return result.message || "Can't move there.";

                const startCoords = [...this.state.location.coordinates] as [number, number];
                const targetCoords = result.newHex!.coordinates;
                const startHex = this.hexMapManager.getHex(`${startCoords[0]},${startCoords[1]}`);

                // --- Connectivity & Curve Logic ---
                let curvatureX: number;
                let curvatureY: number;
                let travelType: 'Road' | 'Path' | 'Stealth' | 'Wilderness' = 'Wilderness';
                let infraSpeedMod = 1.0;

                const sideIndex = HexMapManager.getSideIndex(startCoords, targetCoords);
                const connection = startHex ? this.hexMapManager.getConnection(startHex, sideIndex) : null;

                // Use road/path if discovered AND not in stealth mode
                if (connection && connection.discovered && this.state.travelStance !== 'Stealth') {
                    travelType = connection.type === 'R' ? 'Road' : 'Path';
                    infraSpeedMod = connection.type === 'R' ? 0.5 : 0.75;

                    // Deterministic Curve (seeded by coordinates to ensure visual consistency)
                    const seed = (startCoords[0] * 131 + startCoords[1] * 7 + targetCoords[0] * 31 + targetCoords[1] * 3) % 1000;
                    const pseudoRand = (s: number) => ((s * 9301 + 49297) % 233280) / 233280;
                    curvatureX = (pseudoRand(seed) * 0.8 - 0.4); // Tighter deviation for roads
                    curvatureY = (pseudoRand(seed + 1) * 0.8 - 0.4);
                } else {
                    if (this.state.travelStance === 'Stealth') {
                        travelType = 'Stealth';
                    }
                    // Random deviation for wilderness/stealth
                    const rand = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
                    curvatureX = rand() * 1.5;
                    curvatureY = rand() * 1.5;
                }

                // Calculate Base Duration
                const baseDurationMs = (result.timeCost * infraSpeedMod) * (1000 / 60); // 1 real sec = 1 game hour

                const curveFactor = 1 + (Math.abs(curvatureX) + Math.abs(curvatureY)) * 0.2;
                const durationMs = Math.round(baseDurationMs * curveFactor);

                this.state.location.travelAnimation = {
                    startCoordinates: startCoords,
                    targetCoordinates: targetCoords,
                    controlPointOffset: [curvatureX, curvatureY],
                    startTime: Date.now(),
                    duration: durationMs
                };

                // Notify UI of start
                await this.emitStateUpdate();

                // Wait for animation
                await new Promise(resolve => setTimeout(resolve, durationMs));

                // Arrived
                this.state.location.previousCoordinates = startCoords;
                this.state.location.previousControlPointOffset = [curvatureX, curvatureY];
                this.state.location.coordinates = targetCoords;
                this.state.location.hexId = `${targetCoords[0]},${targetCoords[1]}`;
                this.state.location.travelAnimation = undefined;

                // Advance time for travel (apply infrastructure modifier to game time too)
                const adjustedTimeCost = Math.max(1, Math.round(result.timeCost * infraSpeedMod));
                const encounter = await this.time.advanceTimeAndProcess(adjustedTimeCost);
                await this.exploration.expandHorizon(this.state.location.coordinates);
                await this.time.trackTutorialEvent('moved_hex');

                if (encounter) {
                    await this.initializeCombat(encounter);
                    return `You move ${direction}. Suddenly, you are ambushed!`;
                }

                // Varied Narrative
                const targetBiome = this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'wilderness';
                let narrativeMessage = `You travel ${direction} through the ${targetBiome}.`;

                if (travelType === 'Road') narrativeMessage = `You follow the road ${direction} into the ${targetBiome}.`;
                else if (travelType === 'Path') narrativeMessage = `You follow a narrow trail ${direction} through the ${targetBiome}.`;
                else if (travelType === 'Stealth') narrativeMessage = `You move stealthily ${direction}, avoiding the main paths as you enter the ${targetBiome}.`;

                return narrativeMessage;

            case 'moveto':
                if (this.state.mode === 'COMBAT') {
                    const targetQ = parseInt(args[0] || '0', 10);
                    const targetR = parseInt(args[1] || '0', 10);
                    const currentCombatant = this.state.combat?.combatants[this.state.combat?.currentTurnIndex || 0];

                    if (!currentCombatant) return "Error: No active combatant.";
                    if (!currentCombatant.isPlayer) return "It is not your turn.";

                    return await this.combatOrchestrator.handleCombatAction({
                        type: 'COMBAT_ACTION',
                        command: 'move',
                        args: [targetQ.toString(), targetR.toString()],
                        originalInput: `move ${targetQ} ${targetR}`
                    });
                }

                // Block if already moving
                if (this.state.location.travelAnimation) return "You are already traveling.";

                // Exploration Moveto (Teleport/Debug/Click)
                const char = this.state.character;
                const weight = char.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
                const capacity = (char.stats.STR || 10) * 15;

                if (weight > capacity) return "You are overencumbered and cannot move!";

                const q = parseInt(args[0] || '0', 10);
                const r = parseInt(args[1] || '0', 10);

                const moveResult = this.movementEngine.move(this.state.location.coordinates, [q, r], this.state.travelPace as any);
                if (!moveResult.success) return moveResult.message;

                const startCoordsMT = [...this.state.location.coordinates] as [number, number];
                const targetCoordsMT = moveResult.newHex!.coordinates;
                // Calculate Base Duration
                const baseDurationMsMT = moveResult.timeCost * (1000 / 60);

                // --- Curve Calculation ---
                const randMT = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
                const curvatureXMT = randMT() * 1.5;
                const curvatureYMT = randMT() * 1.5;
                const curveFactorMT = 1 + (Math.abs(curvatureXMT) + Math.abs(curvatureYMT)) * 0.2;
                const durationMsMT = Math.round(baseDurationMsMT * curveFactorMT);

                // 1. Set Animation State
                this.state.location.travelAnimation = {
                    startCoordinates: startCoordsMT,
                    targetCoordinates: targetCoordsMT,
                    controlPointOffset: [curvatureXMT, curvatureYMT],
                    startTime: Date.now(),
                    duration: durationMsMT
                };
                await this.emitStateUpdate();

                // 2. Wait for animation
                await new Promise(resolve => setTimeout(resolve, durationMsMT));

                // 3. Finalize Movement
                this.state.location.previousCoordinates = startCoordsMT;
                this.state.location.previousControlPointOffset = [curvatureXMT, curvatureYMT];
                this.state.location.coordinates = targetCoordsMT;
                this.state.location.hexId = `${targetCoordsMT[0]},${targetCoordsMT[1]}`;
                this.state.location.travelAnimation = undefined;

                const enc = await this.time.advanceTimeAndProcess(moveResult.timeCost);
                await this.exploration.expandHorizon(this.state.location.coordinates);
                await this.time.trackTutorialEvent('moved_hex');

                if (enc) {
                    await this.initializeCombat(enc);
                    return `You travel to [${q},${r}] and are ambushed!`;
                }
                return moveResult.message;

            case 'target':
                if (this.state.mode === 'COMBAT') {
                    return await this.combatOrchestrator.handleCombatAction(intent);
                }
                return "You can only target enemies in combat.";

            case 'look':
                const hex = this.hexMapManager.getHex(this.state.location.hexId);
                const lookDesc = hex ? `You are in a ${hex.biome}. ${hex.description || ''}` : "You look around but see nothing of note.";
                this.state.lastNarrative = lookDesc;
                await this.emitStateUpdate();
                return lookDesc;

            case 'item_pickup':
                return await this.inventory.pickupItem(args[0]);

            case 'item_drop':
                return await this.inventory.dropItem(args[0]);

            case 'item_equip':
                return await this.inventory.equipItem(args[0]);

            case 'rest':
                const duration = parseInt(args[0] || '480');
                const restEnc = await this.time.advanceTimeAndProcess(duration, true);
                if (restEnc) {
                    await this.initializeCombat(restEnc);
                    return "Your rest is interrupted by an attack!";
                }
                return this.time.completeRest(duration);

            case 'cast':
                return await this.spells.castSpell(args[0], args[1]);

            case 'pace':
                (this.state.settings.gameplay as any).pacing = args[0] as any;
                await this.emitStateUpdate();
                return `Pacing set to ${args[0]}.`;

            case 'add_item':
                return await this.inventory.addItem(args[0], parseInt(args[1] || '1'));

            case 'combat': {
                const enemyName = args[0];
                const count = parseInt(args[1] || '1');
                if (!enemyName) return "Usage: /combat [enemy_name] [count]";

                const enemies = Array(count).fill(enemyName);

                // Create a temporary encounter
                const encounter: Encounter = {
                    name: "Dev Combat",
                    description: "Developer initiated combat.",
                    monsters: enemies,
                    difficulty: 1,
                    xpAward: 0
                };

                await this.initializeCombat(encounter);
                return `Started combat with ${count}x ${enemyName}.`;
            }

            default:
                return `Command "${cmd}" not recognized.`;
        }
    }

    public async initializeCombat(encounter: Encounter) {
        const biome = this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'Plains';
        await this.combatManager.initializeCombat(encounter, biome);
        await this.emitStateUpdate();
        await this.combatOrchestrator.processCombatQueue();
    }

    // Public APIs for UI

    public getState(): GameState {
        return this.state;
    }

    public getStateManager(): GameStateManager {
        return this.stateManager;
    }

    public subscribe(listener: (state: GameState) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public async castSpell(spellName: string, targetId?: string) {
        return await this.spells.castSpell(spellName, targetId);
    }

    public async pickupCombatLoot(instanceId: string) {
        return await this.inventory.pickupCombatLoot(instanceId);
    }

    public async pickupItem(instanceId: string) {
        return await this.inventory.pickupItem(instanceId);
    }

    public async dropItem(instanceId: string) {
        return await this.inventory.dropItem(instanceId);
    }

    public async equipItem(instanceId: string) {
        return await this.inventory.equipItem(instanceId);
    }

    public async markQuestAsRead(questId: string) {
        const quest = this.state.activeQuests.find(q => q.id === questId);
        if (quest) {
            quest.isNew = false;
        }
        await this.emitStateUpdate();
    }

    public async trackTutorialEvent(eventId: string) {
        return await this.time.trackTutorialEvent(eventId);
    }

    public getTacticalOptions(): TacticalOption[] {
        if (!this.state.combat || !this.state.combat.grid) return [];
        const player = this.state.combat.combatants.find(c => c.isPlayer);
        if (!player) return [];

        const analysis = new CombatAnalysisEngine(new CombatGridManager(this.state.combat.grid));
        return analysis.getContextualOptions(
            player,
            this.state.combat.combatants,
            this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'Plains',
            this.state.combat.weather || { type: 'Clear', durationMinutes: 0, intensity: 1.0 },
            this.state.combat.selectedTargetId
        );
    }

    // Utilities

    public unlockLoreCategories(text: string) {
        if (!text) return;
        const lowerText = text.toLowerCase();
        Object.entries(CODEX_LORE.WORLD).forEach(([id, data]) => {
            if (this.state.codexEntries.some(e => e.entityId === id)) return;
            if (lowerText.includes(data.name.toLowerCase())) {
                this.state.codexEntries.push({
                    id: `world_${id}_${Date.now()}`,
                    category: 'world' as any,
                    entityId: id,
                    title: data.name,
                    content: data.content,
                    isNew: true,
                    discoveredAt: Date.now()
                });
                this.state.notifications.push({
                    id: `notif_lore_${id}_${Date.now()}`,
                    type: 'CODEX_ENTRY' as any,
                    message: `New Codex Entry: ${data.name}`,
                    data: { factionId: id },
                    isRead: false,
                    createdAt: Date.now()
                });
            }
        });
    }

    private async emitStateUpdate() {
        if (this.onStateUpdate) {
            // Deep-ish clone for combat state to ensure React detects nested changes
            const stateClone = {
                ...this.state,
                combat: this.state.combat ? {
                    ...this.state.combat,
                    combatants: this.state.combat.combatants.map(c => ({
                        ...c,
                        resources: { ...c.resources },
                        tactical: { ...c.tactical },
                        hp: { ...c.hp },
                        // Ensure position object reference breaks for grid updates
                        position: { ...c.position }
                    })),
                    // Break array references for logs and events
                    events: [...this.state.combat.events],
                    logs: [...this.state.combat.logs]
                } : undefined,
                // Also clone inventory to ensure UI updates on quantity change
                character: {
                    ...this.state.character,
                    inventory: {
                        ...this.state.character.inventory,
                        items: [...this.state.character.inventory.items]
                    }
                }
            };
            await this.onStateUpdate(stateClone as any);
        }
        this.listeners.forEach(l => l(this.state));
    }

    private addCombatLog(message: string) {
        if (!this.state.combat) return;
        if (!message || !message.trim()) return;

        this.state.combat.logs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'info',
            message: message.trim(),
            turn: this.state.combat.round
        });
    }

    private emitCombatEvent(type: string, targetId: string, value: number) {
        if (!this.state.combat) return;
        // Fix: Pass actual type through (don't coerce to HIT/MISS) so UI can react to SPELL_CAST, HEAL, etc.
        const eventType = type;
        this.state.combat.events.push({
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: eventType as any,
            targetId,
            value,
            timestamp: Date.now()
        });
        if (this.state.combat.events.length > 10) this.state.combat.events.shift();
    }

    public async updateSettings(settings: any) {
        this.state.settings = settings;
        await this.emitStateUpdate();
    }

    private applyNarratorEffects(output: NarratorOutput) {
        EngineDispatcher.dispatch(
            output.engine_calls || [],
            this.state,
            this.hexMapManager,
            {
                combatInitializer: (enc) => this.initializeCombat(enc),
                worldClock: {
                    advanceTime: async (state: GameState, hours: number) => {
                        await this.time.advanceTimeAndProcess(hours * 60);
                    }
                }
            }
        );
    }
}
