import React from 'react';
import styles from './CharacterPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import HealthBar from './HealthBar';
import XPBar from './XPBar';
import ConditionDisplay from './ConditionDisplay';
import SpellSlotTracker from './SpellSlotTracker';
import { Sword, Shield, Zap } from 'lucide-react';
import GameTooltip from '../common/GameTooltip';

import { useGameState } from '../../hooks/useGameState';
import { MechanicsEngine } from '../../../ruleset/combat/MechanicsEngine';
import { getACBonus, getStatBonus } from '../../utils/effectiveStats';

interface CharacterPanelProps {
    onCharacter?: () => void;
    onSkills?: () => void;
}

const CharacterPanel: React.FC<CharacterPanelProps> = ({ onCharacter, onSkills }) => {
    const { state } = useGameState();

    if (!state || !state.character) {
        return <div className={styles.loading}>No character active</div>;
    }

    const char = state.character;

    // Helper to format initiative
    const dex = char.stats.DEX ?? 10;
    const initiative = Math.floor((dex - 10) / 2);
    const initiativeStr = (initiative >= 0 ? '+' : '') + initiative;

    // Status effect bonuses — during combat, read from combatant (live); outside, from character (persisted)
    const playerCombatant = state.combat?.combatants?.find((c: any) => c.isPlayer);
    const effects = (playerCombatant?.statusEffects || (char as any).statusEffects || []);
    const acBonus = getACBonus(effects);

    return (
        <div className={styles.panel}>
            <GameTooltip text="Open Character Sheet">
            <div className={styles.header} onClick={onCharacter} style={{ cursor: 'pointer' }}>
                <h2 className={styles.name}>{char.name}</h2>
                <GameTooltip text={(char as any).skillPoints?.available > 0 ? 'Open Skill Mastery' : undefined}>
                <div
                    className={`${styles.level} ${(char as any).skillPoints?.available > 0 ? styles.levelGlow : ''}`}
                    onClick={(e) => { if ((char as any).skillPoints?.available > 0 && onSkills) { e.stopPropagation(); onSkills(); } }}
                    style={(char as any).skillPoints?.available > 0 ? { cursor: 'pointer' } : undefined}
                >
                    Level {char.level} {char.class}{(char as any).subclass ? ` (${(char as any).subclass})` : ''}
                    {(char as any).skillPoints?.available > 0 && <span className={styles.spBadge}>{(char as any).skillPoints.available} SP</span>}
                    {(char as any)._pendingASI > 0 && <span className={styles.asiBadge}>ASI</span>}
                </div>
                </GameTooltip>
            </div>
            </GameTooltip>

            <div className={styles.statsRow}>
                <GameTooltip text={acBonus.value ? acBonus.sources.join(', ') : undefined}>
                <div className={styles.statBox}>
                    <Shield size={16} />
                    <span className={styles.statValue}>
                        {char.ac + acBonus.value}
                        {acBonus.value !== 0 && (
                            <span className={acBonus.value > 0 ? styles.buffIndicator : styles.debuffIndicator}>
                                {acBonus.value > 0 ? `+${acBonus.value}` : acBonus.value}
                            </span>
                        )}
                    </span>
                    <span className={styles.statLabel}>AC</span>
                </div>
                </GameTooltip>
                <div className={styles.statBox}>
                    <Zap size={16} />
                    <span className={styles.statValue}>{initiativeStr}</span>
                    <span className={styles.statLabel}>INIT</span>
                </div>
            </div>

            <HealthBar current={char.hp.current} max={char.hp.max} />
            <XPBar current={char.xp} max={MechanicsEngine.getNextLevelXP(char.level)} />

            <ConditionDisplay conditions={char.conditions} />

            <div className={styles.abilityGrid}>
                {Object.entries(char.stats).map(([stat, val]) => {
                    const bonus = getStatBonus(effects, stat);
                    return (
                        <GameTooltip key={stat} text={bonus.value ? bonus.sources.join(', ') : undefined}>
                        <div className={styles.abilityBox}>
                            <div className={styles.abilityLabel}>{stat}</div>
                            <div className={styles.abilityValue}>
                                {(val as number) + bonus.value}
                                {bonus.value !== 0 && (
                                    <span className={bonus.value > 0 ? styles.buffIndicator : styles.debuffIndicator}>
                                        {bonus.value > 0 ? `+${bonus.value}` : bonus.value}
                                    </span>
                                )}
                            </div>
                        </div>
                        </GameTooltip>
                    );
                })}
            </div>

            {char.spellSlots && Object.keys(char.spellSlots).length > 0 && (
                <SpellSlotTracker slots={char.spellSlots} />
            )}
        </div>
    );
};

export default CharacterPanel;
