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
import { CompanionManager } from './CompanionManager';
import { MovementEngine } from './MovementEngine';
import { GameStateManager } from './GameStateManager';
import { StoryScribe } from './StoryScribe';
import { DirectorService } from '../agents/DirectorService';
import { EngineDispatcher } from '../agents/EngineDispatcher';
import { CombatAnalysisEngine, TacticalOption } from './grid/CombatAnalysisEngine';
import { CODEX_LORE } from '../data/CodexRegistry';
import { CombatGridManager } from './grid/CombatGridManager';
import { IStorageProvider } from './IStorageProvider';
import { ProfileExtractor } from '../agents/ProfileExtractor';
import { ShopEngine } from './ShopEngine';

// New Managers
import { ExplorationManager } from './managers/ExplorationManager';
import { InventoryManager } from './managers/InventoryManager';
import { SpellManager } from './managers/SpellManager';
import { TimeManager } from './managers/TimeManager';
import { CombatOrchestrator } from './managers/CombatOrchestrator';
import { MERCHANT_POOLS, BIOME_COMMERCE, COMMON_ITEMS, DEFAULT_COMMERCE, getForgedItemsForMerchant } from '../data/MerchantInventoryPool';
import { SkillEngine } from './SkillEngine';
import { SkillAbilityEngine } from './SkillAbilityEngine';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { NPCMovementEngine } from './managers/NPCMovementEngine';
import { QuestEngine } from './managers/QuestEngine';
import { QuestGenerator } from './managers/QuestGenerator';
import { Dice } from './Dice';
import { ItemForgeEngine } from './ItemForgeEngine';
import { LevelingEngine } from './LevelingEngine';
import { GatheringEngine } from './GatheringEngine';
import { DowntimeEngine } from './DowntimeEngine';
import { ExportEngine } from './ExportEngine';
import { FactionEngine } from './FactionEngine';
import { MulticlassingEngine } from './MulticlassingEngine';
import { SpellbookEngine } from './SpellbookEngine';
import { MechanicsEngine } from './MechanicsEngine';
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
    private npcMovement: NPCMovementEngine;
    private questEngine: QuestEngine;
    private questGenerator: QuestGenerator;

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

        this.npcMovement = new NPCMovementEngine(
            this.state,
            this.hexMapManager,
            () => this.emitStateUpdate(),
            (msg) => {
                if (msg.startsWith('[NPC]')) {
                    this.addDebugLog(msg);
                } else {
                    this.addCombatLog(msg);
                }
            }
        );

        this.combatOrchestrator = new CombatOrchestrator(
            this.state,
            this.combatManager,
            this.contextManager,
            () => this.emitStateUpdate(),
            (msg) => this.addCombatLog(msg),
            (type, target, val) => this.emitCombatEvent(type, target, val)
        );

        this.questEngine = new QuestEngine(
            this.state,
            this.inventory,
            () => this.emitStateUpdate(),
            (msg) => this.addCombatLog(msg)
        );

        this.questGenerator = new QuestGenerator(
            this.state,
            this.hexMapManager,
            () => this.emitStateUpdate()
        );

        // Safety Check: Register any NPCs in the current hex on load
        // This catches cases where the player loads into a hex with NPCs but didn't "move" there
        this.scanCurrentHexForNpcs();

        // Emitter Fix (6B): Ensure initial scan state is propagated
        setTimeout(() => this.emitStateUpdate(), 0);
    }

    public async initialize() {
        // Migrate old save equipment slot names
        this.migrateEquipmentSlots();

        // Initial map expansion if needed
        await this.exploration.expandHorizon(this.state.location.coordinates as [number, number]);
        await this.emitStateUpdate();
    }

    /** Migrate old save files with legacy equipment slot names. */
    private migrateEquipmentSlots() {
        const slots = this.state.character.equipmentSlots as Record<string, string | undefined>;
        // hands → gloves
        if ((slots as any).hands) {
            slots.gloves = (slots as any).hands;
            delete (slots as any).hands;
        }
        // ring1 → leftRing1
        if ((slots as any).ring1) {
            slots.leftRing1 = (slots as any).ring1;
            delete (slots as any).ring1;
        }
        // ring2 → rightRing1
        if ((slots as any).ring2) {
            slots.rightRing1 = (slots as any).ring2;
            delete (slots as any).ring2;
        }
    }

    /**
     * Main entry point for player input.
     */
    public async processTurn(input: string): Promise<string> {
        // Clear one-shot UI signals from previous turn
        this.state.lastSkillCheck = undefined;

        // DIALOGUE MODE INTERCEPT
        if (this.state.activeDialogueNpcId && this.state.mode === 'EXPLORATION') {
            const dialogueIntent = IntentRouter.parse(input, false);

            // Allow /endtalk to exit, and other commands to trigger/exit
            if (dialogueIntent.type === 'COMMAND') {
                if (dialogueIntent.command === 'endtalk') {
                    this.state.activeDialogueNpcId = null;
                    await this.emitStateUpdate();
                    return "You end the conversation.";
                }
                // Any other command exits dialogue mode first
                this.state.activeDialogueNpcId = null;
                await this.emitStateUpdate();
                return await this.handleCommand(dialogueIntent);
            }

            // Route ALL free-text input to NPCService
            const npc = this.state.worldNpcs.find(n => n.id === this.state.activeDialogueNpcId);
            if (!npc) {
                this.state.activeDialogueNpcId = null;
                await this.emitStateUpdate();
                return "The person you were talking to is no longer here.";
            }

            try {
                const response = await NPCService.generateDialogue(this.state, npc, input);
                if (response) {
                    await this.updateNpcProfiles(response, [npc]);

                    // C4: Relationship delta — evaluate if narrator didn't handle it
                    // (lightweight fallback LLM call for dialogue relationship tracking)
                    try {
                        const deltaResult = await NPCService.evaluateRelationshipDelta(npc, input, response);
                        if (deltaResult && deltaResult.delta !== 0) {
                            npc.relationship.standing = Math.max(-100, Math.min(100, npc.relationship.standing + deltaResult.delta));
                            npc.relationship.interactionLog = npc.relationship.interactionLog || [];
                            npc.relationship.interactionLog.push({
                                event: deltaResult.reason,
                                delta: deltaResult.delta,
                                timestamp: new Date().toISOString()
                            });
                            npc.relationship.lastInteraction = new Date().toISOString();
                            console.log(`[GameLoop] Dialogue relationship delta: ${npc.name} ${deltaResult.delta > 0 ? '+' : ''}${deltaResult.delta} (${deltaResult.reason})`);
                        }
                    } catch (relErr) {
                        console.warn('[GameLoop] Relationship delta eval failed (non-critical):', relErr);
                    }
                }

                // History Update
                const turn = this.state.worldTime.totalTurns;
                this.state.conversationHistory.push({ role: 'player', content: input, turnNumber: turn });
                this.state.conversationHistory.push({ role: 'narrator', content: `**${npc.name}:** ${response || '...'}`, turnNumber: turn });

                // CRITICAL: Set lastNarrative so the UI displays the response
                const formattedResponse = response ? `**${npc.name}:** ${response}` : `${npc.name} stays silent.`;
                this.state.lastNarrative = formattedResponse;

                await this.emitStateUpdate();
                return formattedResponse;
            } catch (e: any) {
                console.error('[GameLoop] Dialogue failed:', e);
                const errorMsg = `${npc.name} seems unable to respond. (Dialogue generation failed: ${e.message})`;
                this.state.lastNarrative = errorMsg;
                await this.emitStateUpdate();
                return errorMsg;
            }
        }

        const intent = IntentRouter.parse(input, this.state.mode === 'COMBAT');

        let systemResponse = '';

        if (intent.type === 'COMMAND') {
            systemResponse = await this.handleCommand(intent);

            // Trade and examination commands are fully deterministic — bypass the LLM narrator pipeline entirely.
            const tradeCommands = ['trade', 'buy', 'sell', 'haggle', 'intimidate', 'deceive', 'buyback', 'closetrade', 'examine', 'identify', 'merchantidentify',
                'levelup', 'level', 'invest', 'resetskills', 'asi', 'feat', 'multiclass', 'skillability', 'ability', 'chooseability', 'use'];
            if (tradeCommands.includes(intent.command || '')) {
                this.state.lastNarrative = systemResponse;
                await this.emitStateUpdate();
                return systemResponse;
            }
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

            try {
                // Narrator Generation
                const narratorResponse = await NarratorService.generate(
                    this.state,
                    this.hexMapManager,
                    input,
                    this.contextManager.getRecentHistory(10),
                    directive
                );

                if (narratorResponse.narrative_output.includes('[System Error]')) {
                    throw new Error(narratorResponse.narrative_output.replace('[System Error] Narrative generation failed: ', ''));
                }

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

                // Sync Narrative State (Only on SUCCESS)
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

                // Step 5: Extract facts from narrator output — only for NPCs actually referenced
                if (currentHex?.npcs && currentHex.npcs.length > 0) {
                    const npcsInHex = this.state.worldNpcs.filter(n => currentHex.npcs!.includes(n.id));
                    // Two-tier check: exact name match OR interaction signal patterns
                    const interactionSignals = /\b(says?|speaks?|tells?|asks?|replies?|nods?|whispers?|shouts?|gestures?|offers?|greets?|waves?|approaches?)\b/i;
                    const mentionedNpcs = npcsInHex.filter(n =>
                        narratorOutput.includes(n.name) ||
                        (interactionSignals.test(narratorOutput) && npcsInHex.length === 1) // Single NPC + interaction verb = likely about them
                    );
                    if (mentionedNpcs.length > 0) {
                        await this.updateNpcProfiles(narratorOutput, mentionedNpcs);
                    }
                }

                systemResponse = systemResponse ? `${systemResponse}\n\n${narratorOutput}` : narratorOutput;
            } catch (e: any) {
                console.error('[GameLoop] Narrative Generation Failed:', e);

                const turn = this.state.worldTime.totalTurns;
                // Log to history as system so it shows in Right Panel
                this.state.conversationHistory.push({
                    role: 'system',
                    content: `[System Error] Narrative generation failed: ${e.message}`,
                    turnNumber: turn
                });

                // Trigger volatile notification for UI Overlay
                this.state.notifications.push({
                    id: `err_${Date.now()}`,
                    type: 'SYSTEM_ERROR' as any,
                    message: e.message,
                    data: null,
                    isRead: false,
                    createdAt: Date.now()
                });

                // Fallback system response if command was processed
                if (!systemResponse) systemResponse = `[System Error] ${e.message}`;
            }

            // Time Advancement (5 mins per turn)
            if (intent.type !== 'COMMAND') {
                const encounter = await this.time.advanceTimeAndProcess(5);
                this.npcMovement.processTurn(this.state.worldTime.totalTurns);
                await this.questEngine.checkDeadlines(this.state.worldTime.totalTurns);
                await this.questGenerator.processTurn(this.state.worldTime.totalTurns);
                if (encounter) {
                    await this.initializeCombat(encounter);
                    // Append to existing narrative if success, or just state it if fail
                    systemResponse += `\n\n[AMBUSH] You are interrupted by ${encounter.description}`;
                }
            }

            // Scribe summarization
            await this.scribe.processTurn(this.state, this.contextManager.getRecentHistory(10));
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
                const startCoords = [...this.state.location.coordinates] as [number, number];
                const startHex = this.hexMapManager.getHex(`${startCoords[0]},${startCoords[1]}`);
                const targetCoords_guess = HexMapManager.getNewCoords(startCoords, direction);
                const sideIndex = HexMapManager.getSideIndex(startCoords, targetCoords_guess);
                const connection = startHex ? this.hexMapManager.getConnection(startHex, sideIndex) : null;
                const isFindThePathActive = this.state.worldTime.totalTurns < this.state.findThePathActiveUntil;

                // Road connection exists? (Discovered OR Find the Path active)
                const hasInfrastructure = !!((isFindThePathActive || (connection && connection.discovered)) && this.state.travelPace !== 'Stealth');

                const pace = this.state.travelPace || 'Normal';
                const hasInfra: boolean = hasInfrastructure;
                const result = this.movementEngine.move(startCoords, direction, pace as any, hasInfra);
                if (!result.success) return result.message || "Can't move there.";

                const targetCoords = result.newHex!.coordinates;

                // Clear buyback eligibility on move
                this.clearBuybackEligibility();


                // --- Connectivity & Curve Logic ---
                let curvatureX: number;
                let curvatureY: number;
                let travelType: 'Road' | 'Path' | 'Ancient' | 'Stealth' | 'Wilderness' = 'Wilderness';
                let infraSpeedMod = 1.0;

                if (hasInfrastructure) {
                    const typeCode: 'R' | 'P' | 'A' | 'D' = (connection?.type as any) || (isFindThePathActive ? 'R' : 'P');
                    if (typeCode === 'A') {
                        travelType = 'Ancient';
                        infraSpeedMod = 0.4;
                    } else if (typeCode === 'R') {
                        travelType = 'Road';
                        infraSpeedMod = 0.5;
                    } else {
                        // Path and Disappearing both grant Path-level benefits
                        travelType = 'Path';
                        infraSpeedMod = 0.75;
                    }

                    // Deterministic Curve (seeded by coordinates to ensure visual consistency)
                    const seed = (startCoords[0] * 131 + startCoords[1] * 7 + targetCoords[0] * 31 + targetCoords[1] * 3) % 1000;
                    const pseudoRand = (s: number) => ((s * 9301 + 49297) % 233280) / 233280;
                    curvatureX = (pseudoRand(seed) * 0.8 - 0.4); // Tighter deviation for roads
                    curvatureY = (pseudoRand(seed + 1) * 0.8 - 0.4);
                } else {
                    if (this.state.travelPace === 'Stealth') {
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
                    duration: durationMs,
                    travelType: travelType as any
                };

                // Notify UI of start
                await this.emitStateUpdate();

                // Wait for animation (skip in CLI/Node mode)
                if (typeof window !== 'undefined') {
                    await new Promise(resolve => setTimeout(resolve, durationMs));
                }

                // Arrived
                this.state.location.previousPreviousCoordinates = this.state.location.previousCoordinates;
                this.state.location.previousCoordinates = startCoords;
                this.state.location.previousControlPointOffset = [curvatureX, curvatureY];
                this.state.location.coordinates = targetCoords;
                this.state.location.hexId = `${targetCoords[0]},${targetCoords[1]}`;
                this.state.location.travelAnimation = undefined;

                // Companions with followState='following' travel with the player automatically.
                // Waiting companions stay at their waitHexId. No explicit position tracking needed
                // since following companions are always at the player's hex by definition.

                // Step 2: Register encounter with NPCs in the arrived hex
                const arrivedHex = this.hexMapManager.getHex(this.state.location.hexId);
                if (arrivedHex?.npcs) {
                    for (const npcId of arrivedHex.npcs) {
                        this.registerNpcEncounter(npcId);
                    }
                }

                // Advance time for travel (apply infrastructure modifier to game time too)
                // Pass travelType to process encounters (§4.3)
                const adjustedTimeCost = Math.max(1, Math.round(result.timeCost * infraSpeedMod));
                const encounter = await this.time.advanceTimeAndProcess(adjustedTimeCost, false, travelType);
                await this.exploration.expandHorizon(this.state.location.coordinates);
                await this.time.trackTutorialEvent('moved_hex');

                if (encounter) {
                    await this.initializeCombat(encounter);
                    return `You move ${direction}. Suddenly, you are ambushed!`;
                }

                const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
                let discoveredPath = false;

                // Survival Passive Discovery (Phase 3) — tier-based
                const survivalTier = SkillEngine.getSkillTier(this.state.character, 'Survival');
                if (currentHex && currentHex.connections && survivalTier > 0) {
                    // Survival T3 passive: always discover hidden paths (auto-succeed)
                    const autoSucceed = SkillAbilityEngine.hasPassiveAbility(this.state.character, 'Survival', 3);
                    const roll = autoSucceed ? 20 : Math.floor(Math.random() * 20) + 1;
                    const wisScore = this.state.character.stats['WIS'] || 10;
                    const wisMod = Math.floor((wisScore - 10) / 2);
                    const baseProfBonus = MechanicsEngine.getProficiencyBonus(this.state.character.level);
                    const proficiencyBonus = baseProfBonus * SkillEngine.getTierMultiplier('Survival', survivalTier);
                    const total = roll + wisMod + proficiencyBonus;

                    // Biome-Scaled DC (§5.4)
                    const biome = currentHex.biome;
                    let dc = 15;
                    if (biome === 'Forest' || biome === 'Hills') dc = 14;
                    else if (biome === 'Swamp' || biome === 'Jungle' || biome === 'Mountains') dc = 16;
                    else if (biome === 'Volcanic' || biome === 'Ruins') dc = 18;

                    if (total >= dc) {
                        const connections = currentHex.connections.split(',');
                        let foundIndex = -1;
                        const updatedConnections = connections.map((c, i) => {
                            const [side, type, disco] = c.split(':');
                            if ((type === 'P' || type === 'A') && disco === '0') {
                                foundIndex = i;
                                return `${side}:${type}:1`;
                            }
                            return c;
                        });

                        if (foundIndex !== -1) {
                            currentHex.connections = updatedConnections.join(',');
                            await this.hexMapManager.setHex(currentHex);
                            discoveredPath = true;
                        }
                    }
                }

                // Varied Narrative
                const targetBiome = currentHex?.biome || 'wilderness';
                let narrativeMessage = `You travel ${direction} through the ${targetBiome}.`;

                if (travelType === 'Road') narrativeMessage = `You follow the road ${direction} into the ${targetBiome}.`;
                else if (travelType === 'Path') narrativeMessage = `You follow a narrow trail ${direction} through the ${targetBiome}.`;
                else if (travelType === 'Stealth') narrativeMessage = `You move stealthily ${direction}, avoiding the main paths as you enter the ${targetBiome}.`;

                if (discoveredPath) {
                    narrativeMessage += `\n\nYour keen instincts reveal a hidden trail in this area.`;
                }

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
                const startCoordsMT = [...this.state.location.coordinates] as [number, number];

                // Infrastructure detection (mirrors 'move' command logic)
                const startHexMT = this.hexMapManager.getHex(`${startCoordsMT[0]},${startCoordsMT[1]}`);
                const sideIndexMT = HexMapManager.getSideIndex(startCoordsMT, [q, r]);
                const connectionMT = startHexMT ? this.hexMapManager.getConnection(startHexMT, sideIndexMT) : null;
                const isFindThePathActiveMT = this.state.worldTime.totalTurns < this.state.findThePathActiveUntil;
                const hasInfraMT = !!((isFindThePathActiveMT || (connectionMT && connectionMT.discovered)) && this.state.travelPace !== 'Stealth');

                const moveResult = this.movementEngine.move(this.state.location.coordinates, [q, r], this.state.travelPace as any, hasInfraMT);
                if (!moveResult.success) return moveResult.message;

                const targetCoordsMT = moveResult.newHex!.coordinates;

                // Determine travel type and speed from connection data
                let travelTypeMT: 'Road' | 'Path' | 'Ancient' | 'Stealth' | 'Wilderness' = 'Wilderness';
                let infraSpeedModMT = 1.0;

                if (hasInfraMT) {
                    const typeCodeMT: 'R' | 'P' | 'A' | 'D' = (connectionMT?.type as any) || (isFindThePathActiveMT ? 'R' : 'P');
                    if (typeCodeMT === 'A') {
                        travelTypeMT = 'Ancient';
                        infraSpeedModMT = 0.4;
                    } else if (typeCodeMT === 'R') {
                        travelTypeMT = 'Road';
                        infraSpeedModMT = 0.5;
                    } else {
                        travelTypeMT = 'Path';
                        infraSpeedModMT = 0.75;
                    }
                } else if (this.state.travelPace === 'Stealth') {
                    travelTypeMT = 'Stealth';
                }

                const baseDurationMsMT = (moveResult.timeCost * infraSpeedModMT) * (1000 / 60);

                // --- Curve Calculation ---
                const randMT = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
                const curvatureXMT = hasInfraMT ? (Math.random() * 0.8 - 0.4) : randMT() * 1.5;
                const curvatureYMT = hasInfraMT ? (Math.random() * 0.8 - 0.4) : randMT() * 1.5;
                const curveFactorMT = 1 + (Math.abs(curvatureXMT) + Math.abs(curvatureYMT)) * 0.2;
                const durationMsMT = Math.round(baseDurationMsMT * curveFactorMT);

                // 1. Set Animation State
                this.state.location.travelAnimation = {
                    startCoordinates: startCoordsMT,
                    targetCoordinates: targetCoordsMT,
                    controlPointOffset: [curvatureXMT, curvatureYMT],
                    startTime: Date.now(),
                    duration: durationMsMT,
                    travelType: travelTypeMT
                };
                await this.emitStateUpdate();

                // 2. Wait for animation (skip in CLI/Node mode)
                if (typeof window !== 'undefined') {
                    await new Promise(resolve => setTimeout(resolve, durationMsMT));
                }

                // 3. Finalize Movement
                this.state.location.previousPreviousCoordinates = this.state.location.previousCoordinates;
                this.state.location.previousCoordinates = startCoordsMT;
                this.state.location.previousControlPointOffset = [curvatureXMT, curvatureYMT];
                this.state.location.coordinates = targetCoordsMT;
                this.state.location.hexId = `${targetCoordsMT[0]},${targetCoordsMT[1]}`;
                this.state.location.travelAnimation = undefined;

                // Step 2: Register encounter with NPCs in the arrived hex
                const arrivedHexMT = this.hexMapManager.getHex(this.state.location.hexId);
                if (arrivedHexMT?.npcs) {
                    for (const npcId of arrivedHexMT.npcs) {
                        this.registerNpcEncounter(npcId);
                    }
                }

                const adjustedTimeCostMT = Math.max(1, Math.round(moveResult.timeCost * infraSpeedModMT));
                const enc = await this.time.advanceTimeAndProcess(adjustedTimeCostMT, false, travelTypeMT);
                this.npcMovement.processTurn(this.state.worldTime.totalTurns);
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

            case 'unequip':
                if (!args[0]) return "Usage: /unequip <slot> (e.g., mainHand, armor, head)";
                return await this.inventory.unequipFromSlot(args[0]);

            case 'wait': {
                const minutes = parseInt(args[0] || '60');
                const waitEnc = await this.time.advanceTimeAndProcess(minutes);
                if (waitEnc) {
                    const ambushNarration = await this.generateAmbushNarration(waitEnc, 'wait');
                    await this.initializeCombat(waitEnc, ambushNarration);
                    return ambushNarration;
                }
                return (await this.completeRest(minutes, 'wait')).narration;
            }

            case 'rest': {
                const restArg = (args[0] || '480').toLowerCase();
                const duration = restArg === 'short' ? 60 : restArg === 'long' ? 480 : parseInt(restArg) || 480;
                const restEnc = await this.time.advanceTimeAndProcess(duration, true);
                if (restEnc) {
                    const ambushNarration = await this.generateAmbushNarration(restEnc, 'rest');
                    await this.initializeCombat(restEnc, ambushNarration);
                    return ambushNarration;
                }
                const restOut = await this.completeRest(duration);
                let msg = restOut.narration;
                if (restOut.arcaneRecoveryAvailable) {
                    msg += `\n[Arcane Recovery available: recover up to ${restOut.arcaneRecoveryBudget} levels of spell slots (max 5th level). Use /arcanerecovery <level> <count> ...]`;
                }
                return msg;
            }

            case 'cast': {
                if (!args[0]) return "Usage: /cast <spell name> [target] [slot level]";
                // Parse: /cast "Fireball" target_id 5  OR  /cast Fireball target_id  OR  /cast Fireball 5
                let castSpellName = args[0];
                let castTarget: string | undefined;
                let castSlot: number | undefined;
                // Check if last arg is a number (slot level)
                const lastArg = args[args.length - 1];
                if (args.length >= 2 && /^\d+$/.test(lastArg)) {
                    castSlot = parseInt(lastArg);
                    castTarget = args.length >= 3 ? args[1] : undefined;
                } else {
                    castTarget = args[1];
                }
                return await this.spells.castSpell(castSpellName, castTarget, castSlot);
            }

            case 'pace':
                this.state.travelPace = args[0] as any;
                await this.emitStateUpdate();
                return `Travel mode set to ${args[0]}.`;

            case 'survey': {
                const centerHex = this.hexMapManager.getHex(this.state.location.hexId);
                if (!centerHex) return "Error: Current hex not found.";

                // 1. Requirements Check
                if (!this.inventory.hasItem("Cartographer's tools")) return "You need Cartographer's tools to survey the area.";
                if (!this.inventory.hasItem("Ink (1 ounce bottle)")) return "You need Ink to survey the area.";
                if (!this.inventory.hasItem("Parchment (one sheet)")) return "You need Parchment to survey the area.";

                // 2. Consume Resources (Consumed regardless of success/failure)
                await this.inventory.consumeCharge("Ink (1 ounce bottle)");
                await this.inventory.consumeQuantity("Parchment (one sheet)", 1);

                // 3. Skill Check
                // Formula (§5.3): 1d20 + INT_score + floor(WIS_score / 2) + ProficiencyBonus
                const pc = this.state.character;
                const intScore = pc.stats['INT'] || 10;
                const wisScore = pc.stats['WIS'] || 10;

                const cartoTier = SkillEngine.getSkillTier(pc, 'Cartography');
                const profBonus = cartoTier > 0 ? MechanicsEngine.getProficiencyBonus(pc.level) * SkillEngine.getTierMultiplier('Cartography', cartoTier) : 0;
                const roll = Math.floor(Math.random() * 20) + 1;
                const total = roll + intScore + Math.floor(wisScore / 2) + profBonus;

                // DC Table
                const dcMap: Record<string, number> = {
                    'Plains': 12, 'Farmland': 12, 'Urban': 12,
                    'Forest': 15, 'Hills': 15,
                    'Swamp': 18, 'Jungle': 18, 'Mountains': 18, 'Mountain_High': 18
                };
                const dc = dcMap[centerHex.biome] || 15;

                if (total < dc) {
                    await this.emitStateUpdate();
                    return "Your survey yields only rough sketches. The supplies are spent, but no useful map emerges.";
                }

                // 4. Success
                const revealed = await this.exploration.surveyArea(this.state.location.coordinates);
                await this.emitStateUpdate();
                return `Through meticulous measurement and sketching, you successfully survey the region. \n\nRevealed ${revealed} new connections and uncharted terrain features.`;
            }

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

            case 'trade': {
                const npcId = args[0];
                const npc = this.state.worldNpcs.find(n => n.id === npcId);
                if (!npc) return "No such NPC found.";
                if (!npc.isMerchant) return `${npc.name} is not interested in trading.`;

                // Validate NPC is in current hex
                const tradeHex = this.state.worldMap?.hexes?.[this.state.location.hexId];
                if (!tradeHex?.npcs?.includes(npcId)) return `${npc.name} is not here.`;

                this.state.activeTradeNpcId = npcId;
                return `Opened trade with ${npc.name}.`;
            }

            case 'buy': {
                if (!this.state.activeTradeNpcId) return "No active trade.";
                const itemName = args.join(' ');
                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                const itemData = DataManager.getItem(itemName);
                if (!npc || !itemData) return "Transaction error: NPC or Item not found.";

                return ShopEngine.buyItem(this.state.character, itemData, npc);
            }

            case 'sell': {
                if (!this.state.activeTradeNpcId) return "No active trade.";
                const itemName = args.join(' ');
                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                const pcItem = this.state.character.inventory.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
                if (!pcItem) return `You don't have a ${itemName}.`;

                const itemData = DataManager.getItem(pcItem.name);
                if (!npc || !itemData) return "Transaction error.";

                return ShopEngine.sellItem(this.state.character, pcItem.id, npc, itemData);
            }

            case 'haggle': {
                if (!this.state.activeTradeNpcId) return "No active trade.";
                const itemName = args.join(' ');
                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                if (!npc) return "NPC not found.";

                const result = ShopEngine.negotiate(this.state.character, npc, itemName, this.state.worldTime.totalTurns);
                return result.message;
            }

            case 'intimidate': {
                if (!this.state.activeTradeNpcId) return "No active trade.";
                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                if (!npc) return "NPC not found.";

                const result = ShopEngine.intimidate(this.state.character, npc);
                return result.message;
            }

            case 'deceive': {
                if (!this.state.activeTradeNpcId) return "No active trade.";
                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                if (!npc) return "NPC not found.";

                const result = ShopEngine.deceive(this.state.character, npc);
                return result.message;
            }

            case 'buyback': {
                if (!this.state.activeTradeNpcId) return "No active trade.";
                const itemName = args.join(' ');
                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                if (!npc) return "NPC not found.";

                return ShopEngine.buybackItem(this.state.character, npc, itemName);
            }

            case 'closetrade': {
                this.state.activeTradeNpcId = null;
                return "Closed trading.";
            }

            case 'examine':
            case 'identify': {
                const examineTarget = args.join(' ');
                if (!examineTarget) return "Usage: /examine <item name>";

                const examineItem = this.state.character.inventory.items.find(
                    (i: any) => i.name.toLowerCase() === examineTarget.toLowerCase()
                        || i.instanceId === examineTarget
                );
                if (!examineItem) return `You don't have "${examineTarget}".`;
                if ((examineItem as any).identified !== false) return `${examineItem.name} is already fully identified.`;

                // Check if character has any identification capability
                const arcanaTier = SkillEngine.getSkillTier(this.state.character, 'Arcana');
                const investigationTier = SkillEngine.getSkillTier(this.state.character, 'Investigation');
                const bestTier = Math.max(arcanaTier, investigationTier);
                if (bestTier === 0) {
                    return `${this.state.character.name} lacks the Arcana or Investigation skill to examine this item. Visit a merchant for identification.`;
                }

                // Tier-based daily attempts: T1=1, T2=2, T3=3, T4=3
                const maxAttempts = Math.min(3, bestTier);
                const currentTurn = this.state.worldTime.totalTurns;
                const cooldownTurns = 14400; // 24h at 6s/turn

                // Track attempts as array of turn numbers (with corruption guard)
                if (!this.state._examineCooldowns) this.state._examineCooldowns = { examine_attempts: [] };
                const rawAttempts = this.state._examineCooldowns.examine_attempts;
                const attempts: number[] = Array.isArray(rawAttempts) ? rawAttempts : [];
                // Filter to only recent attempts (within 24h)
                const recentAttempts = attempts.filter((t: number) => (currentTurn - t) < cooldownTurns);
                if (recentAttempts.length >= maxAttempts) {
                    return ''; // UI handles cooldown via disabled button + tooltip
                }

                const dc = ItemForgeEngine.getIdentifyDC(examineItem);
                const bestSkill = arcanaTier >= investigationTier ? 'Arcana' : 'Investigation';

                // Arcana T3 passive: auto-succeed on Rare items
                const trueRarity = (examineItem as any).trueRarity || (examineItem as any).rarity;
                if (trueRarity === 'Rare' && SkillAbilityEngine.hasPassiveAbility(this.state.character, 'Arcana', 3)) {
                    ItemForgeEngine.identifyItem(examineItem, 'skill');
                    recentAttempts.push(currentTurn);
                    this.state._examineCooldowns.examine_attempts = recentAttempts;
                    await this.emitStateUpdate();
                    const narrative = `Your arcane intuition reveals the item's true nature instantly: ${examineItem.name} (${(examineItem as any).rarity}).`;
                    this.state.lastNarrative = narrative;
                    return narrative;
                }

                // Arcana T4 passive: auto-identify on examine (Rare and below)
                if (['Common', 'Uncommon', 'Rare'].includes(trueRarity) && SkillAbilityEngine.hasPassiveAbility(this.state.character, 'Arcana', 4)) {
                    ItemForgeEngine.identifyItem(examineItem, 'skill');
                    await this.emitStateUpdate();
                    const narrative = `Your mastery of the arcane instantly reveals: ${examineItem.name} (${(examineItem as any).rarity}).`;
                    this.state.lastNarrative = narrative;
                    return narrative;
                }

                const intMod = MechanicsEngine.getModifier(this.state.character.stats.INT || 10);
                const prof = MechanicsEngine.getProficiencyBonus(this.state.character.level) * SkillEngine.getTierMultiplier(bestSkill, bestTier);
                const roll = Dice.d20();
                const total = roll + intMod + prof;

                // Track attempt
                recentAttempts.push(currentTurn);
                this.state._examineCooldowns.examine_attempts = recentAttempts;

                // Emit structured dice data for UI overlay
                this.state.lastSkillCheck = {
                    id: `sk_${Date.now()}`,
                    dieValue: roll,
                    modifier: intMod + prof,
                    total,
                    dc,
                    success: total >= dc,
                    skillName: bestSkill,
                    label: `${bestSkill} Check`,
                };
                await this.emitStateUpdate();

                if (total >= dc) {
                    ItemForgeEngine.identifyItem(examineItem, 'skill');
                    await this.emitStateUpdate();

                    // Generate immersive identification narrative
                    let narrative = '';
                    try {
                        narrative = await LoreService.generateIdentificationNarrative(
                            examineItem,
                            this.state.character.name,
                            bestSkill,
                        );
                        if (narrative) {
                            (examineItem as any).lore = narrative;
                            (examineItem as any).description = narrative;
                            await this.emitStateUpdate();
                        }
                    } catch { /* LLM failure is non-critical */ }

                    // Fallback if LLM fails
                    if (!narrative) {
                        const magicDesc = ((examineItem as any).magicalProperties || [])
                            .map((mp: any) => mp.description || `${mp.dice || ''} ${mp.element || ''} ${mp.type}`.trim())
                            .filter(Boolean).join('; ');
                        narrative = `Through careful examination, the item's true nature is revealed: ${examineItem.name} (${(examineItem as any).rarity}).` +
                            (magicDesc ? ` Magical properties: ${magicDesc}.` : '');
                    }

                    this.state.lastNarrative = narrative;
                    return narrative;
                } else {
                    await this.emitStateUpdate();

                    // Generate immersive failure narrative
                    let failNarrative = '';
                    try {
                        failNarrative = await LoreService.generateIdentificationFailure(
                            this.state.character.name,
                            bestSkill,
                            examineItem.name,
                        );
                    } catch { /* non-critical */ }

                    if (!failNarrative) {
                        failNarrative = `${this.state.character.name} studies the item intently, but its true nature remains hidden. The secrets within resist revelation. Perhaps another attempt after resting will yield different results.`;
                    }

                    this.state.lastNarrative = failNarrative;
                    return failNarrative;
                }
            }

            case 'merchantidentify': {
                if (!this.state.activeTradeNpcId) return "No active trade. Open trade with a merchant first.";
                const identTarget = args.join(' ');
                if (!identTarget) return "Usage: /merchantidentify <item name>";

                const npc = this.state.worldNpcs.find(n => n.id === this.state.activeTradeNpcId);
                if (!npc) return "Merchant not found.";

                const identItem = this.state.character.inventory.items.find(
                    (i: any) => i.name.toLowerCase() === identTarget.toLowerCase()
                        || i.instanceId === identTarget
                );
                if (!identItem) return `You don't have "${identTarget}".`;
                if ((identItem as any).identified !== false) return `${identItem.name} is already identified.`;

                const costGp = ItemForgeEngine.getMerchantIdentifyCost(identItem);
                const standing = npc.relationship?.standing || 0;
                const standingMod = ShopEngine.getStandingModifier(standing);
                const finalCost = Math.max(1, Math.round(costGp * standingMod));

                if (this.state.character.inventory.gold.gp < finalCost) {
                    return `The merchant offers to identify this item for ${finalCost}gp. You can't afford it.`;
                }

                this.state.character.inventory.gold.gp -= finalCost;
                npc.shopState!.gold += finalCost;
                const msg = ItemForgeEngine.identifyItem(identItem, 'merchant');
                await this.emitStateUpdate();
                return `Paid ${finalCost}gp. ${msg}`;
            }

            case 'talk': {
                const npcIdOrName = args.join(' ');
                const npcToTalk = this.state.worldNpcs.find(n =>
                    n.id === npcIdOrName || n.name.toLowerCase() === npcIdOrName.toLowerCase()
                );

                if (!npcToTalk) return `You don't see anyone named "${npcIdOrName}" here.`;

                // Check if NPC is in current hex
                const currentHexForTalk = this.hexMapManager.getHex(this.state.location.hexId);
                if (!currentHexForTalk?.npcs?.includes(npcToTalk.id)) {
                    return `${npcToTalk.name} is not in this location.`;
                }

                this.state.activeDialogueNpcId = npcToTalk.id;
                await this.emitStateUpdate();

                // Generate initial greeting
                try {
                    const greeting = await NPCService.generateDialogue(this.state, npcToTalk, "[GREETING / START CONVERSATION]");
                    if (greeting) {
                        await this.updateNpcProfiles(greeting, [npcToTalk]);
                    }
                    await this.emitStateUpdate();

                    // History Update
                    const turnStart = this.state.worldTime.totalTurns;
                    this.state.conversationHistory.push({ role: 'narrator', content: `**${npcToTalk.name}:** ${greeting || '...'}`, turnNumber: turnStart });

                    return greeting ? `**${npcToTalk.name}:** ${greeting}` : `${npcToTalk.name} acknowledges you.`;
                } catch (e) {
                    return `You approach ${npcToTalk.name}, but they are occupied.`;
                }
            }
            case 'endtalk':
                this.state.activeDialogueNpcId = null;
                await this.emitStateUpdate();
                return "You end the conversation.";

            // ===== COMPANION MANAGEMENT =====
            case 'companion_wait': {
                const waitName = args.join(' ');
                const waitIdx = CompanionManager.findCompanionIndex(this.state, waitName);
                if (waitIdx < 0) return `No companion named "${waitName}" in your party.`;
                const waitMsg = CompanionManager.setWait(this.state, waitIdx);
                await this.emitStateUpdate();
                return waitMsg;
            }
            case 'companion_follow': {
                const followName = args.join(' ');
                const followIdx = CompanionManager.findCompanionIndex(this.state, followName);
                if (followIdx < 0) return `No companion named "${followName}" in your party.`;
                const followMsg = CompanionManager.setFollow(this.state, followIdx);
                await this.emitStateUpdate();
                return followMsg;
            }
            case 'dismiss_companion': {
                const dismissName = args.join(' ');
                const dismissIdx = CompanionManager.findCompanionIndex(this.state, dismissName);
                if (dismissIdx < 0) return `No companion named "${dismissName}" in your party.`;
                const dismissMsg = CompanionManager.dismiss(this.state, dismissIdx, true);
                await this.emitStateUpdate();
                return dismissMsg;
            }

            // ===== LEVELING =====
            case 'levelup':
            case 'level': {
                if (!LevelingEngine.canLevelUp(this.state.character)) {
                    const nextXP = MechanicsEngine.getNextLevelXP(this.state.character.level);
                    return `Not enough XP to level up. Current: ${this.state.character.xp}, Need: ${nextXP}.`;
                }
                const chosenClass = args[0] || undefined;
                const messages: string[] = [];
                // Loop to handle multi-level jumps from large XP gains
                while (LevelingEngine.canLevelUp(this.state.character)) {
                    const msg = LevelingEngine.levelUp(this.state.character, chosenClass);
                    if (msg.includes('specify class')) return msg;
                    messages.push(msg);
                }
                await this.emitStateUpdate();
                return messages.join('\n');
            }

            case 'addxp': {
                const amount = parseInt(args[0] || '0');
                if (!amount || amount <= 0) return "Usage: /addxp <amount>";
                const result = LevelingEngine.addXP(this.state.character, amount);
                await this.emitStateUpdate();
                return `Gained ${amount} XP (Total: ${result.totalXP}).${result.leveledUp ? ' You can level up! Use /levelup.' : ''}`;
            }

            // ===== SPELL MANAGEMENT =====
            case 'preparespells':
            case 'prepare': {
                if (!args.length) return "Usage: /prepare <spell1> <spell2> ...";
                const result = SpellbookEngine.prepareSpells(this.state.character, args);
                await this.emitStateUpdate();
                return result.message;
            }

            // ===== GATHERING =====
            case 'gather': {
                const hex = this.hexMapManager.getHex(this.state.location.hexId);
                if (!hex) return "Error: Current hex not found.";
                if (!hex.resourceNodes || hex.resourceNodes.length === 0) return "No resources to gather here.";
                if (!args[0]) {
                    const nodeList = hex.resourceNodes.map((n: any) => `  ${n.id}: ${n.itemId.replace(/_/g, ' ')} (${n.quantityRemaining} left)`).join('\n');
                    return `Available resource nodes:\n${nodeList}\nUsage: /gather <nodeId>`;
                }
                const result = GatheringEngine.gather(this.state.character, hex, args[0]);
                await this.emitStateUpdate();
                return result.message;
            }

            // ===== CRAFTING =====
            case 'craft': {
                if (!args[0]) return "Usage: /craft <recipeId>";
                const result = DowntimeEngine.craft(this.state.character, args.join(' '));
                await this.emitStateUpdate();
                return result.message;
            }

            // ===== FACTIONS =====
            case 'factions': {
                const factions = this.state.factions || [];
                if (factions.length === 0) return "No factions encountered yet.";
                const lines = factions.map((f: any) => {
                    const label = FactionEngine.getStandingLabel(f.standing);
                    return `  ${f.name}: ${f.standing} (${label})`;
                });
                return `=== Factions ===\n${lines.join('\n')}`;
            }

            // ===== SKILL CHECKS =====
            case 'check':
            case 'skillcheck': {
                if (!args[0] || !args[1]) return "Usage: /check <ability> <skill> [dc]\nExample: /check DEX Stealth 15";
                const ability = args[0].toUpperCase();
                const validAbilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
                if (!validAbilities.includes(ability)) return "Invalid ability. Use: STR, DEX, CON, INT, WIS, CHA";
                const skill = args[1];
                const dc = parseInt(args[2] || '10');
                const result = MechanicsEngine.resolveCheck(this.state.character, ability as any, skill as any, dc);
                await this.emitStateUpdate();
                return result.message;
            }

            // ===== EXPORT =====
            case 'export': {
                const exportType = (args[0] || 'sheet').toLowerCase();
                if (exportType === 'chronicle') {
                    return ExportEngine.exportChronicle(this.state);
                } else {
                    return ExportEngine.exportCharacterSheet(this.state);
                }
            }

            // ===== WEATHER =====
            case 'weather': {
                const w = this.state.weather;
                if (!w) return "No weather data.";
                return `Weather: ${w.type} (${w.durationMinutes} min remaining). Intensity: ${w.intensity}`;
            }

            // ===== MULTICLASS =====
            case 'multiclass': {
                if (!args[0]) return "Usage: /multiclass <ClassName>";
                const targetClass = args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase();
                const pc = this.state.character;

                // Already multiclassed into this
                if (pc.secondaryClass === targetClass) return `Already multiclassed into ${targetClass}.`;
                // Same as primary
                if (pc.class === targetClass) return `${targetClass} is already your primary class.`;
                // Max 2 classes
                if (pc.secondaryClass && pc.secondaryClass !== targetClass) {
                    return `Already multiclassed into ${pc.secondaryClass}. Maximum 2 classes allowed.`;
                }

                const check = MulticlassingEngine.canMulticlass(pc, targetClass);
                if (!check.success) return check.message;

                // Verify target class exists
                const targetClassData = DataManager.getClass(targetClass);
                if (!targetClassData) return `Unknown class: ${targetClass}.`;

                // Execute multiclass
                pc.secondaryClass = targetClass;
                // Initialize multiclassLevels tracking
                if (!pc.multiclassLevels || Object.keys(pc.multiclassLevels).length === 0) {
                    pc.multiclassLevels = { [pc.class]: pc.level, [targetClass]: 0 };
                } else {
                    pc.multiclassLevels[targetClass] = 0;
                }

                await this.emitStateUpdate();
                return `Multiclassed into ${targetClass}! On your next level up, use /levelup <class> to choose which class gains the level.`;
            }

            // ===== USE ITEM (Spell Scrolls etc.) =====
            case 'use': {
                if (!args[0]) return 'Usage: /use <item name or instanceId>';
                const useTarget = args.join(' ');
                const useItem = this.state.character.inventory.items.find(
                    (i: any) => i.instanceId === useTarget || i.name.toLowerCase() === useTarget.toLowerCase()
                );
                if (!useItem) return `You don't have "${useTarget}".`;

                // Spell Scroll casting
                if ((useItem as any).type === 'Spell Scroll' && (useItem as any).spellName) {
                    const scrollSpellName = (useItem as any).spellName;
                    const scrollLevel = (useItem as any).spellLevel || 0;
                    const spell = DataManager.getSpell(scrollSpellName);
                    if (!spell) return `Scroll references unknown spell: ${scrollSpellName}.`;

                    // Check if spell is on character's class spell list — if not, Arcana check required
                    const pc = this.state.character;
                    const arcanaTier = SkillEngine.getSkillTier(pc, 'Arcana');
                    const isOnClassList = spell.classes?.includes(pc.class) || false;

                    if (!isOnClassList) {
                        const dc = 10 + scrollLevel;
                        const intMod = MechanicsEngine.getModifier(pc.stats.INT || 10);
                        const profBonus = arcanaTier > 0 ? MechanicsEngine.getProficiencyBonus(pc.level) * SkillEngine.getTierMultiplier('Arcana', arcanaTier) : 0;
                        const roll = Dice.d20();
                        const total = roll + intMod + profBonus;
                        if (total < dc) {
                            // Failed — scroll consumed, spell fizzles
                            const idx = this.state.character.inventory.items.indexOf(useItem);
                            if (idx !== -1) this.state.character.inventory.items.splice(idx, 1);
                            await this.emitStateUpdate();
                            return `Arcana check ${roll}+${intMod + profBonus}=${total} vs DC ${dc}: Failed! The scroll crumbles as the spell fizzles.`;
                        }
                    }

                    // Cast the spell from scroll (at scroll's fixed level, no upcasting)
                    let castResult: string;
                    if (this.state.mode === 'COMBAT' && this.state.combat) {
                        castResult = await this.spells.castSpellFromScroll(spell, scrollLevel);
                    } else {
                        // Exploration: apply healing/buff effects from scroll
                        const category = spell.effect?.category || 'UTILITY';
                        if (category === 'HEAL' && spell.damage) {
                            let healDice = spell.damage.dice as string;
                            if (scrollLevel > spell.level && spell.damage.scaling) {
                                const si = spell.damage.scaling.levels.indexOf(scrollLevel);
                                if (si !== -1) healDice = String(spell.damage.scaling.values[si]);
                            }
                            const heal = Dice.roll(healDice) + MechanicsEngine.getModifier(this.state.character.stats.WIS || this.state.character.stats.CHA || 10);
                            this.state.character.hp.current = Math.min(this.state.character.hp.max, this.state.character.hp.current + heal);
                            castResult = `You read the scroll of ${spell.name}, healing ${heal} HP. HP: ${this.state.character.hp.current}/${this.state.character.hp.max}`;
                        } else {
                            castResult = `You read the scroll aloud. ${spell.name} (level ${scrollLevel}) takes effect!`;
                        }
                    }

                    // Consume scroll
                    const idx = this.state.character.inventory.items.indexOf(useItem);
                    if (idx !== -1) this.state.character.inventory.items.splice(idx, 1);
                    await this.emitStateUpdate();
                    return `${castResult} The scroll disintegrates.`;
                }

                return `You can't use ${useItem.name} in this way.`;
            }

            // ===== SKILL INVESTMENT =====
            case 'invest': {
                if (!args[0]) return 'Usage: /invest <skill name>';
                const skillToInvest = args.join(' ');
                const investResult = SkillEngine.invest(this.state.character, skillToInvest);
                await this.emitStateUpdate();
                return investResult;
            }

            case 'resetskills': {
                const resetResult = SkillEngine.resetAll(this.state.character);
                await this.emitStateUpdate();
                return resetResult;
            }

            case 'asi': {
                const asiArgs = args.join(' ').toUpperCase().split(/\s+/);
                if (!LevelingEngine.hasPendingASI(this.state.character)) {
                    return 'No pending ASI. ASI is granted at levels 4, 8, 12, 16, 19.';
                }
                if (asiArgs.length === 2 && asiArgs[0] === '+2') {
                    const result = LevelingEngine.applyASISingle(this.state.character, asiArgs[1]);
                    await this.emitStateUpdate();
                    return result;
                } else if (asiArgs.length === 4 && asiArgs[0] === '+1' && asiArgs[2] === '+1') {
                    const result = LevelingEngine.applyASISplit(this.state.character, asiArgs[1], asiArgs[3]);
                    await this.emitStateUpdate();
                    return result;
                }
                return 'Usage: /asi +2 STR  or  /asi +1 STR +1 DEX  or  /feat <name>';
            }

            case 'feat': {
                if (!args[0] || args[0].toLowerCase() === 'list') {
                    const available = LevelingEngine.getAvailableFeats(this.state.character);
                    if (available.length === 0) return 'No feats available.';
                    const hasPending = LevelingEngine.hasPendingASI(this.state.character);
                    const lines = available.map((f: any) => `  ${f.name} — ${f.description}`);
                    return `Available Feats${hasPending ? ' (you have a pending ASI/Feat choice)' : ''}:\n${lines.join('\n')}`;
                }
                const featName = args.join(' ');
                const result = LevelingEngine.selectFeat(this.state.character, featName);
                await this.emitStateUpdate();
                return result;
            }

            // ===== SKILL ABILITY (use active ability) =====
            case 'skillability':
            case 'ability': {
                if (!args[0]) {
                    // List available active abilities
                    const abilities = SkillAbilityEngine.getAvailableAbilities(this.state.character);
                    if (abilities.length === 0) return 'No active abilities available. Reach Tier 3+ and choose an active ability.';
                    const lines = abilities.map(a => `  ${a.skillName} T${a.tier}: ${a.ability.name} (${a.remaining} uses) — ${a.ability.description}`);
                    return `Active Abilities:\n${lines.join('\n')}\n\nUsage: /ability <skill name>`;
                }
                const abilitySkill = args.join(' ');
                // Find which tier has an active ability for this skill
                const pc = this.state.character;
                let used = false;
                for (const tier of [4, 3] as const) {
                    if (SkillAbilityEngine.hasActiveAbility(pc, abilitySkill, tier)) {
                        const result = SkillAbilityEngine.useAbility(pc, abilitySkill, tier);
                        if (result.success) {
                            await this.emitStateUpdate();
                            return result.message;
                        }
                        return result.message;
                    }
                }
                return `No active ability found for "${abilitySkill}". Use /ability to list available abilities.`;
            }

            // ===== CHOOSE SKILL ABILITY (passive/active) =====
            case 'chooseability': {
                // Usage: /chooseability <skill> <tier> <passive|active>
                if (args.length < 3) return 'Usage: /chooseability <skill name> <3|4> <passive|active>';
                const lastTwo = args.slice(-2);
                const tierArg = parseInt(lastTwo[0]);
                const choiceArg = lastTwo[1].toLowerCase();
                const skillArg = args.slice(0, -2).join(' ');

                if (tierArg !== 3 && tierArg !== 4) return 'Tier must be 3 or 4.';
                if (choiceArg !== 'passive' && choiceArg !== 'active') return 'Choice must be "passive" or "active".';

                const result = SkillAbilityEngine.chooseAbility(this.state.character, skillArg, tierArg as 3 | 4, choiceArg);
                await this.emitStateUpdate();
                return result;
            }

            // ===== STABILIZE (in-combat companion action) =====
            case 'stabilize': {
                if (!this.state.combat) return "Not in combat.";
                const targetName = args[0];
                if (!targetName) return "Usage: /stabilize <target name>";
                const { DeathEngine } = await import('./DeathEngine');
                const combat = this.state.combat;
                const medic = combat.combatants[combat.currentTurnIndex];
                const target = combat.combatants.find(c => c.name.toLowerCase().includes(targetName.toLowerCase()));
                if (!target) return `Target "${targetName}" not found.`;
                const medicineBonus = MechanicsEngine.getModifier(medic.stats?.WIS ?? 10);
                const result = DeathEngine.stabilize(medic, target, medicineBonus);
                if (medic.isPlayer) {
                    this.state.character.hp.current = medic.hp.current;
                }
                await this.emitStateUpdate();
                return result;
            }

            default:
                return `Unknown command: ${cmd}`;
        }
    }

    public async initializeCombat(encounter: Encounter, preNarration?: string) {
        const biome = this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'Plains';

        // Use preNarration if provided, or check if lastNarrative was set as ambush text
        const ambushText = preNarration || undefined;

        await this.combatManager.initializeCombat(encounter, biome);

        // Inject ambush narration into combat log and state
        if (ambushText && this.state.combat) {
            this.state.lastNarrative = ambushText;
            this.state.combat.logs[0] = {
                id: `log_ambush_${Date.now()}`,
                type: 'info',
                message: ambushText,
                turn: 0
            };
            this.state.conversationHistory.push({
                role: 'narrator',
                content: ambushText,
                turnNumber: this.state.worldTime.totalTurns
            });
            this.contextManager.addEvent('narrator', ambushText);
        }

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

    /**
     * Dev tool: instantly kills all enemies and triggers normal victory flow.
     */
    public async devWinCombat(): Promise<void> {
        if (this.state.mode !== 'COMBAT' || !this.state.combat) return;
        for (const c of this.state.combat.combatants) {
            if (c.type === 'enemy') c.hp.current = 0;
        }
        await this.combatOrchestrator.processCombatQueue();
    }

    /**
     * Sets the narrative text and triggers a state update to the UI.
     * Used for pre-combat narration (ambush) where combat hasn't started yet.
     */
    public async setNarrative(text: string): Promise<void> {
        this.state.lastNarrative = text;
        this.state.conversationHistory.push({
            role: 'narrator',
            content: text,
            turnNumber: this.state.worldTime.totalTurns
        });
        this.contextManager.addEvent('narrator', text);
        await this.emitStateUpdate();
    }

    public async castSpell(spellName: string, targetId?: string, slotLevel?: number) {
        return await this.spells.castSpell(spellName, targetId, slotLevel);
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

    public async equipItemToSlot(instanceId: string, slotId: string) {
        return await this.inventory.equipItemToSlot(instanceId, slotId);
    }

    public async unequipFromSlot(slotId: string) {
        return await this.inventory.unequipFromSlot(slotId);
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
        if (!this.state.combat) {
            // Narrative/Exploration log entry
            this.state.conversationHistory.push({
                role: 'narrator',
                content: message,
                turnNumber: this.state.worldTime.totalTurns
            });
            this.emitStateUpdate();
            return;
        }

        if (!message || !message.trim()) return;

        this.state.combat.logs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'info',
            message: message.trim(),
            turn: this.state.combat.round
        });
        this.emitStateUpdate();
    }

    public addDebugLog(message: string) {
        if (!this.state.debugLog) this.state.debugLog = [];
        const timestamp = new Date().toLocaleTimeString();
        this.state.debugLog.push(`[${timestamp}] ${message}`);

        // Keep last 50 entries
        if (this.state.debugLog.length > 50) {
            this.state.debugLog.shift();
        }

        // Only emit if developer mode is on to avoid unnecessary re-renders in normal play
        if (this.state.settings.gameplay.developerMode) {
            this.emitStateUpdate();
        }
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
        const oldDifficulty = ((this.state.settings as any)?.gameplay?.difficulty || 'normal') as string;
        this.state.settings = settings;
        const newDifficulty = ((settings?.gameplay?.difficulty) || 'normal') as string;

        // Immediately rescale enemies if difficulty changed mid-combat
        if (oldDifficulty !== newDifficulty && this.state.combat) {
            const { DifficultyEngine } = await import('./DifficultyEngine');
            for (const c of this.state.combat.combatants) {
                if (c.type === 'enemy') {
                    DifficultyEngine.rescaleCombatantHP(c, oldDifficulty as any, newDifficulty as any);
                }
            }
        }

        await this.emitStateUpdate();
    }

    public async advanceTimeAndProcess(totalMinutes: number, isResting: boolean = false, travelType: 'Road' | 'Path' | 'Ancient' | 'Stealth' | 'Wilderness' = 'Wilderness'): Promise<Encounter | null> {
        const result = await this.time.advanceTimeAndProcess(totalMinutes, isResting, travelType);
        this.npcMovement.processTurn(this.state.worldTime.totalTurns);
        return result;
    }

    public async completeRest(durationMinutes: number, type: 'rest' | 'wait' = 'rest'): Promise<{ narration: string; arcaneRecoveryAvailable?: boolean; arcaneRecoveryBudget?: number }> {
        const restResult = await this.time.completeRest(durationMinutes, type);

        try {
            const narration = await NarratorService.narrateRestCompletion(
                this.state,
                durationMinutes,
                type,
                restResult.message
            );

            this.state.lastNarrative = narration;
            const turn = this.state.worldTime.totalTurns;
            this.state.conversationHistory.push({
                role: 'narrator',
                content: narration,
                turnNumber: turn
            });
            this.contextManager.addEvent('narrator', narration);
            await this.emitStateUpdate();

            return {
                narration,
                arcaneRecoveryAvailable: restResult.arcaneRecoveryAvailable,
                arcaneRecoveryBudget: restResult.arcaneRecoveryBudget
            };
        } catch (e) {
            console.error('[GameLoop] Post-rest narration failed:', e);
            return { narration: restResult.message };
        }
    }

    /** Apply Arcane Recovery slot choices after a short rest. */
    public async applyArcaneRecovery(choices: Record<number, number>): Promise<string> {
        const { RestingEngine } = await import('./RestingEngine');
        const msg = RestingEngine.applyArcaneRecovery(this.state.character, choices);
        await this.emitStateUpdate();
        return msg;
    }

    /** Apply spell learning choices after level up. */
    public async learnSpells(spellNames: string[]): Promise<string> {
        const pc = this.state.character;
        const isWizard = pc.class === 'Wizard';
        for (const name of spellNames) {
            if (isWizard) {
                if (!pc.spellbook.includes(name)) pc.spellbook.push(name);
            } else {
                if (!pc.knownSpells.includes(name)) pc.knownSpells.push(name);
            }
            // Remove from unseen
            pc.unseenSpells = pc.unseenSpells.filter(s => s !== name);
        }
        // Consume pending choices
        (pc as any)._pendingSpellChoices = Math.max(0, ((pc as any)._pendingSpellChoices || 0) - spellNames.length);
        await this.emitStateUpdate();
        return `Learned ${spellNames.length} spell(s): ${spellNames.join(', ')}.`;
    }

    /** Apply subclass selection. */
    public async selectSubclass(subclassName: string): Promise<string> {
        const msg = LevelingEngine.selectSubclass(this.state.character, subclassName);
        await this.emitStateUpdate();
        return msg;
    }

    /** Apply fighting style selection. */
    public async selectFightingStyle(styleName: string): Promise<string> {
        const msg = LevelingEngine.selectFightingStyle(this.state.character, styleName);
        await this.emitStateUpdate();
        return msg;
    }

    public async generateAmbushNarration(encounter: Encounter, restType: 'rest' | 'wait'): Promise<string> {
        return NarratorService.narrateAmbush(this.state, encounter, restType);
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
                        this.npcMovement.processTurn(this.state.worldTime.totalTurns);
                    }
                }
            }
        );
    }

    /**
     * Phase A: Extract facts from text and update NPC codex entries.
     * Hooks into both Narrator output and direct Dialogue.
     */
    private async updateNpcProfiles(text: string, npcs: any[]): Promise<void> {
        try {
            let updated = false;

            for (const npc of npcs) {
                const entry = this.state.codexEntries.find(
                    e => e.entityId === npc.id && e.category === 'npcs'
                );

                if (entry) {
                    const mergedProfile = await ProfileExtractor.mergeNpcProfile(
                        text,
                        npc.name,
                        entry.npcProfile as any
                    );

                    if (mergedProfile) {
                        entry.npcProfile = mergedProfile as any;
                        entry.isNew = true; // Re-flag so player sees the update
                        updated = true;

                        // Fix 6C: Push notification on update
                        const npcName = npc?.name || entry.title || 'Unknown';
                        this.state.notifications.push({
                            id: `notif_npc_update_${Date.now()}_${npc.id}`,
                            type: 'CODEX_ENTRY',
                            message: `NPC Profile Updated: ${npcName}`,
                            data: { category: 'npcs', entityId: npc.id },
                            isRead: false,
                            createdAt: Date.now()
                        });
                    }
                }
            }

            if (updated) {
                await this.emitStateUpdate();
            }
        } catch (e) {
            console.warn('[GameLoop] Profile update failed (non-critical):', e);
        }
    }

    /**
     * Scans the current hex for NPCs and ensures they are registered in the codex.
     * Useful for resuming a game session in a populated hex.
     */
    private scanCurrentHexForNpcs(): void {
        const hexId = this.state.location.hexId;
        const currentHex = this.hexMapManager.getHex(hexId);

        if (currentHex?.npcs) {
            for (const npcId of currentHex.npcs) {
                this.registerNpcEncounter(npcId);
            }
        }
    }

    /**
     * Phase A: Creates a codex entry for an NPC on first encounter.
     * Purely programmatic — no LLM involved.
     */
    private registerNpcEncounter(npcId: string): void {
        // Skip if already registered
        if (this.state.codexEntries.some(e => e.entityId === npcId && e.category === 'npcs')) return;

        const npc = this.state.worldNpcs.find(n => n.id === npcId);
        if (!npc) return;

        // Populate merchant inventory if not already done
        if (npc.isMerchant && (!npc.shopState || npc.shopState.inventory.length === 0)) {
            const hex = this.hexMapManager.getHex(this.state.location.hexId);
            this.populateMerchantInventory(npc, hex?.biome || 'Plains');
        }


        const traits = (npc.traits || []).slice(0, 2).join(', ');
        const role = npc.role || 'Unknown';
        const faction = npc.factionId?.replace(/_/g, ' ') || 'Unaffiliated';
        const coords = this.state.location.coordinates;

        const content = `${npc.name}, a ${role} first encountered in ${this.state.location.hexId} on ${this.formatGameDate()}.`;

        const npcProfile = {
            appearance: '',
            personality: traits || '',
            background: '',
            occupation: role + (npc.isMerchant ? ' (Merchant)' : ''),
            relationships: `Faction: ${faction}`,
            notableQuotes: []
        };

        this.state.codexEntries.push({
            id: `npc_${npcId}_${Date.now()}`,
            category: 'npcs' as any,
            entityId: npcId,
            title: npc.name,
            content,
            npcProfile: npcProfile as any,
            isNew: true,
            discoveredAt: this.state.worldTime.totalTurns
        });

        this.state.notifications.push({
            id: `notif_npc_${Date.now()}`,
            type: 'CODEX_ENTRY',
            message: `New NPC Profile: ${npc.name}`,
            data: { category: 'npcs', entityId: npcId },
            isRead: false,
            createdAt: Date.now() // Fix 6B: Use Date.now() instead of turn number
        });
    }
    /**
     * Helper to get a human-readable game date/time string.
     */
    private formatGameDate(): string {
        const t = this.state.worldTime;
        const hour = t.hour;
        const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
        return `Day ${t.day}, ${timeOfDay}`;
    }

    private populateMerchantInventory(npc: WorldNPC, biome: string): void {
        const commerce = BIOME_COMMERCE[biome] || DEFAULT_COMMERCE;

        // 1. Roll for number of items (5-15)
        const itemThreads = Dice.roll(commerce.itemDice);
        const itemCount = Math.min(15, Math.max(5, itemThreads));

        // 2. Pick random items from pool
        const pool = MERCHANT_POOLS[biome] || MERCHANT_POOLS['Urban'];
        const pickedItems = new Set<string>(COMMON_ITEMS);

        const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
        for (let i = 0; i < itemCount && i < shuffledPool.length; i++) {
            pickedItems.add(shuffledPool[i]);
        }

        // 3. Roll for Gold (in GP)
        const goldGP = Dice.roll(commerce.goldDice);

        // 4. Initialize ShopState
        const baseInventory = Array.from(pickedItems);

        // Append forged items from catalog (1-3 if eligible)
        const forgedNames = getForgedItemsForMerchant(biome, this.state.character.level, baseInventory, this.state);
        baseInventory.push(...forgedNames);

        npc.shopState = {
            inventory: baseInventory,
            soldByPlayer: [],
            lastHaggleFailure: {},
            markup: 1.0 + (Math.random() * 0.2), // Random markup between 1.0 and 1.2
            discount: 0.0,
            isOpen: true,
            gold: goldGP
        };
    }

    /**
     * Clears 'buybackEligible' flag for all NPCs when player leaves hex (or NPC moves).
     */
    private clearBuybackEligibility(): void {
        this.state.worldNpcs.forEach(npc => {
            if (npc.shopState && npc.shopState.soldByPlayer.length > 0) {
                npc.shopState.soldByPlayer.forEach(sale => {
                    sale.buybackEligible = false;
                });
            }
        });
    }
}


