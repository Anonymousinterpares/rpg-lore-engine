import React, { useState, useEffect } from 'react';
import { CombatGridManager } from '../../../ruleset/combat/grid/CombatGridManager';
import styles from './CombatActionBar.module.css';
import { ActionButton } from './ActionButton';
import { SpellbookFlyout } from './SpellbookFlyout';
import { AbilitiesFlyout } from './AbilitiesFlyout';
import { Sword, Sparkles, Shield, Zap, Move, ChevronRight, FastForward, Star, Target, Dices, DoorOpen } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { TacticalOption, TacticalSubOption } from '../../../ruleset/combat/grid/CombatAnalysisEngine';
import { TacticalFlyout } from './TacticalFlyout';
import { AbilityParser, CombatAbility } from '../../../ruleset/combat/AbilityParser';
import { DataManager } from '../../../ruleset/data/DataManager';
import { Spell } from '../../../ruleset/schemas/SpellSchema';
import { CombatUtils } from '../../../ruleset/combat/CombatUtils';

export const CombatActionBar: React.FC = () => {
    const { state, engine, processCommand, updateState, getTacticalOptions } = useGameState();
    const [showSpells, setShowSpells] = useState(false);
    const [showAbilities, setShowAbilities] = useState(false);
    const [showTactics, setShowTactics] = useState(false);
    const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);
    const [availableAbilities, setAvailableAbilities] = useState<CombatAbility[]>([]);

    useEffect(() => {
        const loadSpells = async () => {
            if (!state?.combat) return;
            await DataManager.loadSpells();

            const player = state.combat.combatants.find(c => c.id === 'player');
            if (player) {
                // In a real scenario, we'd get the actual PC state with prepared spells
                // For now, we'll simulate fetching them from DataManager based on the combatant state
                const pcPrepared = state.character.preparedSpells || [];
                const pcCantrips = state.character.cantripsKnown || [];

                const allNames = Array.from(new Set([...pcCantrips, ...pcPrepared]));
                const spells = allNames
                    .map(name => DataManager.getSpell(name))
                    .filter((s): s is Spell => s !== undefined);

                setAvailableSpells(spells);

                // Fetch Class Abilities
                const abilities = AbilityParser.getActiveAbilities(state.character);
                setAvailableAbilities(abilities);
            }
        };
        loadSpells();
    }, [state?.combat, state?.character]);

    if (!state?.combat) return null;

    const player = state.combat.combatants.find(c => c.id === 'player');
    const isPlayerTurn = state.combat.combatants[state.combat.currentTurnIndex]?.isPlayer;
    const hasUsedAction = player?.resources?.actionSpent || false;
    const hasMovement = (player?.movementRemaining ?? 0) > 0;

    const gridManager = state.combat.grid ? new CombatGridManager(state.combat.grid) : null;
    const isAdjacentToEnemy = player && gridManager ? state.combat.combatants.some(c =>
        c.type === 'enemy' && c.hp.current > 0 && gridManager.getDistance(player.position, c.position) === 1
    ) : false;

    // Death save state
    const isPlayerDowned = player && player.hp.current <= 0 && player.conditions?.some?.((c: any) => (c.id || c) === 'Unconscious');
    const deathSaves = player?.deathSaves;

    const mainHandId = state.character.equipmentSlots.mainHand;
    const inventoryItem = mainHandId ? state.character.inventory.items.find(i => i.instanceId === mainHandId) : null;
    const definitionItem = inventoryItem ? DataManager.getItem(inventoryItem.id) as any : null;

    // Merge: Use definition for stats (fresh), inventory for state (instanceId, equipped)
    // This provides a safety layer in case an item instance is missing data
    const mainHandItem = (inventoryItem && definitionItem ? { ...definitionItem, ...inventoryItem, range: definitionItem.range, properties: definitionItem.properties } : null) as any;

    const isRangedEquipped = CombatUtils.isRangedWeapon(mainHandItem);

    // Dynamic Tooltip Calculation for Ranged Attack
    const getRangedTooltip = () => {
        if (!isRangedEquipped) return "No ranged weapon equipped";
        if (!state.combat?.selectedTargetId) return "Select a target to see range info";

        const target = state.combat.combatants.find(c => c.id === state.combat?.selectedTargetId);
        if (!target || !player) return "Perform a ranged weapon attack";

        // Simple Hex distance calculation: max(|dq|, |dr|, |dq+dr|)
        const dq = target.position.x - player.position.x;
        const dr = target.position.y - player.position.y;
        const distanceCells = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
        const distanceFt = distanceCells * 5;

        const normalRange = mainHandItem?.range?.normal || 0;
        const maxRange = mainHandItem?.range?.long || normalRange;

        if (distanceFt <= normalRange) {
            return `Normal Shot (${distanceFt}ft). No penalties.`;
        } else if (distanceFt <= maxRange) {
            return `Long Shot (${distanceFt}ft). Attack has Disadvantage.`;
        } else {
            return `Target too far (${distanceFt}ft)! Max range is ${maxRange}ft.`;
        }
    };

    const handleAction = async (command: string) => {
        await processCommand(command);
    };

    const handleCastSpell = async (spell: Spell, slotLevel?: number) => {
        if (!engine || !state?.combat) return;

        const targetId = state.combat.selectedTargetId;
        await engine.castSpell(spell.name, targetId, slotLevel);
        setShowSpells(false);
    };

    const handleUseAbility = async (ability: CombatAbility) => {
        await processCommand(`/use ${ability.name}`);
        setShowAbilities(false);
    };

    const handleSelectTactical = async (option: TacticalOption | TacticalSubOption) => {
        if (option.command) {
            await processCommand(option.command);
            setShowTactics(false);
        }
    };

    const getMeleeTooltip = () => {
        if (!player) return "Perform a weapon attack";
        const mainHandId = state.character.equipmentSlots.mainHand;
        const inventoryEntry = mainHandId ? state.character.inventory.items.find(i => i.instanceId === mainHandId) : null;
        const item = inventoryEntry ? DataManager.getItem(inventoryEntry.id) : null;
        const hasUnarmedSkill = state.character.skillProficiencies.includes('Unarmed Combat');

        if (!item) {
            return hasUnarmedSkill
                ? `Unarmed Strike (1d4 + STR + Prof) [Trained]`
                : `Unarmed Strike (1d4 + STR)`;
        }

        if (CombatUtils.isRangedWeapon(item)) {
            return `⚠️ Improvised melee with ${item.name} (1d4 Bludgeoning, Disadvantage)`;
        }

        return `Attack with ${item.name} (${(item as any).damage?.dice || '1d8'})`;
    };

    // When player is downed, show ONLY the death save button
    if (isPlayerDowned && isPlayerTurn) {
        return (
            <div className={styles.actionBar}>
                <div className={styles.group}>
                    <button
                        className={styles.deathSaveButton}
                        onClick={() => handleAction('death_save')}
                        title={deathSaves ? `Successes: ${deathSaves.successes}/3 | Failures: ${deathSaves.failures}/3` : 'Roll a Death Save'}
                    >
                        <Dices size={32} />
                        <span className={styles.deathSaveLabel}>Roll Death Save</span>
                        {deathSaves && (
                            <span className={styles.deathSaveTracker}>
                                {Array(3).fill(0).map((_, i) => (
                                    <span key={`s${i}`} className={i < deathSaves.successes ? styles.saveSuccess : styles.saveDot}>&#9679;</span>
                                ))}
                                {' / '}
                                {Array(3).fill(0).map((_, i) => (
                                    <span key={`f${i}`} className={i < deathSaves.failures ? styles.saveFail : styles.saveDot}>&#9679;</span>
                                ))}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.actionBar}>
            <div className={styles.group}>
                <ActionButton
                    icon={<Sword size={24} />}
                    label="Attack"
                    hotkey="1"
                    onClick={() => handleAction('attack')}
                    disabled={!isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : "Action already used"}
                    tooltip={getMeleeTooltip()}
                />
                <ActionButton
                    icon={<Target size={24} />}
                    label="Ranged"
                    hotkey="R"
                    onClick={() => handleAction('attack ranged')}
                    disabled={!isPlayerTurn || hasUsedAction || !isRangedEquipped}
                    disabledReason={!isPlayerTurn ? "Not your turn" : (hasUsedAction ? "Action already used" : "No ranged weapon equipped")}
                    tooltip={getRangedTooltip()}
                />
                <ActionButton
                    icon={<Sparkles size={24} />}
                    label="Spells"
                    hotkey="2"
                    onClick={() => { setShowSpells(!showSpells); setShowAbilities(false); setShowTactics(false); }}
                    active={showSpells}
                    disabled={availableSpells.length === 0 || !isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : (hasUsedAction ? "Action already used" : "No spells prepared")}
                    tooltip="Open spellbook"
                />
                <ActionButton
                    icon={<Star size={24} />}
                    label="Abilities"
                    hotkey="3"
                    onClick={() => { setShowAbilities(!showAbilities); setShowSpells(false); setShowTactics(false); }}
                    active={showAbilities}
                    disabled={availableAbilities.length === 0 || !isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : (hasUsedAction ? "Action already used" : "No class abilities")}
                    tooltip="Use class features"
                />
            </div>

            <div className={styles.divider} />

            <div className={styles.group}>
                <ActionButton
                    icon={<Move size={24} />}
                    label="Tactics"
                    hotkey="Q"
                    onClick={() => { setShowTactics(!showTactics); setShowSpells(false); setShowAbilities(false); }}
                    active={showTactics}
                    disabled={!isPlayerTurn || !hasMovement || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : !hasMovement ? "No movement remaining" : hasUsedAction ? "Action already used" : ""}
                    tooltip="Analyze field for tactical maneuvers"
                />
                <ActionButton
                    icon={<Shield size={24} />}
                    label="Dodge"
                    hotkey="4"
                    onClick={() => handleAction('dodge')}
                    disabled={!isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : "Action already used"}
                    tooltip="Take a defensive stance"
                />
                <ActionButton
                    icon={<ChevronRight size={24} />}
                    label="Disengage"
                    hotkey="6"
                    onClick={() => handleAction('disengage')}
                    disabled={!isPlayerTurn || hasUsedAction || !isAdjacentToEnemy}
                    disabledReason={!isPlayerTurn ? "Not your turn" : hasUsedAction ? "Action already used" : !isAdjacentToEnemy ? "Must be next to an enemy" : ""}
                    tooltip="Move without provoking opportunity attacks"
                />
                <ActionButton
                    icon={<DoorOpen size={24} />}
                    label="Flee"
                    hotkey="F"
                    onClick={() => handleAction('flee')}
                    disabled={!isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : "Action already used"}
                    tooltip="Attempt to escape combat (contested Athletics/Acrobatics check, enemies get opportunity attacks)"
                />
            </div>

            <div className={styles.divider} />

            <div className={styles.group}>
                <ActionButton
                    icon={<FastForward size={24} />}
                    label="End Turn"
                    hotkey="SPACE"
                    className={styles.endTurnButton}
                    onClick={() => handleAction('end turn')}
                    tooltip="Finish your turn"
                />
            </div>

            {showSpells && (
                <SpellbookFlyout
                    spells={availableSpells}
                    spellSlots={player?.spellSlots || state?.character?.spellSlots}
                    distanceToTarget={(() => {
                        if (!player || !gridManager) return undefined;
                        // Use selected target, or nearest enemy
                        const target = state.combat?.selectedTargetId
                            ? state.combat.combatants.find(c => c.id === state.combat?.selectedTargetId)
                            : null;
                        const enemies = state.combat!.combatants.filter(c => c.type === 'enemy' && c.hp.current > 0);
                        const ref = target || enemies[0];
                        if (!ref) return undefined;
                        const dq = ref.position.x - player.position.x;
                        const dr = ref.position.y - player.position.y;
                        return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) * 5;
                    })()}
                    onCast={handleCastSpell}
                    onClose={() => setShowSpells(false)}
                />
            )}
            {showAbilities && (
                <AbilitiesFlyout
                    abilities={availableAbilities}
                    onUse={handleUseAbility}
                    onClose={() => setShowAbilities(false)}
                />
            )}
            {showTactics && (
                <TacticalFlyout
                    options={getTacticalOptions()}
                    onSelect={handleSelectTactical}
                    onClose={() => setShowTactics(false)}
                />
            )}
        </div>
    );
};

export default CombatActionBar;
