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
import { EventBusManager } from './EventBusManager';
import { z } from 'zod';
import { hasCondition, addCondition, removeCondition, tickConditions, conditionNames } from '../ConditionUtils';
import { DeathEngine } from '../DeathEngine';
import { LoreService } from '../../agents/LoreService';
import { tryPersistForgedItem } from '../../data/ForgedItemCatalog';
import { DifficultyEngine, DifficultyLevel } from '../DifficultyEngine';
import { SkillAbilityEngine } from '../SkillAbilityEngine';
import { LevelingEngine } from '../LevelingEngine';
import { LightLevel } from '../VisibilityEngine';


/**
 * Orchestrates the async combat loop, AI turns, and combat resolution.
 */
export class CombatOrchestrator {
    private turnProcessing: boolean = false;
    private lastDifficulty: DifficultyLevel = 'normal';

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

        // Detect mid-combat difficulty change and rescale enemies
        const currentDiff = ((this.state.settings as any)?.gameplay?.difficulty || 'normal') as DifficultyLevel;
        if (currentDiff !== this.lastDifficulty && this.state.combat) {
            for (const c of this.state.combat.combatants) {
                if (c.type === 'enemy') {
                    DifficultyEngine.rescaleCombatantHP(c, this.lastDifficulty, currentDiff);
                }
            }
            this.addCombatLog(`Difficulty changed to ${currentDiff}!`);
            this.lastDifficulty = currentDiff;
        }

        // Ensure monsters are loaded if game was resumed mid-combat
        await DataManager.loadMonsters();

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

    /**
     * Processes start-of-turn effects. Does NOT auto-roll death saves — player must click the button.
     */
    private async processStartOfTurn(actor: Combatant): Promise<void> {
        // Tick status effects (buffs/debuffs with duration)
        if (actor.statusEffects) {
            actor.statusEffects = actor.statusEffects.filter(effect => {
                if (effect.duration !== undefined) {
                    effect.duration--;
                    return effect.duration > 0;
                }
                return true;
            });
        }

        // Tick conditions with duration (Blinded 3 rounds, Dodging 1 round, etc.)
        const expired = tickConditions(actor.conditions);
        if (expired.length > 0) {
            this.addCombatLog(`${actor.name}: ${expired.join(', ')} expired.`);
        }

        // If player is downed, prompt them to roll death save (they must click the button)
        if (actor.isPlayer && actor.hp.current <= 0 && hasCondition(actor.conditions, 'Unconscious')) {
            const saves = actor.deathSaves || { successes: 0, failures: 0 };
            this.addCombatLog(`${actor.name} is dying! Roll a Death Save. (${saves.successes} successes, ${saves.failures} failures)`);
            this.state.lastNarrative = `You are unconscious and dying. Roll a Death Save!`;
        }

        await this.emitStateUpdate();
    }

    public async applyCombatDamage(target: Combatant, damage: number) {
        if (damage <= 0) return;
        CombatResolutionEngine.applyDamage(target, damage);

        // Check if target just dropped to 0 HP — trigger death save system for players
        if (target.hp.current <= 0 && target.isPlayer && !hasCondition(target.conditions, 'Unconscious') && !hasCondition(target.conditions, 'Dead')) {
            const downedMsg = DeathEngine.handleDowned(target);
            this.addCombatLog(downedMsg);
        }

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

        // Sync player HP to global character state so UI updates in real-time
        if (target.isPlayer) {
            this.state.character.hp.current = target.hp.current;
            this.state.character.hp.temp = target.hp.temp;
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

            // --- DEATH SAVE (player clicks button while downed) ---
            if (intent.command === 'death_save' || intent.command === 'death save') {
                if (currentCombatant.hp.current > 0 || !hasCondition(currentCombatant.conditions, 'Unconscious')) {
                    return "You are not dying.";
                }
                const result = DeathEngine.rollDeathSave(currentCombatant);
                this.addCombatLog(result.message);
                this.state.lastNarrative = result.message;

                const restored = result.isRevived || result.totalSuccesses >= 3;

                if (result.isDead) {
                    this.addCombatLog(`${currentCombatant.name} has died.`);
                    // Sync death to global character state
                    this.state.character.hp.current = 0;
                } else if (result.isRevived) {
                    // Nat 20: DeathEngine already sets combatant hp to 1
                    this.addCombatLog(`${currentCombatant.name} miraculously regains consciousness at 1 HP!`);
                } else if (result.totalSuccesses >= 3) {
                    // Stabilized: grant 1 HP so player can act (attack or flee)
                    currentCombatant.hp.current = 1;
                    removeCondition(currentCombatant.conditions, 'Unconscious');
                    removeCondition(currentCombatant.conditions, 'Stable');
                    this.addCombatLog(`${currentCombatant.name} stabilizes and musters the strength to act! (1 HP)`);
                }

                // CRITICAL: Sync combatant HP back to global character state so UI updates
                if (currentCombatant.isPlayer) {
                    this.state.character.hp.current = currentCombatant.hp.current;
                    this.state.character.hp.temp = currentCombatant.hp.temp;
                    // Also sync conditions back
                    this.state.character.conditions = [...currentCombatant.conditions];
                }

                await this.emitStateUpdate();

                if (restored) {
                    // Player is back on their feet — do NOT auto-advance turn.
                    // Let them take a normal action (attack or flee) this turn.
                    currentCombatant.resources.actionSpent = false;
                    currentCombatant.resources.bonusActionSpent = false;
                    currentCombatant.movementRemaining = currentCombatant.movementSpeed;
                    this.addCombatLog(`${currentCombatant.name} is back on their feet! Choose an action.`);
                    await this.emitStateUpdate();
                    return result.message;
                } else {
                    // Still dying or dead — auto-advance turn
                    await this.advanceTurn();
                    return result.message;
                }
            }

            // --- FLEE ACTION ---
            if (intent.command === 'flee') {
                if (!currentCombatant.isPlayer) return "Only the player can flee.";

                const combatState = this.state.combat!;
                const pc = this.state.character;

                // Contested check: player Athletics or Acrobatics (whichever is higher) vs best enemy
                const strMod = MechanicsEngine.getModifier(pc.stats.STR || 10);
                const dexMod = MechanicsEngine.getModifier(pc.stats.DEX || 10);
                const prof = MechanicsEngine.getProficiencyBonus(pc.level);
                const hasAthletics = pc.skillProficiencies?.includes('Athletics');
                const hasAcrobatics = pc.skillProficiencies?.includes('Acrobatics');

                const athleticsBonus = strMod + (hasAthletics ? prof : 0);
                const acrobaticsBonus = dexMod + (hasAcrobatics ? prof : 0);
                const playerBonus = Math.max(athleticsBonus, acrobaticsBonus);
                const usedSkill = athleticsBonus >= acrobaticsBonus ? 'Athletics' : 'Acrobatics';

                const playerRoll = Dice.d20() + playerBonus;

                // Enemy contested roll: highest Athletics/Acrobatics among living enemies
                const enemies = combatState.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
                let bestEnemyRoll = 0;
                let bestEnemyName = 'enemy';
                for (const enemy of enemies) {
                    const eDex = MechanicsEngine.getModifier(enemy.stats?.DEX ?? 10);
                    const eStr = MechanicsEngine.getModifier(enemy.stats?.STR ?? 10);
                    const eBonus = Math.max(eDex, eStr);
                    const eRoll = Dice.d20() + eBonus;
                    if (eRoll > bestEnemyRoll) {
                        bestEnemyRoll = eRoll;
                        bestEnemyName = enemy.name;
                    }
                }

                this.addCombatLog(`${currentCombatant.name} attempts to flee! ${usedSkill} check: ${playerRoll} vs ${bestEnemyName}'s ${bestEnemyRoll}`);

                if (playerRoll >= bestEnemyRoll) {
                    // SUCCESS — but enemies get opportunity attacks first
                    let oaMessages: string[] = [];
                    const gridManager = combatState.grid ? new CombatGridManager(combatState.grid) : null;
                    for (const enemy of enemies) {
                        if (enemy.resources.reactionSpent) continue;
                        const adjacent = gridManager ? gridManager.getDistance(currentCombatant.position, enemy.position) <= 1.5 : true;
                        if (!adjacent) continue;

                        // Opportunity attack
                        const eStr = MechanicsEngine.getModifier(enemy.stats?.STR ?? 10);
                        const attackRoll = Dice.d20() + eStr;
                        if (attackRoll >= currentCombatant.ac) {
                            const damage = Math.max(1, Dice.roll('1d6') + eStr);
                            await this.applyCombatDamage(currentCombatant, damage);
                            oaMessages.push(`${enemy.name} strikes as you flee! (${damage} damage)`);
                        } else {
                            oaMessages.push(`${enemy.name} swings but misses!`);
                        }
                        enemy.resources.reactionSpent = true;
                    }

                    for (const msg of oaMessages) this.addCombatLog(msg);

                    // Check if opportunity attacks killed the player
                    if (currentCombatant.hp.current <= 0 && currentCombatant.isPlayer) {
                        this.addCombatLog(`${currentCombatant.name} was cut down while fleeing!`);
                        await this.emitStateUpdate();
                        currentCombatant.resources.actionSpent = true;
                        await this.advanceTurn();
                        return `Flee failed — you were struck down while escaping!`;
                    }

                    // Successful flee — end combat as escape
                    this.addCombatLog(`${currentCombatant.name} successfully flees the battle!`);
                    await this.endCombatAsFlee();
                    return `You escape! ${oaMessages.join(' ')}`;

                } else {
                    // FAILURE — opportunity attacks + turn wasted
                    let oaMessages: string[] = [];
                    const gridManager = combatState.grid ? new CombatGridManager(combatState.grid) : null;
                    for (const enemy of enemies) {
                        if (enemy.resources.reactionSpent) continue;
                        const adjacent = gridManager ? gridManager.getDistance(currentCombatant.position, enemy.position) <= 1.5 : true;
                        if (!adjacent) continue;

                        const eStr = MechanicsEngine.getModifier(enemy.stats?.STR ?? 10);
                        const attackRoll = Dice.d20() + eStr;
                        if (attackRoll >= currentCombatant.ac) {
                            const damage = Math.max(1, Dice.roll('1d6') + eStr);
                            await this.applyCombatDamage(currentCombatant, damage);
                            oaMessages.push(`${enemy.name} strikes you! (${damage} damage)`);
                        }
                        enemy.resources.reactionSpent = true;
                    }

                    for (const msg of oaMessages) this.addCombatLog(msg);
                    this.addCombatLog(`Flee failed! (${playerRoll} vs ${bestEnemyRoll})`);
                    currentCombatant.resources.actionSpent = true;
                    this.state.combat.turnActions.push(`Failed flee attempt.`);
                    await this.emitStateUpdate();
                    return `Flee failed! The enemies block your escape. ${oaMessages.join(' ')}`;
                }
            }

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
                // For forged items, use inventory entry directly (has forge bonuses);
                // for base items, fall back to DataManager template (has weapon fields)
                const baseItem = inventoryEntry ? DataManager.getItem(inventoryEntry.id) : null;
                const mainHandItem: any = (inventoryEntry as any)?.isForged
                    ? { ...baseItem, ...inventoryEntry }
                    : (baseItem || inventoryEntry);

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

                // Parse Weapon Modifiers (legacy AttackBonus + forge HitBonus)
                if (mainHandItem && mainHandItem.modifiers) {
                    mainHandItem.modifiers.forEach((mod: any) => {
                        if (mod.type === 'AttackBonus' || mod.type === 'HitBonus') {
                            modifiers.push({ label: mainHandItem.name, value: mod.value, source: 'Item' });
                        }
                    });
                }

                let damageFormula = (mainHandItem as any)?.damage?.dice || "1d8";
                let dmgBonus = statMod;
                if (mainHandItem && mainHandItem.modifiers) {
                    mainHandItem.modifiers.forEach((mod: any) => {
                        if (mod.type === 'DamageBonus' || mod.type === 'DamageAdd') {
                            dmgBonus += mod.value;
                        }
                    });
                }

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

                // Build feature context for class-specific attack modifiers
                const pcClass = pc.class;
                const pcSubclass = pc.subclass;
                const pcLevel = pc.level;

                // Improved Critical (Champion Fighter): crit on 19+ at L3, 18+ at L15
                let critRange = 20;
                if (pcClass === 'Fighter' && pcSubclass === 'Champion') {
                    if (pcLevel >= 15) critRange = 18;
                    else if (pcLevel >= 3) critRange = 19;
                }

                // Sneak Attack (Rogue): ceil(level/2) d6s
                const sneakAttackDice = pcClass === 'Rogue' ? Math.ceil(pcLevel / 2) : 0;
                const isFinesseOrRanged = isRanged || !!(mainHandItem as any)?.properties?.some(
                    (p: string) => p.toLowerCase().includes('finesse')
                );
                // Check if any ally is within 5ft (1 cell) of the target
                let hasAllyNearTarget = false;
                if (sneakAttackDice > 0 && combatState.grid && target) {
                    hasAllyNearTarget = combatState.combatants.some(c =>
                        c.id !== currentCombatant.id &&
                        c.type !== 'enemy' &&
                        c.hp.current > 0 &&
                        gridManager.getDistance(target!.position, c.position) <= 1
                    );
                }

                const featureContext = {
                    critRange,
                    sneakAttackDice,
                    hasAllyNearTarget,
                    isFinesseOrRanged,
                };

                // Determine number of attacks (Extra Attack feature)
                let attackCount = 1;
                if (currentCombatant.isPlayer) {
                    const hasExtraAttack = (feat: string) => {
                        const classFeatures = DataManager.getClass(pcClass)?.allFeatures || [];
                        return classFeatures.some(f => f.name === feat && f.level <= pcLevel);
                    };
                    // Fighter gets Extra Attack at 5, Extra Attack (2) at 11, Extra Attack (3) at 20
                    if (pcClass === 'Fighter') {
                        if (pcLevel >= 20) attackCount = 4;
                        else if (pcLevel >= 11) attackCount = 3;
                        else if (pcLevel >= 5) attackCount = 2;
                    } else if (['Ranger', 'Paladin', 'Monk'].includes(pcClass) && pcLevel >= 5) {
                        attackCount = 2;
                    } else if (pcClass === 'Bard' && pcSubclass === 'College of Valor' && pcLevel >= 6) {
                        attackCount = 2;
                    }
                }

                let usedSneakAttack = false; // Sneak Attack: only once per turn
                const allAttackResults: string[] = [];

                for (let atkIdx = 0; atkIdx < attackCount; atkIdx++) {
                    if (!target) break;
                    // Re-check target alive for subsequent attacks
                    if (atkIdx > 0 && target.hp.current <= 0) {
                        // Switch to next alive enemy
                        const nextTarget = combatState.combatants.find(c => c.type === 'enemy' && c.hp.current > 0);
                        if (!nextTarget) break;
                        target = nextTarget;
                    }

                    const atkFeatureCtx = {
                        ...featureContext,
                        // Sneak Attack only applies once per turn
                        sneakAttackDice: usedSneakAttack ? 0 : featureContext.sneakAttackDice,
                    };

                    const result = CombatResolutionEngine.resolveAttack(
                        currentCombatant,
                        target,
                        modifiers,
                        damageFormula,
                        dmgBonus,
                        isRanged,
                        forceDisadvantage,
                        this.getCombatLighting(),
                        atkFeatureCtx
                    );

                    // Track sneak attack usage
                    if (result.damage > 0 && featureContext.sneakAttackDice > 0 && !usedSneakAttack &&
                        result.message.includes('Sneak Attack')) {
                        usedSneakAttack = true;
                    }

                    // Ammo consumption (only on first ranged attack — others are assumed to have ammo)
                    if (isRanged && atkIdx === 0) {
                        if (ammoItem) {
                            ammoItem.quantity = (ammoItem.quantity || 1) - 1;
                            if (ammoItem.quantity <= 0) pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== ammoItem.instanceId);
                        } else if (CombatUtils.isThrownWeapon(mainHandItem)) {
                            pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== inventoryEntry?.instanceId);
                            pc.equipmentSlots.mainHand = undefined;
                        }
                    } else if (isRanged && atkIdx > 0 && ammoItem) {
                        ammoItem.quantity = (ammoItem.quantity || 1) - 1;
                        if (ammoItem.quantity <= 0) {
                            pc.inventory.items = pc.inventory.items.filter(i => i.instanceId !== ammoItem.instanceId);
                            // No more ammo — stop attacking
                            break;
                        }
                    }

                    if (result.details) {
                        combatState.lastRoll = {
                            value: result.details.roll || 0,
                            modifier: result.details.modifier || 0,
                            total: (result.details.roll || 0) + (result.details.modifier || 0),
                            label: attackCount > 1 ? `Attack ${atkIdx + 1}/${attackCount}` : 'Attack',
                            breakdown: result.details.rollDetails?.modifiers
                        };
                    } else {
                        combatState.lastRoll = 0;
                    }
                    this.emitCombatEvent(result.type, target.id, result.damage || 0);
                    const logMsg = (atkIdx > 0 ? `[Attack ${atkIdx + 1}] ` : '') + rangePrefix + CombatLogFormatter.format(result, currentCombatant.name, target.name, isRanged);
                    this.state.combat.turnActions.push(logMsg);
                    allAttackResults.push(logMsg);
                    await this.applyCombatDamage(target, result.damage);
                }

                resultMsg = allAttackResults.join(' | ');

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
        // Players are "alive" if they have HP > 0 OR are unconscious but not dead (still making death saves)
        const playersAlive = this.state.combat.combatants.some(c =>
            c.type === 'player' && (c.hp.current > 0 || (c.hp.current <= 0 && !hasCondition(c.conditions, 'Dead')))
        );

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
                // Sync persistent conditions from combat statusEffects to character conditions
                const persistentIDs = ['poisoned', 'blinded', 'deafened', 'frightened', 'paralyzed', 'stunned'];
                pcCombatant.statusEffects.forEach(effect => {
                    const id = effect.id.toLowerCase();
                    if (persistentIDs.includes(id) && !hasCondition(char.conditions, id)) {
                        addCondition(char.conditions, id, effect.sourceId, effect.duration);
                    }
                });
                // Sync ALL active status effects (buffs/debuffs) with remaining duration
                if (!char.statusEffects) (char as any).statusEffects = [];
                char.statusEffects = pcCombatant.statusEffects
                    .filter(e => (e.duration === undefined || e.duration > 0))
                    .map(e => ({ ...e }));
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

            // Apply difficulty scaling from DifficultyEngine
            const difficulty = ((this.state.settings as any)?.gameplay?.difficulty || 'normal') as DifficultyLevel;
            totalXP = DifficultyEngine.scaleXP(totalXP, difficulty);
            if (difficulty !== 'normal') {
                this.addCombatLog(`${difficulty === 'hard' ? 'Bonus' : 'Reduced'} XP for ${difficulty} difficulty.`);
            }

            // History T4 passive: +25% XP from all encounters
            if (SkillAbilityEngine.hasPassiveAbility(this.state.character, 'History', 4)) {
                const bonus = Math.floor(totalXP * 0.25);
                totalXP += bonus;
                this.addCombatLog(`Sage's Blessing: +${bonus} bonus XP!`);
            }

            // Reset per-encounter ability uses
            SkillAbilityEngine.resetEncounterUses(this.state.character);

            const char = this.state.character;
            char.xp += totalXP;
            this.addCombatLog(`You gained ${totalXP} Experience Points! (Total: ${char.xp})`);

            const defeatedEnemies = combatState.combatants.filter(c => c.type === 'enemy');
            for (const enemy of defeatedEnemies) {
                // Publish kill event for Quest Engine decoupled tracking
                EventBusManager.publish('COMBAT_KILL', { targetId: enemy.name, count: 1 });

                const monsterData = DataManager.getMonster(enemy.name);
                if (monsterData) {
                    const currentHex = this.state.worldMap?.hexes?.[this.state.location.hexId];
                    const biome = currentHex?.biome || 'Plains';
                    const loot = LootEngine.processDefeat(monsterData, biome);
                    char.inventory.gold.cp += loot.gold.cp;
                    char.inventory.gold.sp += loot.gold.sp;
                    char.inventory.gold.gp += loot.gold.gp;
                    char.inventory.gold.pp += loot.gold.pp;
                    if (!this.state.location.combatLoot) this.state.location.combatLoot = [];
                    const lootItems = loot.items.map(i => ({
                        ...i,
                        instanceId: i.instanceId || `loot_${Date.now()}_${Math.random()}`,
                        equipped: false
                    }));
                    this.state.location.combatLoot.push(...lootItems);

                    // Fire-and-forget: LLM names forged items, then persist Rare+ to catalog
                    for (const lootItem of lootItems) {
                        if (!(lootItem as any).isForged) continue;
                        const trueRarity = (lootItem as any).trueRarity || (lootItem as any).rarity;
                        const isRarePlus = ['Rare', 'Very Rare', 'Legendary'].includes(trueRarity);

                        this.resolveUniqueForgedName(lootItem, enemy.name, biome, isRarePlus)
                            .catch(() => {
                                if (isRarePlus) tryPersistForgedItem(lootItem).catch(() => {});
                            });
                    }
                }
            }

            // Check for level up — loop to handle multi-level jumps from large XP gains
            while (LevelingEngine.canLevelUp(char)) {
                const levelMsg = LevelingEngine.levelUp(char);
                Object.values(char.spellSlots).forEach(s => s.current = s.max);
                this.addCombatLog(`LEVEL UP! ${levelMsg} Spell Slots restored.`);
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

    private async endCombatAsFlee() {
        const combatState = this.state.combat;
        if (!combatState) return;

        this.addCombatLog("You flee the battle!");

        // Sync HP/spell slots back to character (same as victory sync)
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
        }

        // Sync companions
        this.state.companions.forEach((companion, index) => {
            const compId = `companion_${index}`;
            const compCombatant = combatState.combatants.find(c => c.id === compId);
            if (compCombatant) {
                companion.hp.current = compCombatant.hp.current;
                companion.hp.temp = compCombatant.hp.temp;
            }
        });

        // No XP, no loot — you ran away
        this.state.mode = 'EXPLORATION';
        const totalMinutes = Math.ceil((combatState.round || 0) * 6 / 60) + 2;
        this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, totalMinutes);
        this.state.combat = undefined;
        await this.emitStateUpdate();

        // LLM narrative for the flee
        try {
            const fleeContext = `The party narrowly escaped a deadly battle with ${combatState.combatants.filter(c => c.type === 'enemy').map(c => c.name).join(', ')}. The player was near death (${pcCombatant?.hp.current ?? 1} HP remaining). Describe the desperate flee in 2-3 sentences. Mention the close brush with death.`;
            const summary = await NarratorService.summarizeCombat(this.state, [
                ...combatState.logs || [],
                { id: 'flee', type: 'info', message: fleeContext }
            ]);
            this.state.lastNarrative = summary;
            this.state.conversationHistory.push({ role: 'narrator', content: summary, turnNumber: this.state.worldTime.totalTurns });
            this.contextManager.addEvent('narrator', summary);
            await this.emitStateUpdate();
        } catch (e) { console.error('[Flee Narrative]', e); }
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
                    0,
                    isRanged,
                    forceDisadvantage,
                    this.getCombatLighting()
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

                // Scale enemy damage by difficulty
                let finalDamage = result.damage;
                if (actor.type === 'enemy' && finalDamage > 0) {
                    const diff = ((this.state.settings as any)?.gameplay?.difficulty || 'normal') as DifficultyLevel;
                    finalDamage = DifficultyEngine.scaleEnemyDamage(finalDamage, diff);
                }

                this.emitCombatEvent(result.type, target.id, finalDamage || 0);
                await this.applyCombatDamage(target, finalDamage);
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

    /**
     * Resolve a unique name for a forged item via LLM with a multi-tier fallback:
     * 1. Up to 3 LLM naming attempts
     * 2. If all collide: reuse an existing catalog item whose name isn't in player inventory
     * 3. If all collided names are in player inventory: LLM generates a lore-flavored distinguisher
     * 4. Final fallback: mechanical suffix
     */
    private async resolveUniqueForgedName(lootItem: any, monsterName: string, biome: string, isRarePlus: boolean): Promise<void> {
        const ctx = { monsterName, biome };
        const MAX_RETRIES = 3;
        const collidedNames: string[] = [];

        // Tier 1: Up to 3 LLM naming attempts
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const { name, description } = await LoreService.nameForgedItem(lootItem, ctx);
                if (!this.isForgedNameInWorld(name)) {
                    this.applyForgedName(lootItem, name, description, isRarePlus);
                    return;
                }
                collidedNames.push(name);
            } catch {
                break; // LLM failure, proceed to fallbacks
            }
        }

        // Tier 2: Check if any collided name exists in catalog but NOT in player inventory
        const playerItems = this.state.character?.inventory?.items || [];
        for (const collidedName of collidedNames) {
            const inPlayerInv = playerItems.some((i: any) =>
                i.name?.toLowerCase() === collidedName.toLowerCase() ||
                i.trueName?.toLowerCase() === collidedName.toLowerCase()
            );
            if (!inPlayerInv) {
                // Import existing item data from catalog instead of the forged stats
                const catalogItem = DataManager.getItem(collidedName);
                if (catalogItem && catalogItem.name) {
                    // Replace loot item data with the catalog item, preserving instanceId
                    const instanceId = lootItem.instanceId;
                    Object.assign(lootItem, catalogItem, { instanceId, equipped: false });
                    if (isRarePlus) tryPersistForgedItem(lootItem).catch(() => {});
                    return;
                }
            }
        }

        // Tier 3: LLM lore-flavored distinguisher
        try {
            const { name, description } = await LoreService.nameForgedItem(lootItem, ctx);
            const distinguished = `${name} of the ${biome}`;
            if (!this.isForgedNameInWorld(distinguished)) {
                this.applyForgedName(lootItem, distinguished, description, isRarePlus);
                return;
            }
        } catch { /* proceed to final fallback */ }

        // Tier 4: Mechanical suffix
        const baseName = collidedNames[0] || lootItem.name;
        let suffixed = baseName;
        for (let i = 2; i < 100; i++) {
            suffixed = `${baseName} ${this.toRoman(i)}`;
            if (!this.isForgedNameInWorld(suffixed)) break;
        }
        this.applyForgedName(lootItem, suffixed, undefined, isRarePlus);
    }

    private applyForgedName(lootItem: any, name: string, description: string | undefined, isRarePlus: boolean): void {
        if (lootItem.identified === false) {
            lootItem.trueName = name;
            if (description) lootItem.lore = description;
        } else {
            lootItem.name = name;
            if (description) lootItem.description = description;
        }
        if (isRarePlus) tryPersistForgedItem(lootItem).catch(() => {});
    }

    private toRoman(num: number): string {
        const vals = [10, 9, 5, 4, 1];
        const syms = ['X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        for (let i = 0; i < vals.length; i++) {
            while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
        }
        return result;
    }

    /**
     * Check if a forged item name already exists anywhere in the game world:
     * player inventory, combat loot on the ground, merchant shops, or persisted catalog.
     */
    /**
     * Determine current combat lighting based on time of day and weather.
     */
    private getCombatLighting(): LightLevel {
        const hour = this.state.worldTime?.hour ?? 12;
        const weather = (this.state as any).weather?.type || 'Clear';
        // Night: 21:00-05:00 = Darkness, Dawn/Dusk: 05-07 / 19-21 = Dim
        if (hour >= 21 || hour < 5) return weather === 'Storm' ? 'Darkness' : 'Darkness';
        if (hour < 7 || hour >= 19) return 'Dim';
        if (weather === 'Fog' || weather === 'Storm') return 'Dim';
        return 'Bright';
    }

    private isForgedNameInWorld(name: string): boolean {
        const lowerName = name.toLowerCase();

        // Player inventory (name or trueName)
        const inv = this.state.character?.inventory?.items || [];
        if (inv.some((i: any) => i.name?.toLowerCase() === lowerName || i.trueName?.toLowerCase() === lowerName)) return true;

        // Combat loot on the ground
        const loot = (this.state.location as any)?.combatLoot || [];
        if (loot.some((i: any) => i.name?.toLowerCase() === lowerName || i.trueName?.toLowerCase() === lowerName)) return true;

        // Merchant inventories (string arrays of item names)
        const npcs = this.state.worldNpcs || [];
        if (npcs.some((n: any) => n.shopState?.inventory?.some((id: string) => id.toLowerCase() === lowerName))) return true;

        // Persisted catalog (DataManager)
        if (DataManager.getItem(name)) return true;

        return false;
    }
}
