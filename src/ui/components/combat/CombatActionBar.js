import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './CombatActionBar.module.css';
import { ActionButton } from './ActionButton';
import { SpellbookFlyout } from './SpellbookFlyout';
import { AbilitiesFlyout } from './AbilitiesFlyout';
import { Sword, Sparkles, Shield, Zap, ChevronRight, FastForward, Star } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { AbilityParser } from '../../../ruleset/combat/AbilityParser';
import { DataManager } from '../../../ruleset/data/DataManager';
export const CombatActionBar = () => {
    const { state, processCommand } = useGameState();
    const [showSpells, setShowSpells] = useState(false);
    const [showAbilities, setShowAbilities] = useState(false);
    const [availableSpells, setAvailableSpells] = useState([]);
    const [availableAbilities, setAvailableAbilities] = useState([]);
    useEffect(() => {
        const loadSpells = async () => {
            if (!state?.combat)
                return;
            await DataManager.loadSpells();
            const player = state.combat.combatants.find(c => c.id === 'player');
            if (player) {
                // In a real scenario, we'd get the actual PC state with prepared spells
                // For now, we'll simulate fetching them from DataManager based on the combatant state
                const pcPrepared = state.character.preparedSpells || [];
                const pcCantrips = state.character.cantripsKnown || [];
                const allNames = [...pcCantrips, ...pcPrepared];
                const spells = allNames
                    .map(name => DataManager.getSpell(name))
                    .filter((s) => s !== undefined);
                setAvailableSpells(spells);
                // Fetch Class Abilities
                const abilities = AbilityParser.getActiveAbilities(state.character);
                setAvailableAbilities(abilities);
            }
        };
        loadSpells();
    }, [state?.combat, state?.character]);
    if (!state?.combat)
        return null;
    const handleAction = (command) => {
        processCommand(command);
    };
    const handleCastSpell = (spell) => {
        processCommand(`/cast ${spell.name}`);
        setShowSpells(false);
    };
    const handleUseAbility = (ability) => {
        processCommand(`/use ${ability.name}`);
        setShowAbilities(false);
    };
    return (_jsxs("div", { className: styles.actionBar, children: [_jsxs("div", { className: styles.group, children: [_jsx(ActionButton, { icon: _jsx(Sword, { size: 24 }), label: "Attack", hotkey: "1", onClick: () => handleAction('attack'), tooltip: "Perform a weapon attack" }), _jsx(ActionButton, { icon: _jsx(Sparkles, { size: 24 }), label: "Spells", hotkey: "2", onClick: () => { setShowSpells(!showSpells); setShowAbilities(false); }, active: showSpells, disabled: availableSpells.length === 0, disabledReason: "No spells prepared", tooltip: "Open spellbook" }), _jsx(ActionButton, { icon: _jsx(Star, { size: 24 }), label: "Abilities", hotkey: "3", onClick: () => { setShowAbilities(!showAbilities); setShowSpells(false); }, active: showAbilities, disabled: availableAbilities.length === 0, disabledReason: "No class abilities", tooltip: "Use class features" })] }), _jsx("div", { className: styles.divider }), _jsxs("div", { className: styles.group, children: [_jsx(ActionButton, { icon: _jsx(Shield, { size: 24 }), label: "Dodge", hotkey: "4", onClick: () => handleAction('dodge'), tooltip: "Take a defensive stance" }), _jsx(ActionButton, { icon: _jsx(Zap, { size: 24 }), label: "Dash", hotkey: "5", onClick: () => handleAction('dash'), tooltip: "Move double your speed" }), _jsx(ActionButton, { icon: _jsx(ChevronRight, { size: 24 }), label: "Disengage", hotkey: "6", onClick: () => handleAction('disengage'), tooltip: "Move without provoking opportunity attacks" })] }), _jsx("div", { className: styles.divider }), _jsx("div", { className: styles.group, children: _jsx(ActionButton, { icon: _jsx(FastForward, { size: 24 }), label: "End Turn", hotkey: "SPACE", className: styles.endTurnButton, onClick: () => handleAction('end turn'), tooltip: "Finish your turn" }) }), showSpells && (_jsx(SpellbookFlyout, { spells: availableSpells, spellSlots: state.character.spellSlots, onCast: handleCastSpell, onClose: () => setShowSpells(false) })), showAbilities && (_jsx(AbilitiesFlyout, { abilities: availableAbilities, onUse: handleUseAbility, onClose: () => setShowAbilities(false) }))] }));
};
export default CombatActionBar;
