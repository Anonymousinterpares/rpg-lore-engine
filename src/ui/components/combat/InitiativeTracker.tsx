import React, { useState, useEffect } from 'react';
import styles from './InitiativeTracker.module.css';
import { ChevronRight, Swords, ShieldCheck, Heart, Shield, Flame } from 'lucide-react';
import GameTooltip from '../common/GameTooltip';

interface Combatant {
    id: string;
    name: string;
    initiative: number;
    hp: { current: number, max: number };
    isPlayer: boolean;
    type?: 'player' | 'companion' | 'enemy' | 'summon';
}

type DirectiveBehavior = 'AGGRESSIVE' | 'DEFENSIVE' | 'SUPPORT' | 'FOCUS' | 'PROTECT';

interface InitiativeTrackerProps {
    combatants: Combatant[];
    currentTurnId: string;
    selectedTargetId?: string;
    companionDirectives?: Record<string, { behavior: DirectiveBehavior; targetName?: string }>;
    onSelectTarget?: (id: string) => void;
    onInspect?: (id: string) => void;
    onSetDirective?: (companionId: string, behavior: DirectiveBehavior, targetName?: string) => void;
    className?: string;
}

const DIRECTIVE_ICONS: Record<DirectiveBehavior, { icon: React.ReactNode; color: string; label: string }> = {
    AGGRESSIVE: { icon: <Flame size={9} />, color: '#c94040', label: 'AGG' },
    DEFENSIVE:  { icon: <Shield size={9} />, color: '#3a6b8b', label: 'DEF' },
    SUPPORT:    { icon: <Heart size={9} />, color: '#4a8a4a', label: 'SUP' },
    FOCUS:      { icon: <Swords size={9} />, color: '#8b3a3a', label: 'FOC' },
    PROTECT:    { icon: <ShieldCheck size={9} />, color: '#6b5a8b', label: 'PRT' },
};

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    combatants,
    currentTurnId,
    selectedTargetId,
    companionDirectives,
    onSelectTarget,
    onInspect,
    onSetDirective,
    className = ''
}) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; companionId: string } | null>(null);

    // Close context menu on outside click
    useEffect(() => {
        if (!contextMenu) return;
        const handler = () => setContextMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [contextMenu]);

    const handleAllyRightClick = (e: React.MouseEvent, companionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, companionId });
    };

    const issueDirective = (behavior: DirectiveBehavior) => {
        if (!contextMenu) return;
        // For FOCUS, use the currently selected enemy target name
        const selectedEnemy = selectedTargetId
            ? combatants.find(c => c.id === selectedTargetId)
            : undefined;
        const targetName = behavior === 'FOCUS' && selectedEnemy ? selectedEnemy.name : undefined;
        onSetDirective?.(contextMenu.companionId, behavior, targetName);
        setContextMenu(null);
    };

    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.list}>
                {combatants.map((c) => {
                    const hpPercent = Math.max(0, Math.min(100, (c.hp.current / c.hp.max) * 100));
                    const isActive = c.id === currentTurnId;
                    const isSelected = c.id === selectedTargetId;
                    const isAlly = c.type === 'companion' || c.type === 'summon';
                    const isEnemy = c.type === 'enemy';
                    const directive = isAlly ? companionDirectives?.[c.id] : undefined;

                    const tooltipText = isEnemy
                        ? 'Left-click to target enemy'
                        : isAlly
                            ? 'Right-click to issue orders'
                            : undefined;

                    const card = (
                        <div
                            key={c.id}
                            className={`${styles.combatant} ${isActive ? styles.active : ''} ${isAlly ? styles.ally : c.isPlayer ? styles.player : styles.enemy} ${isSelected ? styles.selected : ''}`}
                            onClick={() => isEnemy && onSelectTarget?.(c.id)}
                            onContextMenu={isAlly ? (e) => handleAllyRightClick(e, c.id) : (e) => e.preventDefault()}
                        >
                            {isActive && <ChevronRight className={styles.indicator} size={14} />}
                            <div className={styles.info}>
                                <span className={styles.name}>{c.name}</span>
                                <span className={styles.init}>({c.initiative})</span>
                                {isEnemy && (
                                    <GameTooltip text="View Details">
                                        <button
                                            className={styles.inspectBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onInspect?.(c.id);
                                            }}
                                        >
                                            i
                                        </button>
                                    </GameTooltip>
                                )}
                            </div>
                            <div className={styles.hpContainer}>
                                <div className={styles.hpBar} style={{ width: `${hpPercent}%` }} />
                                <span className={styles.hpText}>{Math.floor(c.hp.current)}/{c.hp.max}</span>
                            </div>
                            {isSelected && <div className={styles.targetLabel}>TARGET</div>}
                            {/* Directive badge for companions */}
                            {directive && (
                                <div
                                    className={styles.directiveBadge}
                                    style={{ backgroundColor: DIRECTIVE_ICONS[directive.behavior].color }}
                                >
                                    {DIRECTIVE_ICONS[directive.behavior].icon}
                                    <span>{DIRECTIVE_ICONS[directive.behavior].label}</span>
                                </div>
                            )}
                        </div>
                    );

                    return tooltipText ? (
                        <GameTooltip key={c.id} text={tooltipText}>{card}</GameTooltip>
                    ) : (
                        <React.Fragment key={c.id}>{card}</React.Fragment>
                    );
                })}
            </div>

            {/* Right-click context menu for ally directives */}
            {contextMenu && (
                <div
                    className={styles.directiveMenu}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={styles.directiveMenuHeader}>Issue Order</div>
                    <button className={styles.directiveMenuItem} onClick={() => issueDirective('FOCUS')}>
                        <Swords size={13} /> Focus Target {selectedTargetId ? `(${combatants.find(c => c.id === selectedTargetId)?.name})` : ''}
                    </button>
                    <button className={styles.directiveMenuItem} onClick={() => issueDirective('PROTECT')}>
                        <ShieldCheck size={13} /> Protect Me
                    </button>
                    <button className={styles.directiveMenuItem} onClick={() => issueDirective('SUPPORT')}>
                        <Heart size={13} /> Heal / Support
                    </button>
                    <button className={styles.directiveMenuItem} onClick={() => issueDirective('DEFENSIVE')}>
                        <Shield size={13} /> Be Defensive
                    </button>
                    <button className={styles.directiveMenuItem} onClick={() => issueDirective('AGGRESSIVE')}>
                        <Flame size={13} /> Go Aggressive
                    </button>
                </div>
            )}
        </div>
    );
};

export default InitiativeTracker;
