import { GameState, CombatantSchema } from '../../schemas/FullSaveStateSchema';
import { CombatState, Combatant, CombatLogEntry, Modifier } from '../../schemas/CombatSchema';
import { CombatManager } from '../CombatManager';
import { CombatGridManager } from '../grid/CombatGridManager';
import { CombatResolutionEngine } from '../CombatResolutionEngine';
import { CombatLogFormatter } from '../CombatLogFormatter';
import { CombatAI } from '../CombatAI';
import { CombatUtils } from '../CombatUtils';
import { MechanicsEngine } from '../MechanicsEngine';
import { Dice } from '../Dice';
import { DataManager } from '../../data/DataManager';
import { BIOME_TACTICAL_DATA } from '../BiomeRegistry';
import { LootEngine } from '../LootEngine';
import { WorldClockEngine } from '../WorldClockEngine';
import { NarratorService } from '../../agents/NarratorService';
import { ContextManager } from '../../agents/ContextManager';
import { ParsedIntent } from '../IntentRouter';
import { AbilityParser } from '../AbilityParser';
import { z } from 'zod';


/**
 * Orchestrates the async combat loop, AI turns, and combat resolution.
 */
export class CombatOrchestrator {
    private turnProcessing: boolean = false;

    constructor(
        private state: GameState,
        private combatManager: CombatManager,
        private contextManager: ContextManager,
        private emitStateUpdate: () => Promise<void>,
        private addCombatLog: (message: string) => void,
        private emitCombatEvent: (type: string, targetId: string, value: number) => void
    ) { }

    public async processCombatQueue() {
        console.log(`[Orchestrator] Processing Queue. State: ${!!this.state.combat}, Locked: ${this.turnProcessing}`);
        if (!this.state.combat || this.turnProcessing) return;
        this.turnProcessing = true;

        try {
            while (this.state.combat && !await this.checkCombatEnd()) {
                const actor = this.state.combat.combatants[this.state.combat.currentTurnIndex];
                console.log(`[Orchestrator] Turn: ${actor.name} (${actor.type})`);

                actor.resources.actionSpent = false;
                actor.resources.bonusActionSpent = false;
                actor.movementRemaining = actor.movementSpeed;
                this.state.combat.turnActions = [];

                let bannerType: 'PLAYER' | 'ENEMY' | 'NAME' = 'PLAYER';
                if (actor.type === 'enemy') bannerType = 'ENEMY';
                else if (actor.type === 'companion' || actor.type === 'summon') bannerType = 'NAME';

                this.state.combat.activeBanner = {
                    type: bannerType,
                    text: bannerType === 'NAME' ? `${actor.name.toUpperCase()} TURN` : undefined,
                    visible: true
                };

                await this.processStartOfTurn(actor);
                await this.emitStateUpdate();

                if (actor.isPlayer) {
                    this.turnProcessing = false;
                    return;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await this.performAITurn(actor);

                    const npcSummary = this.state.combat.turnActions.length > 0
                        ? `${this.state.combat.turnActions.join(". ")}`
                        : `${actor.name} waits for an opening.`;
                    this.addCombatLog(npcSummary);
                    this.state.lastNarrative = npcSummary;

                    // Fix: Force update so UI shows narrative immediately
                    await this.emitStateUpdate();

                    await new Promise(resolve => setTimeout(resolve, 1000));

                    if (!this.state.combat) break;

                    const nextMsg = this.combatManager.advanceTurn();
                    this.addCombatLog(nextMsg);
                    this.state.combat.turnActions = [];
                }
            }
        } catch (error) {
            console.error("Critical Error in processCombatQueue:", error);
            this.addCombatLog(`[System Error] Turn processing failed: ${error}`);
        } finally {
            this.turnProcessing = false;
        }
    }

    private async processStartOfTurn(actor: Combatant) {
        if (actor.statusEffects) {
            actor.statusEffects = actor.statusEffects.filter(effect => {
                if (effect.duration !== undefined) {
                    effect.duration--;
                    return effect.duration > 0;
                }
                return true;
            });
        }
        await this.emitStateUpdate();
    }

    public async applyCombatDamage(target: Combatant, damage: number) {
        if (damage <= 0) return;
        CombatResolutionEngine.applyDamage(target, damage);

        if (target.concentration && target.hp.current > 0) {
            const dc = Math.max(10, Math.floor(damage / 2));
            const conMod = MechanicsEngine.getModifier(target.stats['CON'] || 10);
            const roll = Dice.d20();
            const total = roll + conMod;

            if (total < dc) {
                this.addCombatLog(`${target.name} fails a CON save (rolled ${total} vs DC ${dc}) and loses concentration!`);
                // Note: breakConcentration should be accessible. For now calling it via a shared method if possible or re-implementing.
                this.internalBreakConcentration(target);
            } else {
                this.addCombatLog(`${target.name} maintains concentration (rolled ${total} vs DC ${dc}).`);
            }
        }
        await this.emitStateUpdate();
    }

    private internalBreakConcentration(caster: Combatant) {
        const spellName = caster.concentration?.spellName;
        caster.concentration = undefined;
        if (!this.state.combat) return;

        this.state.combat.combatants = this.state.combat.combatants.filter(c => {
            if (c.type === 'summon' && c.sourceId === caster.id) {
                this.addCombatLog(`${c.name} vanishes as ${caster.name} loses concentration on ${spellName}.`);
                return false;
            }
            return true;
        });
        this.state.combat.combatants.sort((a, b) => b.initiative - a.initiative);
    }

    public async handleCombatAction(intent: ParsedIntent): Promise<string> {
        try {
            // console.log(`[Orchestrator] Action: ${intent.command}, Args: ${intent.args}`);

            if (!this.state.combat) return "Not in combat.";
            const currentCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];

            if (!currentCombatant) {
                this.addCombatLog(`[Error] Current combatant is undefined!`);
                return "Error: Invalid turn state.";
            }

            let resultMsg = '';

            const nonActionCommands = ['target', 'end turn', 'move'];
            if (currentCombatant.resources.actionSpent && !nonActionCommands.includes(intent.command || '')) {
                return `You have already used your main action this turn. Use "End Turn".`;
            }

            if (intent.command === 'attack') {
                const combatState = this.state.combat!;
                const isRanged = intent.args?.[0] === 'ranged';
                const targets = combatState.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
                if (targets.length === 0) return "No valid targets.";

                let target = targets.find(t => t.id === combatState.selectedTargetId);
                if (!target) target = targets[0];
                if (!target) return "No target found.";

                const pc = this.state.character;
                const mainHandId = pc.equipmentSlots.mainHand;
                const inventoryEntry = mainHandId ? pc.inventory.items.find(i => i.instanceId === mainHandId) : null;
                const mainHandItem = inventoryEntry ? DataManager.getItem(inventoryEntry.id) : null;

                if (isRanged && !CombatUtils.isRangedWeapon(mainHandItem)) {
                    return "You do not have a ranged weapon equipped!";
                }

                let ammoItem: any = null;
                if (isRanged) {
                    const requiredAmmo = CombatUtils.getRequiredAmmunition(mainHandItem?.name || '');
                    if (requiredAmmo) {
                        ammoItem = pc.inventory.items.find(i => i.name === requiredAmmo);
                        if (!ammoItem || (ammoItem.quantity || 0) <= 0) {
                            return `You have no ${requiredAmmo}s!`;
                        }
                    }
                }

                const strMod = MechanicsEngine.getModifier(pc.stats.STR || 10);
                const dexMod = MechanicsEngine.getModifier(pc.stats.DEX || 10);
                const prof = MechanicsEngine.getProficiencyBonus(pc.level);

                const modifiers: Modifier[] = [];
                const statMod = isRanged ? dexMod : strMod;
                modifiers.push({ label: isRanged ? 'DEX' : 'STR', value: statMod, source: 'Stat' });
                modifiers.push({ label: 'Proficiency', value: prof, source: 'Level' });

                // let attackBonus = statMod + prof; // Legacy
                let damageFormula = (mainHandItem as any)?.damage?.dice || "1d8";
                let dmgBonus = statMod;
                let forceDisadvantage = false;

                const hasUnarmedSkill = pc.skillProficiencies.includes('Unarmed Combat');
                if (!mainHandItem && !isRanged) {
                    damageFormula = "1d4";
                    // modifiers already has STR + Prof
                    if (hasUnarmedSkill) {
                        // Already added prof? Yes, generic "prof".
                        // TODO: Unarmed combat might have specific bonus?
                        // For now, standard unarmed is STR + PROF if proficient.
                    } else {
                        // If NOT proficient in unarmed, remove the prof modifier we rashly added above?
                        // Actually, standard logic is: proficient with weapons?
                        // Let's assume proficient for now to keep it simple, or check class.
                        // But if Unarmed Skill is specific:
                        if (!hasUnarmedSkill) {
                            // Remove proficiency if not proficient?
                            // Logic simplification: PCs are proficient with simple weapons/unarmed usually.
                        }
                    }
                    dmgBonus = strMod + (hasUnarmedSkill ? 2 : 0);
                } else if (mainHandItem && !isRanged && CombatUtils.isRangedWeapon(mainHandItem)) {
                    // Ranged weapon in melee
                    damageFormula = "1d4"; // Improvised
                    forceDisadvantage = true;
                    // Keep modifiers as is (STR+Prof)? Improvised might lack proficiency.
                    // For safety in this refactor, we leave it.
                    dmgBonus = strMod;
                }

                const gridManager = new CombatGridManager(this.state.combat.grid!);
                const distance = gridManager.getDistance(currentCombatant.position, target.position);

                let normalRangeCells: number;
                let maxRangeCells: number;
                if (isRanged) {
                    normalRangeCells = CombatUtils.getWeaponRange(mainHandItem);
                    maxRangeCells = CombatUtils.getWeaponMaxRange(mainHandItem);
                } else {
                    const hasReach = (mainHandItem as any)?.properties?.some((p: string) => p.toLowerCase().includes('reach'));
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

                let rangePrefix = "";
                if (isRanged) {
                    const rangeResult = MechanicsEngine.calculateRangePenalty(currentCombatant as any, distance, mainHandItem);
                    if (rangeResult.penalty < 0) {
                        modifiers.push({ label: 'Range', value: rangeResult.penalty, source: 'Rule' });
                        rangePrefix = `(Range: ${rangeResult.penalty}) `;
                        // console.log(`[Combat] ${rangeResult.log}`);
                    }

                    const isThreatened = combatState.combatants.some(c =>
                        c.type === 'enemy' && c.hp.current > 0 &&
                        gridManager.getDistance(currentCombatant.position, c.position) <= 1.5 // Adjacent
                    );
                    if (isThreatened) {
                        forceDisadvantage = true;
                        this.addCombatLog('Ranged attack in melee (Threatened)! Rolling with Disadvantage.');
                    }
                }

                const result = CombatResolutionEngine.resolveAttack(
                    currentCombatant,
                    target,
                    modifiers, // NOW PASSING MODIFIERS ARRAY
                    damageFormula,
                    dmgBonus,
                    isRanged,
                    forceDisadvantage
                );

                if (isRanged) {
                    if (ammoItem) {
                        ammoItem.quantity = (ammoItem.quantity || 1) - 1;
                        if (ammoItem.quantity <= 0) pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== ammoItem.instanceId);
                    } else if (CombatUtils.isThrownWeapon(mainHandItem)) {
                        pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== inventoryEntry?.instanceId);
                        pc.equipmentSlots.mainHand = undefined;
                    }
                }

                if (result.details) {
                    combatState.lastRoll = {
                        value: result.details.roll || 0,
                        modifier: result.details.modifier || 0,
                        total: (result.details.roll || 0) + (result.details.modifier || 0),
                        label: 'Attack',
                        breakdown: result.details.rollDetails?.modifiers
                    };
                } else {
                    combatState.lastRoll = 0;
                }
                this.emitCombatEvent(result.type, target.id, result.damage || 0);
                const logMsg = rangePrefix + CombatLogFormatter.format(result, currentCombatant.name, target.name, isRanged);
                this.state.combat.turnActions.push(logMsg);
                resultMsg = logMsg;
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
                currentCombatant.resources.actionSpent = true;
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
                resultMsg = await this.useAbility(abilityName);
                this.state.combat.turnActions.push(resultMsg);
            } else if (intent.command === 'move') {
                const x = parseInt(intent.args?.[0] || '0');
                const y = parseInt(intent.args?.[1] || '0');
                const modeInput = (intent.args?.[2] || 'normal').toLowerCase();

                let costMultiplier = 1;

                if (modeInput === 'sprint' || modeInput === 'dash') {
                    // Sprint doubles speed but costs the Action
                    currentCombatant.movementRemaining *= 2;
                    currentCombatant.statusEffects.push({ id: 'sprint_reckless', name: 'Reckless Sprint', type: 'DEBUFF', duration: 1, sourceId: currentCombatant.id });
                    currentCombatant.resources.actionSpent = true;
                } else if (modeInput === 'evasive') {
                    currentCombatant.statusEffects.push({ id: 'evasive_movement', name: 'Evasive Movement', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                } else if (modeInput === 'press') {
                    costMultiplier = 2;
                    currentCombatant.statusEffects.push({ id: 'press_advantage', name: 'Pressing Attack', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                } else if (modeInput === 'stalk') {
                    costMultiplier = 2;
                    currentCombatant.statusEffects.push({ id: 'stalking', name: 'Stalking', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });

                    // Stealth Check Implementation
                    const biome = this.state.location.subLocationId || 'Plains';
                    const dc = BIOME_TACTICAL_DATA[biome]?.passivePerception || 12; // Default to 12 (Forest) if unknown

                    const dex = currentCombatant.stats.DEX || 10;
                    const mod = MechanicsEngine.getModifier(dex);
                    let prof = 0;

                    if (currentCombatant.isPlayer) {
                        // Cross-reference player sheet for proficiency
                        if (this.state.character.skillProficiencies.includes('Stealth')) {
                            prof = MechanicsEngine.getProficiencyBonus(this.state.character.level);
                        }
                    }

                    const roll = Dice.d20();
                    const total = roll + mod + prof;

                    if (total >= dc) {
                        currentCombatant.statusEffects.push({ id: 'unseen', name: 'Unseen', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                        this.addCombatLog(`${currentCombatant.name} stalks silently (Stealth ${total} vs DC ${dc}). Success! They are Unseen.`);
                    } else {
                        this.addCombatLog(`${currentCombatant.name} attempts to stalk (Stealth ${total} vs DC ${dc}) but is heard.`);
                    }

                } else if (modeInput === 'flank') {
                    currentCombatant.statusEffects.push({ id: 'flanking', name: 'Flanking', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                } else if (modeInput === 'phalanx') {
                    currentCombatant.statusEffects.push({ id: 'phalanx_formation', name: 'Phalanx Formation', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                } else if (modeInput === 'hunker') {
                    currentCombatant.statusEffects.push({ id: 'hunkered_down', name: 'Hunkered Down', type: 'BUFF', duration: 1, sourceId: currentCombatant.id });
                }

                resultMsg = this.combatManager.moveCombatant(currentCombatant, { x, y }, costMultiplier);
                this.state.combat.turnActions.push(resultMsg);

            } else if (intent.command === 'target') {
                const targetIdOrName = intent.args?.[0];
                const target = this.state.combat.combatants.find(c =>
                    c.id === targetIdOrName || c.name.toLowerCase() === targetIdOrName?.toLowerCase()
                );

                if (target) {
                    this.state.combat.selectedTargetId = target.id;
                    resultMsg = `Target set to ${target.name}.`;
                } else {
                    resultMsg = "Target not found.";
                }

            } else if (intent.command === 'end turn') {
                if (!currentCombatant.isPlayer) return "";

                const summary = `${currentCombatant.name} ends their turn.`;

                resultMsg = summary;
                this.state.combat.turnActions = [];

                this.addCombatLog(resultMsg);
                this.state.lastNarrative = resultMsg;
                await this.emitStateUpdate();

                await this.advanceTurn();
                return resultMsg;
            }

            this.addCombatLog(resultMsg);
            if (resultMsg && !nonActionCommands.includes(intent.command || '')) {
                currentCombatant.resources.actionSpent = true;
            }

            // Fix: Update narrative box for player actions
            if (resultMsg) {
                this.state.lastNarrative = resultMsg;
            }

            await this.emitStateUpdate();
            return resultMsg;

        } catch (error) {
            console.error("[Orchestrator] Error processing player action:", error);
            const errMsg = `[Error] Action failed: ${error instanceof Error ? error.message : String(error)}`;
            this.addCombatLog(errMsg);
            return errMsg;
        }
    }

    private async advanceTurn() {
        const msg = this.combatManager.advanceTurn();
        this.addCombatLog(msg);
        await this.processCombatQueue();
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

        if (victory) {
            // SYNC STATE BACK TO GLOBAL
            const pcCombatant = combatState.combatants.find(c => c.isPlayer);
            if (pcCombatant) {
                const char = this.state.character;
                char.hp.current = pcCombatant.hp.current;
                char.hp.temp = pcCombatant.hp.temp;
                if (pcCombatant.spellSlots) {
                    Object.entries(pcCombatant.spellSlots).forEach(([lv, data]) => {
                        if (char.spellSlots[lv]) char.spellSlots[lv].current = data.current;
                    });
                }
                // Sync persistent conditions (simplified string mapping)
                const persistentIDs = ['poisoned', 'blinded', 'deafened', 'frightened', 'paralyzed', 'stunned'];
                pcCombatant.statusEffects.forEach(effect => {
                    const id = effect.id.toLowerCase();
                    if (persistentIDs.includes(id) && !char.conditions.includes(effect.name)) {
                        char.conditions.push(effect.name);
                    }
                });
            }

            // Sync Companions
            this.state.companions.forEach((companion, index) => {
                const compId = `companion_${index}`;
                const compCombatant = combatState.combatants.find(c => c.id === compId);
                if (compCombatant) {
                    companion.hp.current = compCombatant.hp.current;
                    companion.hp.temp = compCombatant.hp.temp;
                    if (compCombatant.spellSlots) {
                        Object.entries(compCombatant.spellSlots).forEach(([lv, data]) => {
                            if (companion.spellSlots[lv]) companion.spellSlots[lv].current = data.current;
                        });
                    }
                }
            });

            let totalXP = 0;
            const enemies = combatState.combatants.filter(c => c.type === 'enemy');
            for (const enemy of enemies) {
                const monsterData = DataManager.getMonster(enemy.name);
                totalXP += monsterData ? MechanicsEngine.getCRtoXP(monsterData.cr) : 50;
            }

            // Apply difficulty modifier from settings
            const difficulty = (this.state.settings?.gameplay as any)?.difficulty || 'normal';
            if (difficulty === 'hard') {
                totalXP = Math.floor(totalXP * 1.25);
                this.addCombatLog(`Bonus XP awarded for Hard difficulty!`);
            }

            const char = this.state.character;
            char.xp += totalXP;
            this.addCombatLog(`You gained ${totalXP} Experience Points! (Total: ${char.xp})`);

            const defeatedEnemies = combatState.combatants.filter(c => c.type === 'enemy');
            for (const enemy of defeatedEnemies) {
                const monsterData = DataManager.getMonster(enemy.name);
                if (monsterData) {
                    const loot = LootEngine.processDefeat(monsterData);
                    char.inventory.gold.cp += loot.gold.cp;
                    char.inventory.gold.sp += loot.gold.sp;
                    char.inventory.gold.gp += loot.gold.gp;
                    char.inventory.gold.pp += loot.gold.pp;
                    if (!this.state.location.combatLoot) this.state.location.combatLoot = [];
                    this.state.location.combatLoot.push(...loot.items.map(i => ({
                        ...i,
                        instanceId: `loot_${Date.now()}_${Math.random()}`,
                        equipped: false
                    })));
                }
            }

            const nextThreshold = MechanicsEngine.getNextLevelXP(char.level);
            if (char.xp >= nextThreshold && char.level < 20) {
                char.level++;
                char.hp.max += 10;
                char.hp.current = char.hp.max;
                Object.values(char.spellSlots).forEach(s => s.current = s.max);
                this.addCombatLog(`LEVEL UP! You are now level ${char.level}. HP and Spell Slots restored.`);
            }
        }

        if (victory) {
            this.state.mode = 'EXPLORATION';
            this.state.clearedHexes[this.state.location.hexId] = this.state.worldTime.totalTurns;
            const totalMinutes = Math.ceil((combatState.round || 0) * 6 / 60) + 5;
            this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, totalMinutes);
            this.state.combat = undefined;
            await this.emitStateUpdate();

            try {
                const summary = await NarratorService.summarizeCombat(this.state, combatState.logs || []);
                this.state.lastNarrative = summary;
                this.state.conversationHistory.push({ role: 'narrator', content: summary, turnNumber: this.state.worldTime.totalTurns });
                this.contextManager.addEvent('narrator', summary);
                await this.emitStateUpdate();
            } catch (e) { console.error(e); }
        } else {
            this.state.mode = 'GAME_OVER';
            await this.emitStateUpdate();
        }
    }

    private async performAITurn(actor: Combatant) {
        if (!this.state.combat) return;
        let actionsTaken = 0;
        const maxLoop = 2;

        while (actionsTaken < maxLoop && actor.hp.current > 0) {
            const action = CombatAI.decideAction(actor, this.state.combat);

            if (action.type === 'MOVE' && action.targetId) {
                const target = this.state.combat.combatants.find(c => c.id === action.targetId);
                if (target && this.state.combat.grid) {
                    const gridManager = new CombatGridManager(this.state.combat.grid);
                    const path = gridManager.findPath(actor.position, target.position, this.state.combat.combatants);
                    if (path && path.length > 1) {
                        const steps = Math.min(actor.movementRemaining, path.length - 2);
                        if (steps > 0) {
                            const moveMsg = this.combatManager.moveCombatant(actor, path[steps]);
                            this.addCombatLog(moveMsg);
                            this.state.combat.turnActions.push(moveMsg);
                        } else break;
                    } else break;
                } else break;
                actionsTaken++;
            } else if (action.type === 'ATTACK' && action.targetId) {
                const target = this.state.combat.combatants.find(c => c.id === action.targetId);
                if (!target) break;

                let modifiers: Modifier[] = [];
                let damageFormula = "1d4"; // Unarmed default
                let isRanged = false;
                let forceDisadvantage = false;
                let rangeLog = "";

                // --- PLAYER ATTACK LOGIC ---
                if (actor.type === 'player') {
                    const pc = this.state.character; // In single player, actor is state.character
                    // Identify Weapon
                    const mainHand = pc.equipmentSlots?.mainHand ? pc.inventory.items.find(i => i.name === pc.equipmentSlots.mainHand) : null;
                    const weapon = mainHand; // Default to main hand for now
                    const weaponAny = weapon as any;

                    // 1. Stat Modifier
                    const isFinesse = weaponAny?.properties?.includes('Finesse');
                    isRanged = weaponAny?.properties?.includes('Ranged') || weaponAny?.type === 'Weapon (Ranged)'; // Basic check

                    const strScore = MechanicsEngine.getEffectiveStat(pc, 'STR');
                    const dexScore = MechanicsEngine.getEffectiveStat(pc, 'DEX');

                    let statUsed = 'STR';
                    let statMod = MechanicsEngine.getModifier(strScore);

                    if (isRanged || (isFinesse && dexScore > strScore)) {
                        statUsed = 'DEX';
                        statMod = MechanicsEngine.getModifier(dexScore);
                    }

                    modifiers.push({ label: statUsed, value: statMod, source: 'Stat' });

                    // 2. Proficiency
                    const isProficient = weapon ? (pc.weaponProficiencies?.some((p: string) => weapon.type.includes(p)) || true) : true; // Assuming proficient for now/all simple
                    if (isProficient) {
                        const prof = MechanicsEngine.getProficiencyBonus(pc.level);
                        modifiers.push({ label: 'Proficiency', value: prof, source: 'Level' });
                    }

                    // 3. Weapon Magic/Bonuses
                    if (weapon && weaponAny.modifiers) {
                        weaponAny.modifiers.forEach((mod: any) => {
                            if (mod.type === 'AttackBonus') {
                                modifiers.push({ label: weapon.name, value: mod.value, source: 'Item' });
                            }
                        });
                    }
                    if (weapon) damageFormula = weaponAny.damage?.dice || (typeof weaponAny.damage === 'string' ? weaponAny.damage : "1d4");

                    // 4. Range Penalties (Proportional)
                    if (this.state.combat?.grid && target) {
                        const gridManager = new CombatGridManager(this.state.combat.grid);
                        const dist = gridManager.getDistance(actor.position, target.position);

                        // Mechanics: Range Penalty
                        const rangeResult = MechanicsEngine.calculateRangePenalty(pc, dist, weapon as any);
                        if (rangeResult.penalty < 0) {
                            modifiers.push({ label: 'Range', value: rangeResult.penalty, source: 'Rule' });
                            rangeLog = rangeResult.log;
                        }
                    }

                }
                // --- MONSTER ATTACK LOGIC ---
                else {
                    const monsterData = DataManager.getMonster(actor.name);

                    // Parity: Tactical selection (Range vs Reach)
                    let actionData = monsterData?.actions?.[0];
                    if (monsterData?.actions && monsterData.actions.length > 1) {
                        const preference = actor.tactical.isRanged ? 'range' : 'reach';
                        actionData = monsterData.actions.find(a => a.description.toLowerCase().includes(preference)) || monsterData.actions[0];
                    }

                    if (actionData) {
                        isRanged = actionData.description.toLowerCase().includes('ranged') || actionData.name?.toLowerCase().includes('bow') || actionData.name?.toLowerCase().includes('crossbow');
                        damageFormula = actionData.damage || "1d6";


                        // Decompose Attack Bonus
                        const totalBonus = actionData.attackBonus || 0;
                        const cr = Number(monsterData?.cr) || 0;
                        const prof = MechanicsEngine.getMonsterProficiency(cr);
                        let statMod = totalBonus - prof;

                        // Infer Stat Label
                        let statLabel = 'Ability';
                        const strMod = MechanicsEngine.getModifier(actor.stats['STR'] || 10);
                        const dexMod = MechanicsEngine.getModifier(actor.stats['DEX'] || 10);

                        if (statMod === strMod) statLabel = 'STR';
                        else if (statMod === dexMod) statLabel = 'DEX';
                        else if (isRanged) statLabel = 'DEX'; // Fallback implication
                        else statLabel = 'STR'; // Fallback implication

                        modifiers.push({ label: statLabel, value: statMod, source: 'Stat' });
                        modifiers.push({ label: 'Proficiency', value: prof, source: 'Rules' });

                        // Virtual Ammo Check
                        if (isRanged) {
                            if (actor.virtualAmmo === undefined) (actor as any).virtualAmmo = 20;
                            if ((actor as any).virtualAmmo <= 0) {
                                this.addCombatLog(`${actor.name} is out of ammo!`);
                                break;
                            }
                            (actor as any).virtualAmmo--;
                        }

                        // Parity: Proportional Range Penalty
                        if (this.state.combat?.grid && target) {
                            const gridManager = new CombatGridManager(this.state.combat.grid);
                            const dist = gridManager.getDistance(actor.position, target.position);

                            const mockWeapon = {
                                range: actor.tactical.range || { normal: 30, long: 120 }, // Fallback
                                properties: [] as string[]
                            };

                            const rangeResult = MechanicsEngine.calculateRangePenalty(actor as any, dist, mockWeapon as any);
                            if (rangeResult.penalty < 0) {
                                modifiers.push({ label: 'Range', value: rangeResult.penalty, source: 'Rule' });
                            }

                        }
                    }
                }

                if (!damageFormula) break;

                const result = CombatResolutionEngine.resolveAttack(
                    actor,
                    target,
                    modifiers,
                    damageFormula,
                    0, // statMod already in modifiers for players, baked in for monsters
                    isRanged,
                    forceDisadvantage
                );


                // Trigger UI Dice Animation
                if (this.state.combat && result.details) {
                    this.state.combat.lastRoll = {
                        value: result.details.roll || 0,
                        modifier: result.details.modifier || 0,
                        total: (result.details.roll || 0) + (result.details.modifier || 0),
                        label: 'Attack',
                        breakdown: result.details.rollDetails?.modifiers
                    };
                }

                this.emitCombatEvent(result.type, target.id, result.damage || 0);
                await this.applyCombatDamage(target, result.damage);
                const logMsg = CombatLogFormatter.format(result, actor.name, target.name, isRanged);
                this.addCombatLog(logMsg);
                this.state.combat.turnActions.push(logMsg);
                break;
            } else break;
        }
        this.turnProcessing = false;
    }

    public async useAbility(abilityName: string): Promise<string> {
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
            const rollVal = Dice.roll("1d10");
            const heal = rollVal + char.level;

            if (this.state.combat) {
                this.state.combat.lastRoll = {
                    value: rollVal,
                    modifier: 0,
                    total: rollVal + char.level, // Technicality: The heal is d10 + level, but the roll is d10.
                    label: 'Heal'
                };
            }

            char.hp.current = Math.min(char.hp.max, char.hp.current + heal);
            result += `Recovering ${heal} HP.`;
        } else if (ability.name === 'Action Surge') {
            result += "You push yourself beyond your normal limits for a moment.";
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
            if (!this.turnProcessing && ability.actionCost === 'ACTION') {
                // For abilities that take an action and don't explicitly end turn,
                // we might want to wait a bit before advancing? 
                // In backup it was 1500ms.
                setTimeout(() => this.advanceTurn(), 1500);
            }
        }

        return result;
    }
}
