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
import { HexGenerator } from './HexGenerator';
import { WorldClockEngine } from './WorldClockEngine';
import { HexDirection } from '../schemas/HexMapSchema';
import { TravelPace } from '../schemas/BaseSchemas';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { StoryScribe } from './StoryScribe';
import { EncounterDirector } from './EncounterDirector';
import { FactionEngine } from './FactionEngine';
import { Dice } from './Dice';
import { LootEngine } from './LootEngine';
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
import { BiomePoolManager } from './BiomeRegistry';
import { CombatManager } from './CombatManager';
import { CombatGridManager } from './grid/CombatGridManager';
import { CombatUtils } from './CombatUtils';
import { CombatAnalysisEngine, TacticalOption } from './grid/CombatAnalysisEngine';
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
    private biomePool: BiomePoolManager = new BiomePoolManager();
    private scribe: StoryScribe = new StoryScribe();
    private director: EncounterDirector = new EncounterDirector();
    private combatManager: CombatManager;

    private turnProcessing: boolean = false;
    private listeners: ((state: GameState) => void)[] = [];

    constructor(initialState: GameState, basePath: string, storage?: IStorageProvider) {
        this.state = initialState;
        this.stateManager = new GameStateManager(basePath, storage);
        this.hexMapManager = new HexMapManager(basePath, this.state.worldMap, 'world_01', storage);
        this.movementEngine = new MovementEngine(this.hexMapManager);
        this.combatManager = new CombatManager(this.state);
    }

    /**
     * Centralized initialization for async components.
     */
    public async initialize(): Promise<void> {
        // Bootstrap registries from storage
        await this.hexMapManager.initialize();

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
            await this.hexMapManager.setHex({
                coordinates: this.state.location.coordinates,
                generated: true,
                visited: true,
                biome: 'Plains',
                name: 'Starting Clearing',
                description: 'A calm meadow where your adventure begins.',
                inLineOfSight: true,
                interest_points: [],
                resourceNodes: [],
                openedContainers: {},
                namingSource: 'engine',
                visualVariant: 1
            });
        }

        // Ensure neighbors of the current location are generated (Exploration Bootstrap)
        await this.expandHorizon(this.state.location.coordinates);

        // Initial state sync to UI
        await this.emitStateUpdate();
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
        // Bug Fix #5: Deep-ish clone for combat state to ensure React detects nested changes
        const stateClone = {
            ...this.state,
            combat: this.state.combat ? {
                ...this.state.combat,
                combatants: this.state.combat.combatants.map(c => ({ ...c, resources: { ...c.resources }, tactical: { ...c.tactical }, hp: { ...c.hp } })),
                events: [...this.state.combat.events],
                logs: [...this.state.combat.logs]
            } : undefined
        };
        this.listeners.forEach(listener => listener(stateClone));
    }

    /**
     * Centralized method to save state and notify the UI.
     */
    private async emitStateUpdate() {
        await this.stateManager.saveGame(this.state);
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
            systemResponse = await this.handleCommand(intent);
        } else if (intent.type === 'COMBAT_ACTION' && this.state.mode === 'COMBAT') {
            systemResponse = await this.handleCombatAction(intent);
        }

        // If we are in combat, we skip the immediate Narrator generation to avoid latency
        if (this.state.mode === 'COMBAT') {
            this.state.lastNarrative = systemResponse; // Update narrative box with current combat action
            await this.emitStateUpdate();
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

        await this.emitStateUpdate();

        return systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
    }

    /**
     * Centralized time advancement that processes intervals (Encounters, Weather)
     */
    public async advanceTimeAndProcess(totalMinutes: number, isResting: boolean = false): Promise<Encounter | null> {
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

            // Emit update so UI refreshes (Time, Weather, etc.)
            await this.emitStateUpdate();

            // Encounter check every interval (if exploration)
            if (this.state.mode === 'EXPLORATION' && !resultEncounter) {
                const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
                const encounter = this.director.checkEncounter(this.state, currentHex || {}, isResting);
                if (encounter) {
                    resultEncounter = encounter;
                    break;
                }
            }
        }

        return resultEncounter;
    }

    /**
     * Programmatically expands the map discovery around a coordinate.
     * Progressively "uncovers" a hex and reveals its neighbors.
     */
    private async expandHorizon(centerCoords: [number, number]) {
        // 1. Handle Current Hex (Distance 0)
        const centerKey = `${centerCoords[0]},${centerCoords[1]}`;
        const centerHex = this.hexMapManager.getHex(centerKey);

        if (centerHex) {
            // Regeneration Condition: Not generated OR has placeholder/unvisited name
            const currentName = centerHex.name || '';
            const needsRegen = !centerHex.generated ||
                currentName === 'Uncharted Territory' ||
                currentName.includes('(Unknown)') ||
                currentName.includes('(Uncharted Territory)'); // <-- FIX: Also re-process former neighbors!

            if (needsRegen) {
                // Fully generate the hex
                await this.generateAndSaveHex(centerCoords, centerHex, true, true);
            }
        }
        // ...
        // 2. Handle Neighbors (Distance 1) - Visible on Map
        const neighbors = this.hexMapManager.getNeighbors(centerCoords);
        for (const neighbor of neighbors) {
            const nKey = `${neighbor.coordinates[0]},${neighbor.coordinates[1]}`;
            const nHex = this.hexMapManager.getHex(nKey); // Refetch to be safe
            if (nHex) {
                // Determine if we need to reveal it
                // If it's not generated, generate it
                const nName = nHex.name || '';
                if (!nHex.generated || nName === 'Uncharted Territory' || nName.includes('(Unknown)')) {
                    await this.generateAndSaveHex(neighbor.coordinates, nHex, false, true); // visited=false, inLOS=true
                } else if (!nHex.inLineOfSight) {
                    // Update LOS status if already generated
                    nHex.inLineOfSight = true;
                    await this.hexMapManager.setHex(nHex);
                }
            }
        }

        // 3. Handle Distance 2 (Horizon) - Hidden on Map, Known to Engine
        // ...
        for (const n of neighbors) {
            await this.hexMapManager.ensureNeighborsRegistered(n.coordinates);
        }

        // Loop through D2 placeholders and generate them (but keep inLineOfSight=false)
        for (const n of neighbors) {
            const secondLayer = this.hexMapManager.getNeighbors(n.coordinates);
            for (const d2 of secondLayer) {
                const d2Key = `${d2.coordinates[0]},${d2.coordinates[1]}`;
                if (d2Key === centerKey) continue; // Skip center

                const d2Hex = this.hexMapManager.getHex(d2Key);
                if (d2Hex && !d2Hex.generated) {
                    // Generate but DO NOT REVEAL
                    await this.generateAndSaveHex(d2.coordinates, d2Hex, false, false);
                }
            }
        }
    }

    private seedCoastline(centerCoords: [number, number]) {
        const equations: ('q' | 'q+r' | 'q-r')[] = ['q', 'q+r', 'q-r'];
        const eq = equations[Math.floor(Math.random() * equations.length)];
        const threshold = eq === 'q' ? centerCoords[0] : (eq === 'q+r' ? centerCoords[0] + centerCoords[1] : centerCoords[0] - centerCoords[1]);
        const oceanSide = Math.random() > 0.5 ? 'positive' : 'negative';

        if (!this.state.worldMap.coastlines) {
            this.state.worldMap.coastlines = [];
        }

        this.state.worldMap.coastlines.push({
            id: `coast_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            equation: eq,
            threshold: threshold,
            oceanSide: oceanSide,
            originHex: [...centerCoords]
        });

        console.log(`[SYSTEM] Narrative Seed: A vast coastline was defined at ${centerCoords[0]}, ${centerCoords[1]}.`);
    }

    private async generateAndSaveHex(coords: [number, number], hex: any, isVisited: boolean, isVisible: boolean) {
        let biome = hex.biome;
        let variant = hex.visualVariant;
        let generatedData: any = {};

        if (!hex.generated) {
            const neighbors = this.hexMapManager.getNeighbors(coords);
            const clusterSizes: any = {};
            const biomes = ['Plains', 'Forest', 'Hills', 'Mountains', 'Swamp', 'Desert', 'Tundra', 'Jungle', 'Coast', 'Ocean', 'Volcanic', 'Ruins', 'Farmland', 'Urban'];

            for (const b of biomes) {
                const neighborWithBiome = neighbors.find(n => n.biome === b);
                clusterSizes[b] = neighborWithBiome ? this.hexMapManager.getClusterSize(neighborWithBiome) : 0;
            }

            generatedData = HexGenerator.generateHex(coords, neighbors, clusterSizes, this.biomePool, this.state.worldMap.coastlines || []);
            biome = generatedData.biome;
            variant = generatedData.visualVariant;
        }

        // Name logic - Construct fresh from biome, never append to old names
        let newName: string;
        if (isVisible && !isVisited) {
            newName = `${biome} (Uncharted Territory)`;
        } else if (isVisited) {
            newName = `${biome} (Discovered)`;
        } else {
            newName = 'Uncharted Territory';
        }

        const updatedHex = {
            ...hex,
            ...generatedData,
            biome, // Explicitly preserve or set
            visualVariant: variant, // Explicitly preserve or set
            visited: isVisited,
            generated: true,
            inLineOfSight: isVisible,
            name: newName
        };

        await this.hexMapManager.setHex(updatedHex);
    }

    /**
     * Applies the mechanical benefits of resting after time has passed.
     */
    public completeRest(durationMinutes: number): string {
        let restResult;
        if (durationMinutes >= 480) {
            restResult = RestingEngine.longRest(this.state.character);
        } else if (durationMinutes >= 60) {
            restResult = RestingEngine.shortRest(this.state.character);
        } else {
            restResult = RestingEngine.wait(durationMinutes);
        }
        this.emitStateUpdate();
        return restResult.message;
    }

    /**
     * Handles technical system commands (/stats, /rest, /move, etc.)
     */
    private async handleCommand(intent: ParsedIntent): Promise<string> {
        switch (intent.command) {
            case 'stats':
                return `Name: ${this.state.character.name} | HP: ${this.state.character.hp.current}/${this.state.character.hp.max} | Level: ${this.state.character.level} | Location: ${this.state.location.hexId}`;
            case 'rest':
                const restDuration = parseInt(intent.args?.[0] || '60', 10);

                // Determine rest type based on duration
                // >= 8 hours (480 mins) = Long Rest
                // >= 1 hour (60 mins) = Short Rest
                // < 1 hour = No mechanical benefit (effectively a wait)

                let restResult;
                if (restDuration >= 480) {
                    restResult = RestingEngine.longRest(this.state.character);
                    // Override time cost to match user input if longer
                    restResult.timeCost = Math.max(restResult.timeCost, restDuration);
                } else if (restDuration >= 60) {
                    restResult = RestingEngine.shortRest(this.state.character);
                    restResult.timeCost = Math.max(restResult.timeCost, restDuration);
                } else {
                    restResult = RestingEngine.wait(restDuration);
                    restResult.message = `You rest for ${restDuration} minutes, but it's not long enough to gain any benefits.`;
                }

                // Special handling for Ambush during rest
                const encounter = await this.advanceTimeAndProcess(restResult.timeCost, true);
                if (encounter) {
                    await this.initializeCombat(encounter);
                    // We'd need a way to notify the UI about the ambush here
                }
                return restResult.message;
            case 'wait':
                const waitMins = parseInt(intent.args?.[0] || '60', 10);
                const waitResult = RestingEngine.wait(waitMins);
                const waitEncounter = await this.advanceTimeAndProcess(waitResult.timeCost, false);
                if (waitEncounter) await this.initializeCombat(waitEncounter);
                return waitResult.message;
            case 'save':
                await this.emitStateUpdate();
                return 'Game saved.';
            case 'move':
                // COMBAT MODE HANDLING
                if (this.state.mode === 'COMBAT') {
                    // Check if args are coordinates (x y) as sent by Tactical System
                    const arg0 = intent.args?.[0];
                    const arg1 = intent.args?.[1];

                    if (arg0 && !isNaN(parseInt(arg0)) && arg1 && !isNaN(parseInt(arg1))) {
                        const x = parseInt(arg0);
                        const y = parseInt(arg1);
                        const currentCombatant = this.state.combat?.combatants[this.state.combat?.currentTurnIndex || 0];

                        if (!currentCombatant) return "Error: No active combatant.";
                        if (!currentCombatant.isPlayer) return "It is not your turn.";

                        // Handle Special Move Modes
                        const mode = intent.args?.[2]; // sprint | evasive
                        if (mode === 'sprint') {
                            if (currentCombatant.resources.actionSpent) {
                                return "Cannot Sprint: You have already used your action this turn.";
                            }
                            // Sprint = Dash (Add Speed) + Reckless (-2 AC)
                            currentCombatant.movementRemaining += currentCombatant.movementSpeed;
                            currentCombatant.resources.actionSpent = true;
                            currentCombatant.statusEffects.push({
                                id: 'sprint_reckless',
                                name: 'Reckless Sprint',
                                type: 'DEBUFF',
                                duration: 1,
                                sourceId: currentCombatant.id
                            });
                        } else if (mode === 'evasive') {
                            currentCombatant.statusEffects.push({
                                id: 'evasive_movement',
                                name: 'Evasive Movement',
                                type: 'BUFF',
                                duration: 1,
                                sourceId: currentCombatant.id
                            });
                        } else if (mode === 'press') {
                            // Press = Advantage on next melee (costs half move remaining)
                            currentCombatant.movementRemaining = Math.floor(currentCombatant.movementRemaining / 2);
                            currentCombatant.statusEffects.push({ id: 'press_advantage', name: 'Pressing Attack', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                        } else if (mode === 'stalk') {
                            // Stalk = Stealth vs Passive Perception
                            currentCombatant.movementRemaining = Math.floor(currentCombatant.movementRemaining / 2);
                            currentCombatant.statusEffects.push({ id: 'stalking', name: 'Stalking', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                        } else if (mode === 'flank') {
                            currentCombatant.statusEffects.push({ id: 'flanking', name: 'Flanking', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                        } else if (mode === 'phalanx') {
                            currentCombatant.statusEffects.push({ id: 'phalanx_formation', name: 'Phalanx Formation', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                        } else if (mode === 'hunker') {
                            currentCombatant.statusEffects.push({ id: 'hunkered_down', name: 'Hunkered Down', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                        } else if (mode === 'vault' || mode === 'jump') {
                            // Vault/Jump = Athletics check (DC 12)
                            const athletics = (currentCombatant.stats.STR || 10) + 2; // Simple bonus for now
                            const roll = Math.floor(Math.random() * 20) + 1;
                            const success = (roll + athletics) >= 12;

                            if (!success) {
                                // Fail -> Stop and take possible hazard damage
                                const obstacle = this.combatManager.getGridManager()?.getFeatureAt({ x, y });
                                let failMsg = `${currentCombatant.name} fails the vault attempt! (Roll: ${roll}+${athletics} vs DC 12)`;
                                if (obstacle?.hazard) {
                                    failMsg += ` They land in the ${obstacle.type.toLowerCase()}!`;
                                }
                                return failMsg;
                            }
                            // Success -> Continue movement (handled by combatManager.moveCombatant below)
                        }

                        return this.combatManager.moveCombatant(currentCombatant, { x, y });
                    }

                    return "In combat, use /move x y to reposition, or specific tactical commands.";
                }

                // EXPLORATION MODE HANDLING
                const char = this.state.character;
                const currentWeight = char.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
                const capacity = (char.stats.STR || 10) * 15;

                if (currentWeight > capacity) {
                    return "You are overencumbered and cannot move! Drop some items first.";
                }

                const direction = (intent.args?.[0]?.toUpperCase() || 'N') as HexDirection;
                const result = this.movementEngine.move(this.state.location.coordinates, direction, this.state.travelPace);
                if (result.success && result.newHex) {
                    this.state.location.coordinates = result.newHex.coordinates;
                    this.state.location.hexId = `${result.newHex.coordinates[0]},${result.newHex.coordinates[1]}`;

                    // Programmatic Discovery
                    await this.expandHorizon(result.newHex.coordinates);

                    await this.advanceTimeAndProcess(result.timeCost);
                    await this.trackTutorialEvent('moved_hex');
                }
                return result.message;
            case 'moveto':
                if (this.state.mode === 'COMBAT') {
                    const targetQ = parseInt(intent.args?.[0] || '0', 10);
                    const targetR = parseInt(intent.args?.[1] || '0', 10);
                    const currentCombatant = this.state.combat?.combatants[this.state.combat?.currentTurnIndex || 0];

                    if (!currentCombatant) return "Error: No active combatant.";
                    if (!currentCombatant.isPlayer) return "It is not your turn.";

                    return this.combatManager.moveCombatant(currentCombatant, { x: targetQ, y: targetR });
                }

                const moveChar = this.state.character;
                const weight = moveChar.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
                const strCapacity = (moveChar.stats.STR || 10) * 15;

                if (weight > strCapacity) {
                    return "You are overencumbered and cannot move!";
                }

                const targetQ = parseInt(intent.args?.[0] || '0', 10);
                const targetR = parseInt(intent.args?.[1] || '0', 10);
                const targetCoords: [number, number] = [targetQ, targetR];

                const moveResult = this.movementEngine.move(this.state.location.coordinates, targetCoords, this.state.travelPace);
                if (moveResult.success && moveResult.newHex) {
                    this.state.location.coordinates = moveResult.newHex.coordinates;
                    this.state.location.hexId = `${moveResult.newHex.coordinates[0]},${moveResult.newHex.coordinates[1]}`;

                    // Programmatic Discovery
                    await this.expandHorizon(moveResult.newHex.coordinates);

                    await this.advanceTimeAndProcess(moveResult.timeCost);
                    await this.trackTutorialEvent('moved_hex');
                }
                return moveResult.message;
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
            case 'pace':
                const newPace = (intent.args?.[0] || 'Normal') as TravelPace;
                this.state.travelPace = newPace;
                this.emitStateUpdate();
                return `Travel pace set to ${newPace}.`;
            case 'item_add':
                if (!intent.args || intent.args.length === 0) return "Usage: /item_add {name} {count}";

                let itemName = '';
                let itemCount = 1;

                // Check if the last argument is a quantity
                const lastArg = intent.args[intent.args.length - 1];
                const parsedCount = parseInt(lastArg, 10);

                if (!isNaN(parsedCount) && intent.args.length > 1) {
                    itemCount = parsedCount;
                    itemName = intent.args.slice(0, -1).join(' ');
                } else {
                    // Entire args is the name
                    itemName = intent.args.join(' ');
                }

                const itemDef = DataManager.getItem(itemName);
                if (!itemDef) return `Item not found: ${itemName}`;

                const charToUpdate = this.state.character;
                const currentCarriedWeight = charToUpdate.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
                const maxCapacity = (charToUpdate.stats.STR || 10) * 15;
                const newItemsWeight = itemDef.weight * itemCount;

                if (currentCarriedWeight + newItemsWeight > maxCapacity) {
                    return "weight limit exceeded";
                }

                // Add to inventory
                const existingInvItem = charToUpdate.inventory.items.find(i => i.id === itemDef.name); // Using name as ID based on DataManager indexing
                const isStackable = !['weapon', 'armor', 'shield'].some(t => itemDef.type.toLowerCase().includes(t));

                if (existingInvItem && isStackable) {
                    existingInvItem.quantity = (existingInvItem.quantity || 1) + itemCount;
                } else {
                    // For non-stackables or new items, add them
                    // If count > 1 for non-stackables, we add multiple entries
                    const additions = isStackable ? 1 : itemCount;
                    const qtyPerAddition = isStackable ? itemCount : 1;

                    for (let i = 0; i < additions; i++) {
                        charToUpdate.inventory.items.push({
                            ...itemDef,
                            id: itemDef.name,
                            instanceId: `${itemDef.name.toLowerCase().replace(/ /g, '_')}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                            name: itemDef.name,
                            type: itemDef.type,
                            weight: itemDef.weight,
                            quantity: qtyPerAddition,
                            equipped: false
                        });
                    }
                }

                this.emitStateUpdate();
                return `[SYSTEM] Added ${itemCount}x ${itemDef.name} to inventory.`;
            default:
                return `Unknown command: /${intent.command}`;
        }
    }

    public async pickupItem(instanceId: string): Promise<string> {
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

        await this.emitStateUpdate();
        return `Picked up ${item.name}.`;
    }

    public async dropItem(instanceId: string): Promise<string> {
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

        await this.emitStateUpdate();
        return `Dropped ${item.name}.`;
    }

    public async equipItem(instanceId: string): Promise<string> {
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
            await this.emitStateUpdate();
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
                await this.recalculateAC();
            }

            await this.emitStateUpdate();
            return `Equipped ${item.name}.`;
        }
    }

    public async markQuestAsRead(questId: string) {
        const quest = this.state.activeQuests?.find(q => q.id === questId);
        if (quest && quest.isNew) {
            quest.isNew = false;
            await this.emitStateUpdate();
        }
    }

    /**
     * Tracks tutorial-related events and updates quest progress.
     */
    public async trackTutorialEvent(eventId: string) {
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

        await this.emitStateUpdate();
    }

    public async initializeCombat(encounter: Encounter) {
        try {
            const biome = this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'Plains';
            await this.combatManager.initializeCombat(encounter, biome);
            await this.emitStateUpdate();

            // CRITICAL FIX: Trigger combat queue so AI acts if it wins initiative
            await this.processCombatQueue();
        } catch (error) {
            console.error("[GameLoop] Failed to start combat:", error);
            this.state.lastNarrative = `[System Error] Failed to initialize combat encounter. Reverting to exploration mode. (Error: ${error instanceof Error ? error.message : String(error)})`;
            await this.emitStateUpdate();
        }
    }

    private async handleCombatAction(intent: ParsedIntent): Promise<string> {
        if (!this.state.combat) return "Not in combat.";

        const currentCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];
        let resultMsg = '';

        const nonActionCommands = ['target', 'end turn'];
        if (currentCombatant.resources.actionSpent && !nonActionCommands.includes(intent.command || '')) {
            return `You have already used your main action this turn. Use "End Turn" or a bonus action if available.`;
        }

        if (intent.command === 'attack') {
            const combatState = this.state.combat!;
            const isRanged = intent.args?.[0] === 'ranged';
            const targets = combatState.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
            if (targets.length === 0) return "No valid targets.";

            // Use selected target if valid, otherwise default to first
            let target = targets.find(t => t.id === combatState.selectedTargetId);
            if (!target) target = targets[0];
            if (!target) return "No target found.";

            const pc = this.state.character;
            const mainHandId = pc.equipmentSlots.mainHand;
            const inventoryEntry = mainHandId ? pc.inventory.items.find(i => i.instanceId === mainHandId) : null;
            const mainHandItem = inventoryEntry ? DataManager.getItem(inventoryEntry.id) : null;

            // Equipment & Ammo Validation
            if (isRanged && !CombatUtils.isRangedWeapon(mainHandItem)) {
                return "You do not have a ranged weapon equipped in your main hand!";
            }

            // --- AMMO / THROWN LOGIC ---
            let ammoItem: any = null;
            if (isRanged) {
                const requiredAmmo = CombatUtils.getRequiredAmmunition(mainHandItem?.name || '');
                if (requiredAmmo) {
                    ammoItem = pc.inventory.items.find(i => i.name === requiredAmmo);
                    if (!ammoItem || (ammoItem.quantity || 0) <= 0) {
                        return `You have no ${requiredAmmo}s! Ranged attack with ${mainHandItem?.name} requires ammunition.`;
                    }
                } else if (CombatUtils.isThrownWeapon(mainHandItem)) {
                    // Thrown weapon logic: must be equipped (already checked)
                    // We will consume it after the attack
                } else {
                    // It's a ranged weapon but doesn't require ammo (e.g. a spell? No, handled separately)
                    // Or it's a ranged weapon without a mapping yet.
                }
            }

            const strMod = MechanicsEngine.getModifier(pc.stats.STR || 10);
            const dexMod = MechanicsEngine.getModifier(pc.stats.DEX || 10);
            const prof = MechanicsEngine.getProficiencyBonus(pc.level);

            const statMod = isRanged ? dexMod : strMod;
            let attackBonus = statMod + prof;
            let damageFormula = (mainHandItem as any)?.damage?.dice || "1d8";
            let dmgBonus = statMod;
            let forceDisadvantage = false;

            // --- MELEE REWORK (Unarmed / Improvised) ---
            const hasUnarmedSkill = pc.skillProficiencies.includes('Unarmed Combat');

            if (!mainHandItem && !isRanged) {
                // Unarmed Strike
                damageFormula = "1d4";
                attackBonus = strMod + (hasUnarmedSkill ? prof : 0);
                dmgBonus = strMod + (hasUnarmedSkill ? 2 : 0);
                this.addCombatLog(`You strike with your bare hands!`);
            } else if (mainHandItem && !isRanged && CombatUtils.isRangedWeapon(mainHandItem)) {
                // Ranged as Improvised Melee
                damageFormula = "1d4";
                attackBonus = strMod + prof;
                dmgBonus = strMod;
                forceDisadvantage = true;
                this.addCombatLog(`You swing your ${mainHandItem.name} like a club! (Improvised)`);
            }

            // Spatial Range Validation
            const gridManager = new CombatGridManager(this.state.combat.grid!);
            const distance = gridManager.getDistance(currentCombatant.position, target.position);

            let normalRangeCells: number;
            let maxRangeCells: number;
            if (isRanged) {
                normalRangeCells = CombatUtils.getWeaponRange(mainHandItem);
                maxRangeCells = CombatUtils.getWeaponMaxRange(mainHandItem);
            } else {
                // Melee: 1 cell (5ft), or 2 cells (10ft) for Reach weapons
                const hasReach = (mainHandItem as any)?.properties?.some(
                    (p: string) => p.toLowerCase().includes('reach')
                );
                normalRangeCells = hasReach ? 2 : 1;
                maxRangeCells = normalRangeCells;
            }

            if (distance > maxRangeCells) {
                const distFt = distance * 5;
                const rangeFt = maxRangeCells * 5;
                return isRanged
                    ? `Target is too far away! (${distFt}ft). Your weapon maximum range is ${rangeFt}ft.`
                    : `Target is out of melee reach! (${distFt}ft away, melee reach is ${rangeFt}ft). Move closer first.`;
            }

            // Determine Advantage/Disadvantage
            forceDisadvantage = false;
            let rangePrefix = "";

            // 1. Long Range Rule
            if (isRanged && distance > normalRangeCells) {
                forceDisadvantage = true;
                rangePrefix = "(Long Range! Disadvantage) ";
            }
            if (isRanged) {
                const isThreatened = combatState.combatants.some(c =>
                    c.type === 'enemy' &&
                    c.hp.current > 0 &&
                    gridManager.getDistance(currentCombatant.position, c.position) === 1
                );
                if (isThreatened) {
                    forceDisadvantage = true;
                    rangePrefix += "(Threatened! Disadvantage) ";
                }
            }

            const result = CombatResolutionEngine.resolveAttack(
                currentCombatant,
                target,
                attackBonus,
                damageFormula,
                dmgBonus,
                isRanged,
                forceDisadvantage
            );

            // --- CONSUMPTION ---
            if (isRanged) {
                if (ammoItem) {
                    ammoItem.quantity = (ammoItem.quantity || 1) - 1;
                    if (ammoItem.quantity <= 0) {
                        pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== ammoItem.instanceId);
                        this.addCombatLog(`You are out of ${ammoItem.name}s!`);
                    }
                } else if (CombatUtils.isThrownWeapon(mainHandItem)) {
                    // Unequip and remove from inventory
                    pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== inventoryEntry?.instanceId);
                    pc.equipmentSlots.mainHand = undefined;
                    this.addCombatLog(`You threw your ${mainHandItem?.name || 'weapon'}!`);
                }
            }

            // Record roll and emit event
            combatState.lastRoll = (result.details?.roll || 0) + (result.details?.modifier || 0);
            this.emitCombatEvent(result.type, target.id, result.damage || 0);

            const logMsg = rangePrefix + CombatLogFormatter.format(result, currentCombatant.name, target.name, isRanged);
            this.state.combat.turnActions.push(logMsg);
            resultMsg = logMsg;

            // Restore damage application for player attacks
            await this.applyCombatDamage(target, result.damage);

        } else if (intent.command === 'dodge') {
            currentCombatant.statusEffects.push({
                id: 'dodge',
                name: 'Dodge',
                type: 'BUFF',
                duration: 1,
                sourceId: currentCombatant.id
            });
            resultMsg = `${currentCombatant.name} takes a defensive stance. Attacks against them will have disadvantage until the start of their next turn.`;
            currentCombatant.resources.actionSpent = true; // Consumes action
            this.state.combat.turnActions.push(resultMsg);
        } else if (intent.command === 'disengage') {
            currentCombatant.statusEffects.push({
                id: 'disengage',
                name: 'Disengage',
                type: 'BUFF',
                duration: 1,
                sourceId: currentCombatant.id
            });
            resultMsg = `${currentCombatant.name} focuses on defense while moving, preventing opportunity attacks.`;
            this.state.combat.turnActions.push(resultMsg);
        } else if (intent.command === 'hide') {
            const d20 = Dice.d20();
            const stealth = d20 + MechanicsEngine.getModifier(currentCombatant.stats.DEX || 10);
            resultMsg = `${currentCombatant.name} attempts to hide! (Roll: ${stealth})`;
            this.state.combat.turnActions.push(resultMsg);
        } else if (intent.command === 'use') {
            const abilityName = intent.args?.[0] || intent.originalInput.replace(/^use /i, '').trim();
            resultMsg = this.useAbility(abilityName);
            this.state.combat.turnActions.push(resultMsg);
        } else if (intent.command === 'move') {
            const x = parseInt(intent.args?.[0] || '0');
            const y = parseInt(intent.args?.[1] || '0');
            const mode = intent.args?.[2]; // sprint | evasive

            if (mode === 'sprint') {
                // Sprint = Dash + Reckless: double remaining movement but -2 AC
                currentCombatant.movementRemaining = currentCombatant.movementSpeed * 2;
                currentCombatant.statusEffects.push({ id: 'sprint_reckless', name: 'Reckless Sprint', type: 'DEBUFF', duration: 1, sourceId: currentCombatant.id });
            } else if (mode === 'evasive') {
                currentCombatant.statusEffects.push({ id: 'evasive_movement', name: 'Evasive Movement', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
            } else if (mode === 'press') {
                currentCombatant.movementRemaining = Math.floor(currentCombatant.movementRemaining / 2);
                currentCombatant.statusEffects.push({ id: 'press_advantage', name: 'Pressing Attack', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
            } else if (mode === 'stalk') {
                currentCombatant.movementRemaining = Math.floor(currentCombatant.movementRemaining / 2);
                currentCombatant.statusEffects.push({ id: 'stalking', name: 'Stalking', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
            } else if (mode === 'flank') {
                currentCombatant.statusEffects.push({ id: 'flanking', name: 'Flanking', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
            } else if (mode === 'phalanx') {
                currentCombatant.statusEffects.push({ id: 'phalanx_formation', name: 'Phalanx Formation', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
            } else if (mode === 'hunker') {
                currentCombatant.statusEffects.push({ id: 'hunkered_down', name: 'Hunkered Down', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
            }

            const combatManager = new CombatManager(this.state);
            resultMsg = combatManager.moveCombatant(currentCombatant, { x, y });
            this.state.combat.turnActions.push(resultMsg);
        } else if (intent.command === 'end turn') {
            // Only players explicitly end turn via command. AI handles it internally.
            if (!currentCombatant.isPlayer) return "";

            const summary = this.state.combat.turnActions.length > 0
                ? `${this.state.combat.turnActions.join(", then ")} before ending their turn.`
                : `${currentCombatant.name} ends their turn.`;

            resultMsg = summary;
            this.state.combat.turnActions = []; // Clear for next turn
        }

        this.addCombatLog(resultMsg);

        // Consuming action if it was an action command
        if (resultMsg && !nonActionCommands.includes(intent.command || '')) {
            currentCombatant.resources.actionSpent = true;
        }

        // After player action, we don't advance the turn immediately if the action 
        // didn't explicitly end the turn. The player might still want to move or use bonus action.
        if (intent.command === 'end turn') {
            await this.advanceCombatTurn();
        } else {
            await this.emitStateUpdate();
        }

        return resultMsg;
    }

    /**
     * Public API for UI to trigger spellcasting. 
     * Bypasses the intent router / chat command logic.
     */
    public async castSpell(spellName: string, targetId?: string): Promise<string> {
        const combat = this.state.combat;
        if (this.state.mode === 'COMBAT' && combat) {
            const currentCombatant = combat.combatants[combat.currentTurnIndex];
            if (!currentCombatant.isPlayer) return "It is not your turn.";
            if (currentCombatant.resources.actionSpent) return "You have already used your action this turn.";
            if (this.turnProcessing) return "Turn is already ending...";

            // Set target if provided
            if (targetId) combat.selectedTargetId = targetId;

            const result = await this.handleCast(currentCombatant, spellName);
            this.addCombatLog(result);
            currentCombatant.resources.actionSpent = true;
            await this.emitStateUpdate();
            return result;
        } else {
            return await this.handleExplorationCast(spellName);
        }
    }

    private async handleCast(caster: Combatant, spellName: string): Promise<string> {
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

        // 3. Range Validation
        if (combo.grid) {
            const gridManager = new CombatGridManager(combo.grid);
            const rangeCells = CombatUtils.parseRange(spell.range);

            if (rangeCells > 0) {
                const withinRange = targets.filter(t => {
                    const dist = gridManager.getDistance(caster.position, t.position);
                    return dist <= rangeCells;
                });

                if (withinRange.length === 0 && targets.length > 0) {
                    return `Targets are too far away! Range: ${spell.range} (${rangeCells} cells).`;
                }
                targets = withinRange;
            }
        }

        // 4. Resolve Spell for each target
        let fullMessage = `${caster.name} casts ${spell.name}! `;
        const spellAttackBonus = MechanicsEngine.getModifier(caster.stats['INT'] || caster.stats['WIS'] || caster.stats['CHA'] || 10) + MechanicsEngine.getProficiencyBonus(pc.level);
        const spellSaveDC = 8 + spellAttackBonus;

        for (const target of targets) {
            const result = CombatResolutionEngine.resolveSpell(caster, target, spell, spellAttackBonus, spellSaveDC);

            if (result.damage > 0) {
                await this.applyCombatDamage(target, result.damage);
                this.emitCombatEvent(result.type, target.id, result.damage);
            }
            if (result.heal > 0) {
                CombatResolutionEngine.applyHealing(target, result.heal);
                this.emitCombatEvent('HEAL', target.id, result.heal);
            }

            // Apply Conditions/Effects
            if (result.type !== 'MISS' && result.type !== 'SAVE_SUCCESS') {
                if (spell.effect?.category === 'CONTROL' && spell.condition) {
                    target.conditions.push(spell.condition);
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
            await this.executeSummon(caster, spell);
            fullMessage += `Allies have arrived!`;
        }

        // 5. Handle Concentration
        if (spell.concentration || spell.effect?.timing === 'CONCENTRATION') {
            if (caster.concentration) {
                fullMessage += ` (Ends concentration on ${caster.concentration.spellName})`;
                this.breakConcentration(caster);
            }
            caster.concentration = {
                spellName: spell.name,
                startTurn: combo.round
            };
        }

        // 6. Consume Slot
        if (spell.level > 0) {
            pc.spellSlots[spell.level.toString()].current--;
        }

        return fullMessage;
    }

    private breakConcentration(caster: Combatant) {
        const spellName = caster.concentration?.spellName;
        caster.concentration = undefined;

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
                type: 'summon',
                isPlayer: false, // ALLY NPC, not directly controlled by player UI
                hp: monsterData ? { current: monsterData.hp.average, max: monsterData.hp.average, temp: 0 } : { current: 10, max: 10, temp: 0 },
                ac: monsterData?.ac || 12,
                stats: (monsterData?.stats || { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10 }) as Record<string, number>,
                initiative: sharedInit,
                dexterityScore: monsterData?.stats['DEX'] || 10,
                spellSlots: {},
                preparedSpells: [],
                resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false },
                tactical: { cover: 'None', reach: 4, isRanged: false }, // Reach 4 = 1 cell (5ft) in hex/grid notation usually, or just 5
                conditions: [],
                statusEffects: [],
                concentration: undefined,
                position: caster.position, // Deploy nearby
                size: (monsterData?.size as any) || 'Medium',
                movementSpeed: 6,
                movementRemaining: 6,
                sourceId: caster.id
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

        await this.emitStateUpdate();
    }

    private getOrdinal(n: number): string {
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }

    private async handleExplorationCast(spellName: string): Promise<string> {
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
            await this.emitStateUpdate();
            return `You cast ${spell.name}, healing ${heal} HP. Current HP: ${pc.hp.current}/${pc.hp.max}`;
        }

        if (category === 'SUMMON') {
            // Out of combat summon adds a companion to state.companions for 1 hour
            // This is a simplified version for now
            return `You cast ${spell.name}. A companion arrives and will aid you in the coming struggles.`;
        }

        return `You cast ${spell.name}, but its primary effects are best seen in the heat of battle.`;
    }

    private async applyCombatDamage(target: Combatant, damage: number) {
        if (damage <= 0) return;

        CombatResolutionEngine.applyDamage(target, damage);

        // Concentration Check
        if (target.concentration && target.hp.current > 0) {
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

        await this.emitStateUpdate();
    }

    private async advanceCombatTurn() {
        const msg = this.combatManager.advanceTurn();
        this.addCombatLog(msg);

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
            while (this.state.combat && !await this.checkCombatEnd()) {
                const actor = this.state.combat.combatants[this.state.combat.currentTurnIndex];

                // --- 1. Reset Turn Economy ---
                actor.resources.actionSpent = false;
                actor.resources.bonusActionSpent = false;
                actor.movementRemaining = actor.movementSpeed;
                this.state.combat.turnActions = []; // NEW: Clear action list for the new turn

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
                await this.processStartOfTurn(actor);
                await this.emitStateUpdate();

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

                    // Compile NPC Turn Summary if multiple actions occurred, or just log the turn end
                    const npcSummary = this.state.combat.turnActions.length > 0
                        ? `${this.state.combat.turnActions.join(". ")}`
                        : `${actor.name} waits for an opening.`;
                    this.addCombatLog(npcSummary);
                    this.state.lastNarrative = npcSummary; // Push NPC actions to the narrative panel

                    // Pacing delay after action
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Move to NEXT in loop
                    if (!this.state.combat) break;

                    const nextMsg = this.combatManager.advanceTurn();
                    this.addCombatLog(nextMsg);
                    this.state.combat.turnActions = [];
                }
            }
        }
        catch (error) {
            console.error("Critical Error in processCombatQueue:", error);
        } finally {
            this.turnProcessing = false;
        }
    }

    private async processStartOfTurn(actor: Combatant) {
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

        // NOTE: Standard conditions in the current schema are string identifiers.
        // If we want them to have durations, we should use statusEffects for those.
        await this.emitStateUpdate();
    }

    private async performAITurn(actor: Combatant) {
        if (!this.state.combat) return;

        // Simplified Multi-Action Turn: MOVE then (potentially) ATTACK
        // D&D standard: Combatants can move then take an action.

        let actionsTaken = 0;
        const maxLoop = 2; // Prevent infinite loops if AI is indecisive

        while (actionsTaken < maxLoop && actor.hp.current > 0) {
            const action = CombatAI.decideAction(actor, this.state.combat);

            if (action.type === 'MOVE' && action.targetId) {
                const target = this.state.combat.combatants.find(c => c.id === action.targetId);
                if (target && this.combatManager && this.state.combat.grid) {
                    const gridManager = new CombatGridManager(this.state.combat.grid);
                    const path = gridManager.findPath(actor.position, target.position, this.state.combat.combatants);

                    if (path && path.length > 1) {
                        // If we are too far, maybe Dash (Sprint)?
                        // But NPCs currently have simple movement.
                        // Let's just move as far as standard movement allows.
                        const steps = Math.min(actor.movementRemaining, path.length - 2);

                        if (steps > 0) {
                            const dest = path[steps];
                            const moveMsg = this.combatManager.moveCombatant(actor, dest);
                            this.addCombatLog(moveMsg);
                            this.state.combat.turnActions.push(moveMsg); // Capture for summary
                        } else if (actor.movementRemaining > 0) {
                            // Can't move closer despite having movement? 
                            // This might happen if target is surrounded or path is blocked by 1-cell gap.
                            break;
                        } else {
                            break; // No movement left
                        }
                    } else {
                        break; // No path
                    }
                } else {
                    break;
                }
                actionsTaken++;
                // Continue loop to see if we satisfy attack range now
            } else if (action.type === 'ATTACK' && action.targetId) {
                const target = this.state.combat.combatants.find(c => c.id === action.targetId);
                if (!target) break;

                const strMod = MechanicsEngine.getModifier(actor.stats['STR'] || 10);
                const dexMod = MechanicsEngine.getModifier(actor.stats['DEX'] || 10);

                // NPC Action Selection logic
                const monsterData = DataManager.getMonster(actor.name);
                let attackBonus = strMod + 2;
                let damageFormula = "1d6";
                let dmgBonus = strMod;
                let forceDisadvantage = false;
                let rangePrefix = "";

                if (monsterData && monsterData.actions && monsterData.actions.length > 0) {
                    const preference = actor.tactical.isRanged ? 'range' : 'reach';
                    const actionData = monsterData.actions.find(a => a.description.toLowerCase().includes(preference)) || monsterData.actions[0];

                    // --- NPC AMMO / THROWN LOGIC ---
                    if (actor.tactical.isRanged) {
                        const ammoType = CombatUtils.getRequiredAmmunition(actionData.name || '');
                        const isThrown = actionData.description.toLowerCase().includes('thrown');

                        if (ammoType) {
                            if (actor.virtualAmmo === undefined) actor.virtualAmmo = 20; // Safety fallback
                            if (actor.virtualAmmo <= 0) {
                                this.addCombatLog(`${actor.name} reaches for an ${ammoType} but finds their quiver empty!`);
                                break;
                            }
                            actor.virtualAmmo--;
                        } else if (isThrown) {
                            if (actor.thrownActionUsed) {
                                this.addCombatLog(`${actor.name} has no more ${actionData.name}s to throw!`);
                                break;
                            }
                            actor.thrownActionUsed = true;
                        }
                    }

                    attackBonus = actionData.attackBonus !== undefined ? actionData.attackBonus : (actor.tactical.isRanged ? dexMod + 2 : strMod + 2);
                    damageFormula = actionData.damage || damageFormula;
                    dmgBonus = actor.tactical.isRanged ? dexMod : strMod;

                    // Range & Threatened Disadvantage
                    const gridManager = new CombatGridManager(this.state.combat.grid!);
                    const distance = gridManager.getDistance(actor.position, target.position);

                    if (actor.tactical.isRanged) {
                        if (actor.tactical.range && distance > Math.ceil(actor.tactical.range.normal / 5)) {
                            forceDisadvantage = true;
                            rangePrefix = "(Long Range! Disadvantage) ";
                        }
                        const isThreatened = this.state.combat.combatants.some(c =>
                            c.type !== actor.type && c.hp.current > 0 && gridManager.getDistance(actor.position, c.position) === 1
                        );
                        if (isThreatened) {
                            forceDisadvantage = true;
                            rangePrefix += "(Threatened! Disadvantage) ";
                        }
                    }

                    const result = CombatResolutionEngine.resolveAttack(actor, target, attackBonus, damageFormula, dmgBonus, forceDisadvantage);

                    this.state.combat.lastRoll = (result.details?.roll || 0) + (result.details?.modifier || 0);
                    this.emitCombatEvent(result.type, target.id, result.damage || 0);
                    await this.applyCombatDamage(target, result.damage);
                    if (target.isPlayer) this.state.character.hp.current = target.hp.current;

                    const logMsg = rangePrefix + CombatLogFormatter.format(result, actor.name, target.name, actor.tactical.isRanged);
                    this.addCombatLog(logMsg);
                    this.state.combat.turnActions.push(logMsg); // Capture for summary

                    break; // One attack per turn for most NPCs
                } else {
                    break; // No action decided
                }
            }
        }
    }

    public useAbility(abilityName: string): string {
        const char = this.state.character;
        const ability = AbilityParser.getCombatAbilities(char).find(a => a.name.toLowerCase() === abilityName.toLowerCase());

        if (!ability) return `You don't have an ability named "${abilityName}".`;

        const combat = this.state.combat;
        const currentCombatant = combat?.combatants[combat.currentTurnIndex];

        // Action Economy Check
        if (currentCombatant && ability.actionCost === 'ACTION' && currentCombatant.resources.actionSpent) {
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
            this.state.lastNarrative = result;
            if (ability.actionCost === 'ACTION') {
                currentCombatant.resources.actionSpent = true;
            } else if (ability.actionCost === 'BONUS_ACTION') {
                currentCombatant.resources.bonusActionSpent = true;
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

    private async checkCombatEnd(): Promise<boolean> {
        if (!this.state.combat) return false;

        const enemiesAlive = this.state.combat.combatants.some(c => c.type === 'enemy' && c.hp.current > 0);
        const playersAlive = this.state.combat.combatants.some(c => c.type === 'player' && c.hp.current > 0);

        if (!enemiesAlive || !playersAlive) {
            await this.endCombat(!enemiesAlive);
            return true;
        }

        return false;
    }

    private async endCombat(victory: boolean) {
        const combatState = this.state.combat;
        if (!combatState) return;

        const summaryMsg = victory
            ? "Victory! All enemies have been defeated."
            : "Defeat... You have been overcome by your foes.";

        this.addCombatLog(summaryMsg);

        // --- Award XP on Victory ---
        if (victory) {
            let totalXP = 0;
            // Get all enemies that were in the combat
            const enemies = combatState.combatants.filter(c => c.type === 'enemy');

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

            // Apply difficulty modifier from settings
            const difficulty = this.state.settings?.gameplay?.difficulty || 'normal';
            if (difficulty === 'hard') {
                totalXP = Math.floor(totalXP * 1.25);
                this.addCombatLog(`Bonus XP awarded for Hard difficulty!`);
            }

            const char = this.state.character;
            char.xp += totalXP;
            this.addCombatLog(`You gained ${totalXP} Experience Points! (Total: ${char.xp})`);

            // --- Generate Combat Loot ---
            const defeatedEnemies = combatState.combatants.filter(c => c.type === 'enemy');
            const totalLoot: any[] = [];
            let totalGold = 0;

            for (const enemy of defeatedEnemies) {
                const monsterData = DataManager.getMonster(enemy.name);
                if (monsterData) {
                    const loot = LootEngine.processDefeat(monsterData);
                    totalLoot.push(...loot.items);
                    totalGold += loot.gold.gp; // Assuming gp for simplicity in summary
                    // Add all currencies
                    char.inventory.gold.cp += loot.gold.cp;
                    char.inventory.gold.sp += loot.gold.sp;
                    char.inventory.gold.gp += loot.gold.gp;
                    char.inventory.gold.pp += loot.gold.pp;
                }
            }

            if (totalGold > 0 || totalLoot.length > 0) {
                this.addCombatLog(`Loot found: ${totalGold}gp and ${totalLoot.length} items!`);

                // Add instanceIds to loot items if missing
                const processedLoot = totalLoot.map(item => ({
                    ...item,
                    equipped: false,
                    instanceId: item.instanceId || `loot_${Date.now()}_${Math.random()}`
                }));

                if (!this.state.location.combatLoot) this.state.location.combatLoot = [];
                this.state.location.combatLoot.push(...processedLoot);
            }

            // Check for Level Up
            const nextThreshold = MechanicsEngine.getNextLevelXP(char.level);
            if (char.xp >= nextThreshold && char.level < 20) {
                char.level++;
                this.addCombatLog(`*** LEVEL UP! *** You have reached level ${char.level}!`);

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
            // CRITICAL FIX: Handle state transition BEFORE async calls to prevent race conditions
            this.state.mode = 'EXPLORATION';

            // Mark hex as cleared for the 4-hour window
            if (!this.state.clearedHexes) this.state.clearedHexes = {};
            this.state.clearedHexes[this.state.location.hexId] = this.state.worldTime.totalTurns;

            // Calculate time passed (Round * 6s) + 5 minutes recovery
            const combatSeconds = (combatState.round || 0) * 6;
            const totalMinutes = Math.ceil(combatSeconds / 60) + 5;
            this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, totalMinutes);

            // Clear combat state synchronously to avoid it persisting during async summary
            // But keep a reference for summary generation
            this.state.combat = undefined;
            await this.emitStateUpdate();

            // Trigger LLM Summarization safely
            try {
                const summary = await NarratorService.summarizeCombat(this.state, combatState.logs || []);
                // Only update narrative if we are still in exploration and haven't started a NEW combat
                if (this.state.mode === 'EXPLORATION' && !this.state.combat) {
                    this.state.lastNarrative = summary;
                    await this.emitStateUpdate();
                }
            } catch (error) {
                console.error("[GameLoop] Combat summary failed:", error);
            }

        } else {
            this.state.mode = 'GAME_OVER';
            await this.emitStateUpdate();
        }
    }

    public async pickupCombatLoot(instanceId: string) {
        if (!this.state.location.combatLoot) return;

        const itemIndex = this.state.location.combatLoot.findIndex(i => i.instanceId === instanceId);
        if (itemIndex === -1) return;

        const item = this.state.location.combatLoot[itemIndex];

        // Weight check
        const currentWeight = this.state.character.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
        const itemWeight = item.weight * (item.quantity || 1);
        const maxWeight = (this.state.character.stats.STR || 10) * 15;

        if (currentWeight + itemWeight > maxWeight) {
            this.addCombatLog(`Too heavy! You cannot carry any more.`);
            return;
        }

        // Add to inventory
        const existing = this.state.character.inventory.items.find(i => i.id === item.id && i.type !== 'Weapon' && i.type !== 'Armor');
        if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        } else {
            this.state.character.inventory.items.push({ ...item, equipped: false });
        }

        // Remove from loot
        this.state.location.combatLoot.splice(itemIndex, 1);
        this.addCombatLog(`Picked up ${item.name}.`);
        await this.emitStateUpdate();
    }

    private async recalculateAC() {
        const char = this.state.character;
        let baseAC = 10 + Math.floor(((char.stats.DEX || 10) - 10) / 2);

        // Add armor stats if we add AC to items later
        this.state.character.ac = baseAC;
        await this.emitStateUpdate();
    }

    public getState(): GameState {
        return this.state;
    }

    /**
     * Public API to get contextual tactical options for the player.
     * Used by the UI to display narrative maneuvers.
     */
    public getTacticalOptions(): TacticalOption[] {
        if (!this.state.combat || !this.state.combat.grid) return [];

        const player = this.state.combat.combatants.find(c => c.isPlayer);
        if (!player) return [];

        const gridManager = new CombatGridManager(this.state.combat.grid);
        const analysisEngine = new CombatAnalysisEngine(gridManager);

        // Get the current hex biome for context
        const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
        const biome = currentHex?.biome || 'Plains';

        return analysisEngine.getContextualOptions(
            player,
            this.state.combat.combatants,
            biome,
            this.state.combat.weather || { type: 'Clear', durationMinutes: 0, intensity: 1.0 },
            this.state.combat.selectedTargetId
        );
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
