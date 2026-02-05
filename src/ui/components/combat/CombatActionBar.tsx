import React, { useState, useEffect } from 'react';
import styles from './CombatActionBar.module.css';
import { ActionButton } from './ActionButton';
import { SpellbookFlyout } from './SpellbookFlyout';
import { Sword, Sparkles, Shield, Zap, Package, ChevronRight, FastForward } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';
import { Spell } from '../../../ruleset/schemas/SpellSchema';

export const CombatActionBar: React.FC = () => {
    const { state, processCommand } = useGameState();
    const [showSpells, setShowSpells] = useState(false);
    const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);

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

                const allNames = [...pcCantrips, ...pcPrepared];
                const spells = allNames
                    .map(name => DataManager.getSpell(name))
                    .filter((s): s is Spell => s !== undefined);

                setAvailableSpells(spells);
            }
        };
        loadSpells();
    }, [state?.combat, state?.character]);

    if (!state?.combat) return null;

    const handleAction = (command: string) => {
        processCommand(command);
    };

    const handleCastSpell = (spell: Spell) => {
        processCommand(`/cast ${spell.name}`);
        setShowSpells(false);
    };

    return (
        <div className={styles.actionBar}>
            <div className={styles.group}>
                <ActionButton
                    icon={<Sword size={24} />}
                    label="Attack"
                    hotkey="1"
                    onClick={() => handleAction('attack')}
                    tooltip="Perform a weapon attack"
                />
                <ActionButton
                    icon={<Sparkles size={24} />}
                    label="Spells"
                    hotkey="2"
                    onClick={() => setShowSpells(!showSpells)}
                    active={showSpells}
                    disabled={availableSpells.length === 0}
                    disabledReason="No spells prepared"
                    tooltip="Open spellbook"
                />
            </div>

            <div className={styles.divider} />

            <div className={styles.group}>
                <ActionButton
                    icon={<Shield size={24} />}
                    label="Dodge"
                    hotkey="3"
                    onClick={() => handleAction('dodge')}
                    tooltip="Take a defensive stance"
                />
                <ActionButton
                    icon={<Zap size={24} />}
                    label="Dash"
                    hotkey="4"
                    onClick={() => handleAction('dash')}
                    tooltip="Move double your speed"
                />
                <ActionButton
                    icon={<ChevronRight size={24} />}
                    label="Disengage"
                    hotkey="5"
                    onClick={() => handleAction('disengage')}
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
                    spellSlots={state.character.spellSlots}
                    onCast={handleCastSpell}
                    onClose={() => setShowSpells(false)}
                />
            )}
        </div>
    );
};

export default CombatActionBar;
