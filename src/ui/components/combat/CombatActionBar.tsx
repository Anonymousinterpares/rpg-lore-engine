import React, { useState, useEffect } from 'react';
import styles from './CombatActionBar.module.css';
import { ActionButton } from './ActionButton';
import { SpellbookFlyout } from './SpellbookFlyout';
import { AbilitiesFlyout } from './AbilitiesFlyout';
import { Sword, Sparkles, Shield, Zap, Move, ChevronRight, FastForward, Star, Target } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { TacticalOption } from '../../../ruleset/combat/grid/CombatAnalysisEngine';
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

    const mainHandId = state.character.equipmentSlots.mainHand;
    const mainHandItem = mainHandId ? DataManager.getItem(mainHandId) : null;
    const isRangedEquipped = CombatUtils.isRangedWeapon(mainHandItem);

    const handleAction = (command: string) => {
        processCommand(command);
    };

    const handleCastSpell = (spell: Spell) => {
        if (!engine || !state?.combat) return;

        // Use the public castSpell API instead of processCommand
        const targetId = state.combat.selectedTargetId;
        engine.castSpell(spell.name, targetId);
        updateState();
        setShowSpells(false);
    };

    const handleUseAbility = (ability: CombatAbility) => {
        processCommand(`/use ${ability.name}`);
        setShowAbilities(false);
    };

    const handleSelectTactical = (option: TacticalOption) => {
        processCommand(option.command);
        setShowTactics(false);
    };

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
                    tooltip="Perform a weapon attack"
                />
                {isRangedEquipped && (
                    <ActionButton
                        icon={<Target size={24} />}
                        label="Ranged"
                        hotkey="R"
                        onClick={() => handleAction('attack ranged')}
                        disabled={!isPlayerTurn || hasUsedAction}
                        disabledReason={!isPlayerTurn ? "Not your turn" : "Action already used"}
                        tooltip="Perform a ranged weapon attack"
                    />
                )}
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
                    disabled={!isPlayerTurn}
                    disabledReason={!isPlayerTurn ? "Not your turn" : ""}
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
                    icon={<Zap size={24} />}
                    label="Dash"
                    hotkey="5"
                    onClick={() => handleAction('dash')}
                    disabled={!isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : "Action already used"}
                    tooltip="Move double your speed"
                />
                <ActionButton
                    icon={<ChevronRight size={24} />}
                    label="Disengage"
                    hotkey="6"
                    onClick={() => handleAction('disengage')}
                    disabled={!isPlayerTurn || hasUsedAction}
                    disabledReason={!isPlayerTurn ? "Not your turn" : "Action already used"}
                    tooltip="Move without provoking opportunity attacks"
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
                    spellSlots={state?.character?.spellSlots}
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
