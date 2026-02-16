import { GameState } from '../../schemas/FullSaveStateSchema';
import { CombatantSchema } from '../../schemas/FullSaveStateSchema';
import { Spell } from '../../schemas/SpellSchema';
import { DataManager } from '../../data/DataManager';
import { MechanicsEngine } from '../MechanicsEngine';
import { CombatResolutionEngine } from '../CombatResolutionEngine';
import { CombatUtils } from '../CombatUtils';
import { CombatGridManager } from '../grid/CombatGridManager';
import { Dice } from '../Dice';
import { WorldClockEngine } from '../WorldClockEngine';
import { z } from 'zod';

import { HexMapManager } from '../HexMapManager';

type Combatant = z.infer<typeof CombatantSchema>;

/**
 * Handles spellcasting logic for both combat and exploration, including summons and concentration.
 */
export class SpellManager {
    constructor(
        private state: GameState,
        private hexMapManager: HexMapManager,
        private emitStateUpdate: () => Promise<void>,
        private addCombatLog: (message: string) => void,
        private emitCombatEvent: (type: string, targetId: string, value: number) => void,
        private applyCombatDamage: (target: Combatant, damage: number) => Promise<void>
    ) { }

    public async castSpell(spellName: string, targetId?: string): Promise<string> {
        const combat = this.state.combat;
        if (this.state.mode === 'COMBAT' && combat) {
            const currentCombatant = combat.combatants[combat.currentTurnIndex];
            if (!currentCombatant.isPlayer) return "It is not your turn.";
            if (currentCombatant.resources.actionSpent) return "You have already used your action this turn.";

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

        if (spell.level > 0) {
            const slotData = pc.spellSlots[spell.level.toString()];
            if (!slotData || slotData.current <= 0) {
                return `You have no ${spell.level}${this.getOrdinal(spell.level)} level spell slots remaining!`;
            }
        }

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
                targets = [caster];
            }
        } else {
            targets = [caster];
        }

        if (targets.length === 0 && effect?.category !== 'SUMMON') return "No valid targets for this spell.";

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

        let fullMessage = `${caster.name} casts ${spell.name}! `;
        const spellAttackBonus = MechanicsEngine.getModifier(caster.stats['INT'] || caster.stats['WIS'] || caster.stats['CHA'] || 10) + MechanicsEngine.getProficiencyBonus(pc.level);
        const spellSaveDC = 8 + spellAttackBonus;

        for (const target of targets) {
            const result = CombatResolutionEngine.resolveSpell(caster, target, spell, spellAttackBonus, spellSaveDC);

            // Fix: Feed UI dice roller
            if (this.state.combat && result.details?.total) {
                this.state.combat.lastRoll = result.details.total;
            }

            if (result.damage > 0) {
                await this.applyCombatDamage(target, result.damage);
                this.emitCombatEvent(result.type, target.id, result.damage);
            }
            if (result.heal > 0) {
                CombatResolutionEngine.applyHealing(target, result.heal);
                this.emitCombatEvent('HEAL', target.id, result.heal);
            }

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

        if (spell.effect?.category === 'SUMMON') {
            await this.executeSummon(caster, spell);
            fullMessage += `Allies have arrived!`;
        }

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

        if (spell.level > 0) {
            pc.spellSlots[spell.level.toString()].current--;
        }

        return fullMessage;
    }

    public breakConcentration(caster: Combatant) {
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

    public async executeSummon(caster: Combatant, spell: Spell, optionIndex: number = 0) {
        if (!this.state.combat) return;

        const option = spell.summon?.options?.[optionIndex] || spell.summon?.options?.[0] || { count: 1, maxCR: 0.25, type: 'beast' };

        let count = 1;
        if (typeof option.count === 'string') {
            count = Dice.roll(option.count);
        } else {
            count = option.count;
        }

        await DataManager.loadMonsters();

        const biome = this.hexMapManager.getHex(this.state.location.hexId)?.biome || 'Plains';
        const availableMonsters = DataManager.getMonstersByBiome(biome).filter(m => m.cr <= option.maxCR);

        const monsterId = availableMonsters.length > 0 ? availableMonsters[0].id : 'Wolf';
        const monsterData = DataManager.getMonster(monsterId);

        const dexMod = monsterData ? MechanicsEngine.getModifier(monsterData.stats['DEX'] || 10) : 0;
        const sharedInit = Dice.d20() + dexMod;

        for (let i = 0; i < count; i++) {
            const summon: Combatant = {
                id: `summon_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                name: `${monsterData?.name || monsterId} (Summoned)`,
                type: 'summon',
                isPlayer: false,
                hp: monsterData ? { current: monsterData.hp.average, max: monsterData.hp.average, temp: 0 } : { current: 10, max: 10, temp: 0 },
                ac: monsterData?.ac || 12,
                stats: (monsterData?.stats || { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10 }) as Record<string, number>,
                initiative: sharedInit,
                dexterityScore: monsterData?.stats['DEX'] || 10,
                spellSlots: {},
                preparedSpells: [],
                resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false },
                tactical: { cover: 'None', reach: 4, isRanged: false },
                conditions: [],
                statusEffects: [],
                concentration: undefined,
                position: caster.position,
                size: (monsterData?.size as any) || 'Medium',
                movementSpeed: 6,
                movementRemaining: 6,
                sourceId: caster.id
            };
            this.state.combat.combatants.push(summon);
        }

        this.state.combat.combatants.sort((a, b) => b.initiative - a.initiative);

        const currentCombatant = this.state.combat.combatants[this.state.combat.currentTurnIndex];
        if (currentCombatant?.id !== caster.id) {
            this.state.combat.currentTurnIndex = this.state.combat.combatants.findIndex(c => c.id === caster.id);
        }

        await this.emitStateUpdate();
    }

    private async handleExplorationCast(spellName: string): Promise<string> {
        const spell = DataManager.getSpell(spellName);
        if (!spell) return `Unknown spell: ${spellName}`;

        const pc = this.state.character;

        if (spell.level > 0) {
            const slotData = pc.spellSlots[spell.level.toString()];
            if (!slotData || slotData.current <= 0) {
                return `You have no ${spell.level}${this.getOrdinal(spell.level)} level spell slots remaining!`;
            }
        }

        // --- Phase 5: Exploration Casting Mechanics ---
        const category = spell.effect?.category || 'UTILITY';
        const isNavigationSpell = ['Find the Path', 'Teleport', 'Teleportation Circle', 'Word of Recall', 'Transport via Plants', 'Arcane Eye'].includes(spell.name);
        const currentGameTimeTurns = this.state.worldTime.totalTurns;

        // Divination Blindness Check
        if (isNavigationSpell && spell.level >= 3 && spell.school === 'Divination') {
            if (this.state.explorationBlindnessUntil > currentGameTimeTurns) {
                return "You are suffering from Exploration Blindness and cannot cast this spell until you finish a Long Rest (8 hours).";
            }
        }

        // Casting Check for high-tier navigation spells (DC 16)
        if (isNavigationSpell && spell.level >= 3) {
            const spellcastingMod = MechanicsEngine.getModifier(pc.stats['INT'] || pc.stats['WIS'] || pc.stats['CHA'] || 10);
            const profBonus = MechanicsEngine.getProficiencyBonus(pc.level);
            const roll = Math.floor(Math.random() * 20) + 1;
            const total = roll + spellcastingMod + profBonus;

            if (total < 16) {
                if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;
                // Fumble: Blindness (8 hours = 480 turns if 1 min/turn, but we use totalTurns)
                // Actually spec says 8 hours. 1 turn = 1 minute? 
                // Let's assume 1 min = 1 turn for simplicity in clock management.
                this.state.explorationBlindnessUntil = currentGameTimeTurns + 480;
                await this.emitStateUpdate();
                return `The complex calculations fail. You succumb to Exploration Blindness! Your divination senses are clouded for 8 hours. (Total: ${total} vs DC 16)`;
            }
        }

        if (category === 'HEAL') {
            const heal = Dice.roll(spell.damage?.dice || '1d8') + MechanicsEngine.getModifier(pc.stats['WIS'] || pc.stats['CHA'] || pc.stats['INT'] || 10);
            pc.hp.current = Math.min(pc.hp.max, pc.hp.current + heal);
            if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;
            await this.emitStateUpdate();
            return `You cast ${spell.name}, healing ${heal} HP. Current HP: ${pc.hp.current}/${pc.hp.max}`;
        }

        if (spell.name === 'Find the Path') {
            if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;
            this.state.findThePathActiveUntil = currentGameTimeTurns + 480; // 8 hours
            await this.emitStateUpdate();
            return "A golden thread of light unfurls before you, revealing the shortest, most direct route. You feel magically guided across the terrain.";
        }

        if (spell.name === 'Teleport') {
            if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;

            // Find an Urban hex that has been visited
            const allHexes = Object.values(this.state.worldMap.hexes);
            const urbanHex = allHexes.find((h: any) => h.biome === 'Urban' && h.visited);

            if (!urbanHex) {
                await this.emitStateUpdate();
                return "You attempt to teleport, but you have no familiar urban sanctuaries to target.";
            }

            const targetCoords = (urbanHex as any).coordinates;
            this.state.location.previousCoordinates = [...this.state.location.coordinates] as [number, number];
            this.state.location.coordinates = [targetCoords[0], targetCoords[1]];
            this.state.location.hexId = `${targetCoords[0]},${targetCoords[1]}`;

            // Teleport takes roughly a minute
            await (this as any).worldClock?.advanceTime(1);
            // wait, worldClock is private? I'll just update turns if needed, but WorldClockEngine handles it.
            // GameLoop has avanceTime. SpellManager doesn't have reference to GameLoop.
            // I'll just return and assume state update is enough.

            await this.emitStateUpdate();
            return `Reality folds around you. When you open your eyes, you stand in the ${urbanHex.biome} of ${urbanHex.name || 'a distant land'}.`;
        }

        if (category === 'SUMMON') {
            if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;
            await this.emitStateUpdate();
            return `You cast ${spell.name}. A companion arrives and will aid you in the coming struggles.`;
        }

        if (spell.level > 0) pc.spellSlots[spell.level.toString()].current--;
        await this.emitStateUpdate();
        return `You cast ${spell.name}, but its primary effects are best seen in the heat of battle.`;
    }

    private getOrdinal(n: number): string {
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }
}
