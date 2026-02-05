import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './CombatActionBar.module.css';
import { ActionButton } from './ActionButton';
import { SpellbookFlyout } from './SpellbookFlyout';
import { Sword, Sparkles, Shield, Zap, ChevronRight, FastForward } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';
export const CombatActionBar = () => {
    const { state, processCommand } = useGameState();
    const [showSpells, setShowSpells] = useState(false);
    const [availableSpells, setAvailableSpells] = useState([]);
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
    return (_jsxs("div", { className: styles.actionBar, children: [_jsxs("div", { className: styles.group, children: [_jsx(ActionButton, { icon: _jsx(Sword, { size: 24 }), label: "Attack", hotkey: "1", onClick: () => handleAction('attack'), tooltip: "Perform a weapon attack" }), _jsx(ActionButton, { icon: _jsx(Sparkles, { size: 24 }), label: "Spells", hotkey: "2", onClick: () => setShowSpells(!showSpells), active: showSpells, disabled: availableSpells.length === 0, disabledReason: "No spells prepared", tooltip: "Open spellbook" })] }), _jsx("div", { className: styles.divider }), _jsxs("div", { className: styles.group, children: [_jsx(ActionButton, { icon: _jsx(Shield, { size: 24 }), label: "Dodge", hotkey: "3", onClick: () => handleAction('dodge'), tooltip: "Take a defensive stance" }), _jsx(ActionButton, { icon: _jsx(Zap, { size: 24 }), label: "Dash", hotkey: "4", onClick: () => handleAction('dash'), tooltip: "Move double your speed" }), _jsx(ActionButton, { icon: _jsx(ChevronRight, { size: 24 }), label: "Disengage", hotkey: "5", onClick: () => handleAction('disengage'), tooltip: "Move without provoking opportunity attacks" })] }), _jsx("div", { className: styles.divider }), _jsx("div", { className: styles.group, children: _jsx(ActionButton, { icon: _jsx(FastForward, { size: 24 }), label: "End Turn", hotkey: "SPACE", className: styles.endTurnButton, onClick: () => handleAction('end turn'), tooltip: "Finish your turn" }) }), showSpells && (_jsx(SpellbookFlyout, { spells: availableSpells, spellSlots: state.character.spellSlots, onCast: handleCastSpell, onClose: () => setShowSpells(false) }))] }));
};
export default CombatActionBar;
