import { CombatState, Combatant, GridPosition, TerrainFeature } from '../schemas/CombatSchema';
import { GameState } from '../schemas/FullSaveStateSchema';
import { TerrainGenerator } from './grid/TerrainGenerator';
import { CombatGridManager } from './grid/CombatGridManager';
import { BIOME_TACTICAL_DATA } from './BiomeRegistry';
import { CombatFactory } from './CombatFactory';
import { Encounter } from './EncounterDirector';
import { DataManager } from '../data/DataManager';
import { Dice } from './Dice';
import { MechanicsEngine } from './MechanicsEngine';
import { LoreService } from '../agents/LoreService';

export class CombatManager {
    private state: GameState;
    private gridManager?: CombatGridManager;

    public getGridManager(): CombatGridManager | undefined {
        return this.gridManager;
    }

    constructor(state: GameState) {
        this.state = state;
        if (this.state.combat?.grid) {
            this.gridManager = new CombatGridManager(this.state.combat.grid);
        }
    }

    /**
     * Initializes a new combat encounter with spatial grid and deployment.
     */
    public async initializeCombat(encounter: Encounter, biome: string): Promise<void> {
        this.state.mode = 'COMBAT';

        // 1. Generate Grid
        const seed = `combat_${Date.now()}_${Math.random()}`;
        const grid = TerrainGenerator.generate(biome, seed);

        // 2. Prepare Combatants
        const combatants: Combatant[] = [];

        // Add Player
        const pc = CombatFactory.fromPlayer(this.state.character);
        pc.initiative = Dice.d20() + MechanicsEngine.getModifier(this.state.character.stats.DEX || 10);
        pc.position = grid.playerStartZone[0] || { x: 10, y: 40 };
        combatants.push(pc);

        // Add Companions
        for (let i = 0; i < this.state.companions.length; i++) {
            const companion = CombatFactory.fromPlayer(this.state.companions[i]);
            companion.initiative = Dice.d20() + MechanicsEngine.getModifier(companion.stats.DEX || 10);

            // Deployment: Pick unique positions from player zone
            const posIndex = Math.min(i + 1, grid.playerStartZone.length - 1);
            companion.position = grid.playerStartZone[posIndex] || { x: 10 + i, y: 41 + i };
            combatants.push(companion);
        }

        // Add Enemies
        await DataManager.loadMonsters();
        for (let i = 0; i < encounter.monsters.length; i++) {
            const monsterName = encounter.monsters[i];
            const monsterData = DataManager.getMonster(monsterName);

            // Deployment: Pick unique positions from enemy zone
            const posIndex = Math.min(i, grid.enemyStartZone.length - 1);
            const pos = grid.enemyStartZone[posIndex] || { x: 68, y: 40 };

            const monster = CombatFactory.fromMonster(monsterData || {
                name: monsterName,
                hp: { average: 15, formula: '2d8+2' },
                ac: 10,
                stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
                cr: 0,
                size: 'Medium',
                type: 'beast',
                alignment: 'unaligned',
                speed: 'walk: 30 ft.',
                actions: [],
                traits: [],
                legendaryActions: []
            } as any, `enemy_${i}`);
            monster.initiative = Dice.d20() + (monsterData ? MechanicsEngine.getModifier(monsterData.stats['DEX'] || 10) : 0);
            monster.position = pos;
            combatants.push(monster);

            // Register discovery (with safety wrapper to prevent JSON crashes)
            try {
                LoreService.registerMonsterEncounter(monsterName, this.state, () => { });
            } catch (error) {
                console.error(`[LoreService] Failed to register encounter for ${monsterName}:`, error);
            }
        }

        // 3. Sort by Initiative
        combatants.sort((a, b) => {
            if (b.initiative !== a.initiative) return b.initiative - a.initiative;
            return (b.dexterityScore || 0) - (a.dexterityScore || 0); // Dexterity tie-breaker
        });

        // 4. Set Initial State
        this.state.combat = {
            round: 1,
            currentTurnIndex: 0,
            combatants,
            grid,
            isAmbush: false,
            logs: [{
                id: `log_start_${Date.now()}`,
                type: 'info',
                message: `Combat started in the ${biome}!`,
                turn: 1
            }],
            events: [],
            turnActions: [],
            selectedTargetId: undefined,
            lastRoll: undefined,
            activeBanner: {
                type: 'NAME',
                text: 'Combat Started',
                visible: true
            }
        };

        this.gridManager = new CombatGridManager(grid);
    }

    /**
     * Gets available actions for the current combatant based on grid position and rules.
     */
    public getContextualActions(combatant: Combatant): string[] {
        const actions = ['Attack', 'Dodge', 'Dash', 'Disengage', 'Hide', 'End Turn'];

        // Add 'Move' if they have movement remaining
        if (combatant.movementRemaining > 0) {
            actions.unshift('Move');
        }

        // Future: Check for specific interactables on grid
        return actions;
    }

    /**
     * Executes a movement on the grid.
     */
    public moveCombatant(combatant: Combatant, targetPos: GridPosition): string {
        if (!this.gridManager) return "No grid available.";

        const path = this.gridManager.findPath(combatant.position, targetPos, this.state.combat?.combatants || []);
        if (!path) return "Target is unreachable or blocked.";

        const distance = path.length - 1; // Number of steps
        if (distance > combatant.movementRemaining) {
            return `Too far! You only have ${combatant.movementRemaining * 5}ft of movement left.`;
        }

        const direction = this.gridManager.getRelativeDirection(combatant.position, targetPos);
        const distanceFt = distance * 5;

        // Find nearby features at destination for flavor
        const feature = this.gridManager.getFeatureAt(targetPos);
        const featureSuffix = feature
            ? ` behind the ${CombatManager.getFeatureName(feature, this.state.location.subLocationId || 'Plains')}`
            : '';

        // Context: show distance to the RELEVANT opponent, not to allies
        let relevantTargets: Combatant[];
        if (combatant.type === 'enemy') {
            // Enemy moving -> show distance to player or companions
            relevantTargets = this.state.combat?.combatants.filter(
                c => (c.isPlayer || c.type === 'companion') && c.hp.current > 0
            ) || [];
        } else {
            // Player or ally moving -> show distance to nearest enemy
            relevantTargets = this.state.combat?.combatants.filter(
                c => c.type === 'enemy' && c.hp.current > 0
            ) || [];
        }

        const nearestOpponent = relevantTargets.reduce((closest, e) => {
            const d = this.gridManager!.getDistance(targetPos, e.position);
            return (!closest || d < closest.dist) ? { name: e.name, dist: d } : closest;
        }, null as { name: string, dist: number } | null);

        const opponentContext = nearestOpponent
            ? ` (${nearestOpponent.dist * 5}ft from ${nearestOpponent.name})`
            : '';

        combatant.position = targetPos;
        combatant.movementRemaining -= distance;

        let hazardMsg = '';
        const hazardResult = this.checkHazard(combatant, targetPos);
        if (hazardResult) {
            hazardMsg = `\n[HAZARD] ${hazardResult}`;
        }

        return `${combatant.name} moves ${distanceFt}ft ${direction}${featureSuffix}${opponentContext}.${hazardMsg}`;
    }

    private checkHazard(combatant: Combatant, pos: GridPosition): string | null {
        if (!this.gridManager) return null;
        const feature = this.gridManager.getFeatureAt(pos);
        if (feature?.hazard) {
            const result = MechanicsEngine.resolveHazard(combatant, feature.hazard);

            // Apply Damage
            combatant.hp.current = Math.max(0, combatant.hp.current - result.damage);

            // Add to combat log
            if (this.state.combat) {
                this.state.combat.logs.push({
                    id: `hazard_${Date.now()}_${Math.random()}`,
                    type: 'warning',
                    message: result.message,
                    turn: this.state.combat.round
                });
            }

            return result.message;
        }
        return null;
    }

    private static getFeatureName(feature: TerrainFeature, biome: string): string {
        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];
        const variants = biomeData.features[feature.type] || [];
        if (variants.length === 0) return feature.type;

        const hash = (feature.position.x * 31 + feature.position.y);
        const variant = variants[hash % variants.length];
        return variant.name;
    }
    /**
     * Orchestrates end of turn and next turn transitions.
     */
    public advanceTurn(): string {
        if (!this.state.combat) return "Not in combat.";

        const combat = this.state.combat;
        const prevCombatant = combat.combatants[combat.currentTurnIndex];

        // Reset resources of the combatant who just finished
        prevCombatant.resources.actionSpent = false;
        prevCombatant.resources.bonusActionSpent = false;
        prevCombatant.resources.reactionSpent = false;
        prevCombatant.movementRemaining = prevCombatant.movementSpeed;

        // Transition index
        combat.currentTurnIndex++;
        if (combat.currentTurnIndex >= combat.combatants.length) {
            combat.currentTurnIndex = 0;
            combat.round++;
        }

        const nextCombatant = combat.combatants[combat.currentTurnIndex];

        // START OF TURN HAZARD CHECK
        const hazardMsg = this.checkHazard(nextCombatant, nextCombatant.position);

        // Handle Unconscious or dead
        if (nextCombatant.hp.current <= 0) {
            return (hazardMsg ? `[HAZARD] ${hazardMsg}\n` : '') + this.advanceTurn(); // Skip to next
        }

        return (hazardMsg ? `[HAZARD] ${nextCombatant.name} starts in danger! ${hazardMsg}\n` : '') +
            `Round ${combat.round}: ${nextCombatant.name}'s turn.`;
    }
}
