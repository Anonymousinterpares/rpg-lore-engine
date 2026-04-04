import React, { useState, useEffect, useCallback } from 'react';
import styles from './PartyPanel.module.css';
import { useGameState } from '../../hooks/useGameState';
import GameTooltip from '../common/GameTooltip';
import { Users, ChevronDown, ChevronRight, MessageCircle, UserMinus, MapPin, Footprints, UserPlus, Lock, Unlock, MessagesSquare, X, Eye, BarChart2, Heart, ArrowLeftRight, ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { MAX_PARTY_SIZE } from '../../../ruleset/schemas/CompanionSchema';

const FACTION_DISPLAY_NAMES: Record<string, string> = {
    'harpers': 'The Harpers',
    'zhentarim': 'Zhentarim',
    'emerald_enclave': 'Emerald Enclave',
    'order_gauntlet': 'Order of the Gauntlet',
    'lords_alliance': "Lords' Alliance",
};

function formatFactionName(factionId: string | undefined): string {
    if (!factionId) return 'Independent';
    return FACTION_DISPLAY_NAMES[factionId] || factionId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatGameTimeSince(recruitedAt: number, currentTotalTurns: number): string {
    // totalTurns is internal precision (minutes * 10). Compute relative difference.
    const diff = currentTotalTurns - recruitedAt;
    const diffMinutes = Math.floor(diff / 10);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 5) return `${diffMinutes}m ago`;
    return 'Just now';
}

interface ContextMenuState {
    x: number; y: number;
    companionIndex: number;
}

interface DetailPanelState {
    x: number; y: number;
    companionIndex: number;
    view: 'details' | 'stats' | 'relationship';
}

interface BarterPanelState {
    companionIndex: number;
}

interface LevelUpPopoverState {
    x: number; y: number;
    companionIndex: number;
}

const PartyPanel: React.FC = () => {
    const { state, processCommand } = useGameState();
    const [expanded, setExpanded] = useState(true);
    const [talkDropdownOpen, setTalkDropdownOpen] = useState<string | null>(null);
    const [dismissedBubbles, setDismissedBubbles] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [detailPanel, setDetailPanel] = useState<DetailPanelState | null>(null);
    const [barterPanel, setBarterPanel] = useState<BarterPanelState | null>(null);
    const [levelUpPopover, setLevelUpPopover] = useState<LevelUpPopoverState | null>(null);
    const [selectedPlayerItem, setSelectedPlayerItem] = useState<string | null>(null);
    const [selectedCompItem, setSelectedCompItem] = useState<string | null>(null);

    // Close dropdown/context menu on outside click
    useEffect(() => {
        if (!talkDropdownOpen && !contextMenu && !detailPanel && !levelUpPopover) return;
        const handler = () => { setTalkDropdownOpen(null); setContextMenu(null); setDetailPanel(null); setLevelUpPopover(null); };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [talkDropdownOpen, contextMenu, detailPanel, levelUpPopover]);

    const dismissBubble = useCallback((npcId: string) => {
        setDismissedBubbles(prev => new Set(prev).add(npcId));
        // Auto-clear dismissal after bubble expires
        setTimeout(() => setDismissedBubbles(prev => {
            const next = new Set(prev);
            next.delete(npcId);
            return next;
        }), 10000);
    }, []);

    if (!state || !state.companions || state.companions.length === 0) return null;

    const companions = state.companions;
    const activeConv = state.conversationState?.activeConversation;
    const speechBubbles = state.conversationState?.speechBubbles || [];
    const now = Date.now();

    const getHpPercent = (hp: { current: number; max: number }) =>
        Math.min(Math.round((hp.current / hp.max) * 100), 100);

    const getHpColor = (percent: number) => {
        if (percent > 60) return 'var(--color-hp-healthy, #6aaa64)';
        if (percent > 30) return 'var(--color-hp-wounded, #c9a227)';
        return 'var(--color-hp-critical, #c94040)';
    };

    const getStandingLabel = (standing: number) => {
        if (standing >= 50) return { label: 'Allied', color: '#6aaa64' };
        if (standing >= 20) return { label: 'Friendly', color: '#6aaa64' };
        if (standing >= -20) return { label: 'Neutral', color: '#b8944f' };
        if (standing >= -50) return { label: 'Wary', color: '#c94040' };
        return { label: 'Hostile', color: '#c94040' };
    };

    const isInActiveConversation = (npcId: string) =>
        activeConv?.participants?.includes(npcId) || false;

    const isPrimaryTalkTarget = (npcId: string) =>
        activeConv?.primaryNpcId === npcId;

    const handleTalkClick = (e: React.MouseEvent, npcId: string) => {
        e.stopPropagation();
        if (isPrimaryTalkTarget(npcId)) {
            processCommand('/endtalk');
            setTalkDropdownOpen(null);
            return;
        }
        if (activeConv) processCommand('/endtalk');
        setTalkDropdownOpen(talkDropdownOpen === npcId ? null : npcId);
    };

    const startTalk = (npcId: string, mode: 'NORMAL' | 'PRIVATE') => {
        setTalkDropdownOpen(null);
        processCommand(mode === 'PRIVATE' ? `/talk_private ${npcId}` : `/talk ${npcId}`);
    };

    const handleContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, companionIndex: index });
    };

    const openDetail = (view: 'details' | 'stats' | 'relationship') => {
        if (!contextMenu) return;
        setDetailPanel({ x: contextMenu.x, y: contextMenu.y, companionIndex: contextMenu.companionIndex, view });
        setContextMenu(null);
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header} onClick={() => setExpanded(!expanded)}>
                <Users size={14} />
                <span className={styles.headerTitle}>
                    Party ({companions.length}/{MAX_PARTY_SIZE})
                </span>
                {companions.length > 1 && !activeConv && (
                    <GameTooltip text="Start party discussion">
                        <button
                            className={styles.groupTalkBtn}
                            onClick={(e) => { e.stopPropagation(); processCommand('/group_talk'); }}
                        >
                            <MessagesSquare size={12} />
                        </button>
                    </GameTooltip>
                )}
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>

            {expanded && (
                <div className={styles.companionList}>
                    {companions.map((companion: any, index: number) => {
                        const char = companion.character;
                        const meta = companion.meta;
                        const npcId = meta.sourceNpcId;
                        const hpPercent = getHpPercent(char.hp);
                        const isFollowing = meta.followState === 'following';
                        const isTalking = isPrimaryTalkTarget(npcId);
                        const isParticipant = isInActiveConversation(npcId);

                        const bubble = speechBubbles.find(
                            (b: any) => b.npcId === npcId && b.expiresAt > now
                        );
                        const bubbleVisible = bubble && !dismissedBubbles.has(npcId);

                        return (
                            <div
                                key={npcId || index}
                                className={`${styles.companionCard} ${isTalking ? styles.activeTalkCard : ''}`}
                                onContextMenu={(e) => handleContextMenu(e, index)}
                            >
                                {/* Speech bubble with close button */}
                                {bubbleVisible && (
                                    <div className={styles.speechBubble}>
                                        {bubble.text}
                                        <button
                                            className={styles.speechBubbleClose}
                                            onClick={(e) => { e.stopPropagation(); dismissBubble(npcId); }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}

                                {/* Level-up notification badge */}
                                {meta.pendingLevelUp && (
                                    <button
                                        className={styles.levelUpBadge}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                                            setLevelUpPopover({ x: rect.right + 8, y: rect.top, companionIndex: index });
                                        }}
                                    >
                                        LvlUP
                                    </button>
                                )}

                                <div className={styles.companionHeader}>
                                    <span className={styles.companionName}>{char.name}</span>
                                    {isParticipant && !isTalking && (
                                        <span className={styles.participantBadge}>in convo</span>
                                    )}
                                </div>

                                <div className={styles.companionMeta}>
                                    <span className={styles.companionRole}>
                                        {meta.originalRole || 'Adventurer'}
                                    </span>
                                    <span className={styles.companionStatus} style={{
                                        color: char.hp.current <= 0
                                            ? '#c94040'
                                            : isFollowing
                                                ? 'var(--color-standing-positive, #6aaa64)'
                                                : 'var(--color-standing-neutral, #b8944f)'
                                    }}>
                                        {char.hp.current <= 0 ? '\u2620 Unconscious' : isFollowing ? '\u2764 Following' : '\u23f8 Waiting'}
                                    </span>
                                </div>

                                <div className={styles.hpBarContainer}>
                                    <div className={styles.hpBarBg}>
                                        <div
                                            className={styles.hpBarFill}
                                            style={{
                                                width: `${hpPercent}%`,
                                                backgroundColor: getHpColor(hpPercent)
                                            }}
                                        />
                                    </div>
                                    <span className={styles.hpText}>
                                        {char.hp.current}/{char.hp.max} HP
                                    </span>
                                </div>

                                <div className={styles.companionActions}>
                                    {/* Talk button with dropdown */}
                                    <div className={styles.talkBtnWrapper}>
                                        <GameTooltip text={char.hp.current <= 0 ? 'Unconscious — cannot talk' : isTalking ? 'End conversation' : 'Talk to companion'}>
                                            <button
                                                className={`${styles.actionBtn} ${isTalking ? styles.talkBtnActive : ''}`}
                                                onClick={(e) => handleTalkClick(e, npcId)}
                                                disabled={char.hp.current <= 0 && !isTalking}
                                            >
                                                <MessageCircle size={12} />
                                                {isTalking ? 'End Talk' : 'Talk'}
                                            </button>
                                        </GameTooltip>

                                        {talkDropdownOpen === npcId && (
                                            <div className={styles.talkDropdown} onClick={e => e.stopPropagation()}>
                                                <button className={styles.dropdownItem} onClick={() => startTalk(npcId, 'NORMAL')}>
                                                    <Unlock size={11} /> Talk Normally
                                                </button>
                                                <button className={styles.dropdownItem} onClick={() => startTalk(npcId, 'PRIVATE')}>
                                                    <Lock size={11} /> Talk Privately
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Add to conversation */}
                                    {activeConv && !isParticipant && companions.length > 1 && (
                                        <GameTooltip text="Add to conversation">
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => processCommand(`/add_to_conversation ${npcId}`)}
                                            >
                                                <UserPlus size={12} />
                                            </button>
                                        </GameTooltip>
                                    )}

                                    {/* Follow/Wait */}
                                    {isFollowing ? (
                                        <GameTooltip text="Ask to wait here">
                                            <button className={styles.actionBtn} onClick={() => processCommand(`/companion_wait ${char.name}`)}>
                                                <MapPin size={12} />
                                            </button>
                                        </GameTooltip>
                                    ) : (
                                        <GameTooltip text="Ask to follow">
                                            <button className={styles.actionBtn} onClick={() => processCommand(`/companion_follow ${char.name}`)}>
                                                <Footprints size={12} />
                                            </button>
                                        </GameTooltip>
                                    )}

                                    {/* Dismiss */}
                                    <GameTooltip text="Dismiss from party">
                                        <button
                                            className={`${styles.actionBtn} ${styles.dismissBtn}`}
                                            onClick={() => processCommand(`/dismiss_companion ${char.name}`)}
                                        >
                                            <UserMinus size={12} />
                                        </button>
                                    </GameTooltip>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Right-click context menu */}
            {contextMenu && (
                <div
                    className={styles.contextMenu}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className={styles.contextMenuItem} onClick={() => openDetail('details')}>
                        <Eye size={13} /> View Details
                    </button>
                    <button className={styles.contextMenuItem} onClick={() => openDetail('stats')}>
                        <BarChart2 size={13} /> View Stats
                    </button>
                    <button className={styles.contextMenuItem} onClick={() => openDetail('relationship')}>
                        <Heart size={13} /> Relationship
                    </button>
                    <div className={styles.contextMenuDivider} />
                    <button className={styles.contextMenuItem} onClick={() => {
                        if (contextMenu) {
                            setBarterPanel({ companionIndex: contextMenu.companionIndex });
                            setContextMenu(null);
                        }
                    }}>
                        <Package size={13} /> Inventory / Trade
                    </button>
                </div>
            )}

            {/* Detail panel */}
            {detailPanel && (() => {
                const comp = companions[detailPanel.companionIndex] as any;
                if (!comp) return null;
                const char = comp.character;
                const meta = comp.meta;
                const standing = getStandingLabel(30); // Companions have implicit friendly standing

                return (
                    <div
                        className={styles.detailOverlay}
                        style={{ left: Math.min(detailPanel.x, window.innerWidth - 300), top: Math.min(detailPanel.y, window.innerHeight - 300) }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h4>{char.name}</h4>

                        {detailPanel.view === 'details' && (
                            <>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Role</span><span className={styles.detailValue}>{meta.originalRole || '—'}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Class</span><span className={styles.detailValue}>{char.class}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Level</span><span className={styles.detailValue}>{char.level}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>HP</span><span className={styles.detailValue}>{char.hp.current}/{char.hp.max}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>AC</span><span className={styles.detailValue}>{char.ac}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Faction</span><span className={styles.detailValue}>{formatFactionName(meta.originalFactionId)}</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Recruited</span><span className={styles.detailValue}>{formatGameTimeSince(meta.recruitedAtTurn, state?.worldTime?.totalTurns || 0)}</span></div>
                                {meta.recruitmentCost > 0 && (
                                    <div className={styles.detailRow}><span className={styles.detailLabel}>Cost</span><span className={styles.detailValue}>{meta.recruitmentCost} gp</span></div>
                                )}
                            </>
                        )}

                        {detailPanel.view === 'stats' && (
                            <>
                                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
                                    <div key={stat} className={styles.detailRow}>
                                        <span className={styles.detailLabel}>{stat}</span>
                                        <span className={styles.detailValue}>
                                            {char.stats[stat]} ({Math.floor((char.stats[stat] - 10) / 2) >= 0 ? '+' : ''}{Math.floor((char.stats[stat] - 10) / 2)})
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}

                        {detailPanel.view === 'relationship' && (
                            <>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Standing</span>
                                    <span className={styles.detailValue} style={{ color: standing.color }}>{standing.label}</span>
                                </div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>Conversations</span><span className={styles.detailValue}>{meta.conversationHistory?.length || 0} exchanges</span></div>
                                <div className={styles.detailRow}><span className={styles.detailLabel}>State</span><span className={styles.detailValue}>{meta.followState}</span></div>
                                <div style={{ marginTop: 6, fontSize: 10, color: '#8b7355', fontStyle: 'italic' }}>
                                    Traits: {(meta.originalTraits || []).join(', ') || 'Unknown'}
                                </div>
                            </>
                        )}

                        <button
                            style={{ marginTop: 8, padding: '3px 8px', fontSize: 10, cursor: 'pointer', background: 'rgba(139,119,75,0.1)', border: '1px solid rgba(139,119,75,0.3)', borderRadius: 4 }}
                            onClick={() => setDetailPanel(null)}
                        >
                            Close
                        </button>
                    </div>
                );
            })()}

            {/* Level-up popover */}
            {levelUpPopover && (() => {
                const comp = companions[levelUpPopover.companionIndex] as any;
                if (!comp?.meta?.pendingLevelUp) return null;
                const lu = comp.meta.pendingLevelUp;

                const StatChange = ({ label, old: o, new: n }: { label: string; old: number; new: number }) => (
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{label}</span>
                        <span className={styles.detailValue}>
                            {o} <span style={{ color: n > o ? '#4a8a4a' : '#8b7355' }}>→ {n}</span>
                            {n > o && <span style={{ color: '#4a8a4a', fontSize: 10 }}> (+{n - o})</span>}
                        </span>
                    </div>
                );

                return (
                    <div
                        className={styles.detailOverlay}
                        style={{ left: Math.min(levelUpPopover.x, window.innerWidth - 280), top: Math.min(levelUpPopover.y, window.innerHeight - 250) }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h4 onContextMenu={e => e.preventDefault()}>{comp.character.name} — Level Up!</h4>
                        <StatChange label="Level" old={lu.oldLevel} new={lu.newLevel} />
                        <StatChange label="Max HP" old={lu.oldMaxHp} new={lu.newMaxHp} />
                        <StatChange label="AC" old={lu.oldAc} new={lu.newAc} />
                        {Object.keys(lu.newSpellSlots || {}).map((lv: string) => {
                            const oldCount = lu.oldSpellSlots?.[lv] || 0;
                            const newCount = lu.newSpellSlots?.[lv] || 0;
                            if (newCount === 0 && oldCount === 0) return null;
                            return <StatChange key={lv} label={`Spell Lv${lv}`} old={oldCount} new={newCount} />;
                        })}
                        <button
                            style={{ marginTop: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', background: 'rgba(74,138,74,0.15)', border: '1px solid rgba(74,138,74,0.4)', borderRadius: 4, color: '#2a6a2a' }}
                            onClick={() => {
                                processCommand(`/dismiss_levelup ${comp.character.name}`);
                                setLevelUpPopover(null);
                            }}
                        >
                            Acknowledge
                        </button>
                    </div>
                );
            })()}

            {/* Barter / Inventory overlay */}
            {barterPanel && (() => {
                const compIdx = barterPanel.companionIndex;
                const comp = companions[compIdx] as any;
                if (!comp) return null;
                const compItems = comp.character.inventory?.items || [];
                const playerItems = state?.character?.inventory?.items || [];
                const compEquipped = new Set(Object.values(comp.character.equipmentSlots || {}).filter(Boolean) as string[]);
                const playerEquipped = new Set(Object.values(state?.character?.equipmentSlots || {}).filter(Boolean) as string[]);

                const ItemRow = ({ item, isEquipped, isSelected, onSelect }: { item: any; isEquipped: boolean; isSelected: boolean; onSelect: () => void }) => (
                    <GameTooltip text={`${item.name} (${item.type})${item.weight ? ` · ${item.weight} lb` : ''}${isEquipped ? ' · Equipped' : ''}`}>
                        <div
                            className={`${styles.barterItem} ${isSelected ? styles.barterItemSelected : ''}`}
                            onClick={onSelect}
                        >
                            <span className={styles.barterItemName}>{item.name}{isEquipped ? ' (E)' : ''}</span>
                            <span className={styles.barterItemType}>{item.type}</span>
                        </div>
                    </GameTooltip>
                );

                return (
                    <div className={styles.barterOverlay} onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
                        <div className={styles.barterHeader}>
                            <h4>Trade with {comp.character.name}</h4>
                            <button className={styles.barterClose} onClick={() => { setBarterPanel(null); setSelectedPlayerItem(null); setSelectedCompItem(null); }}>
                                <X size={14} />
                            </button>
                        </div>

                        <div className={styles.barterColumns}>
                            {/* Player inventory */}
                            <div className={styles.barterColumn}>
                                <div className={styles.barterColumnTitle}>Your Items</div>
                                <div className={styles.barterItemList}>
                                    {playerItems.map((item: any) => (
                                        <ItemRow
                                            key={item.instanceId}
                                            item={item}
                                            isEquipped={playerEquipped.has(item.instanceId)}
                                            isSelected={selectedPlayerItem === item.instanceId}
                                            onSelect={() => setSelectedPlayerItem(selectedPlayerItem === item.instanceId ? null : item.instanceId)}
                                        />
                                    ))}
                                    {playerItems.length === 0 && <div className={styles.barterEmpty}>No items</div>}
                                </div>
                                {selectedPlayerItem && (
                                    <button className={styles.barterAction} onClick={async () => {
                                        await processCommand(`/give ${compIdx} ${selectedPlayerItem}`);
                                        setSelectedPlayerItem(null);
                                    }}>
                                        <ArrowRight size={12} /> Give to {comp.character.name.split(' ')[0]}
                                    </button>
                                )}
                            </div>

                            {/* Barter action (if both selected) */}
                            <div className={styles.barterMiddle}>
                                {selectedPlayerItem && selectedCompItem && (
                                    <button className={styles.barterSwapBtn} onClick={async () => {
                                        await processCommand(`/barter ${compIdx} ${selectedPlayerItem} ${selectedCompItem}`);
                                        setSelectedPlayerItem(null);
                                        setSelectedCompItem(null);
                                    }}>
                                        <ArrowLeftRight size={14} />
                                        <span>Trade</span>
                                    </button>
                                )}
                            </div>

                            {/* Companion inventory */}
                            <div className={styles.barterColumn}>
                                <div className={styles.barterColumnTitle}>{comp.character.name.split(' ')[0]}'s Items</div>
                                <div className={styles.barterItemList}>
                                    {compItems.map((item: any) => (
                                        <ItemRow
                                            key={item.instanceId}
                                            item={item}
                                            isEquipped={compEquipped.has(item.instanceId)}
                                            isSelected={selectedCompItem === item.instanceId}
                                            onSelect={() => setSelectedCompItem(selectedCompItem === item.instanceId ? null : item.instanceId)}
                                        />
                                    ))}
                                    {compItems.length === 0 && <div className={styles.barterEmpty}>No items</div>}
                                </div>
                                {selectedCompItem && (
                                    <button className={styles.barterAction} onClick={async () => {
                                        await processCommand(`/take ${compIdx} ${selectedCompItem}`);
                                        setSelectedCompItem(null);
                                    }}>
                                        <ArrowLeft size={12} /> Take from {comp.character.name.split(' ')[0]}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default PartyPanel;
