import React, { useState, useEffect } from 'react';
import styles from './PartyPanel.module.css';
import { useGameState } from '../../hooks/useGameState';
import { Users, ChevronDown, ChevronRight, MessageCircle, UserMinus, MapPin, Footprints, UserPlus, Lock, Unlock, MessagesSquare } from 'lucide-react';
import { MAX_PARTY_SIZE } from '../../../ruleset/schemas/CompanionSchema';

const PartyPanel: React.FC = () => {
    const { state, processCommand } = useGameState();
    const [expanded, setExpanded] = useState(true);
    const [talkDropdownOpen, setTalkDropdownOpen] = useState<string | null>(null);

    // Auto-close dropdown on outside click
    useEffect(() => {
        if (!talkDropdownOpen) return;
        const handler = () => setTalkDropdownOpen(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [talkDropdownOpen]);

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

    const isInActiveConversation = (npcId: string) =>
        activeConv?.participants?.includes(npcId) || false;

    const isPrimaryTalkTarget = (npcId: string) =>
        activeConv?.primaryNpcId === npcId;

    const handleTalkClick = (e: React.MouseEvent, npcId: string) => {
        e.stopPropagation();

        // If already talking to this NPC, end conversation
        if (isPrimaryTalkTarget(npcId)) {
            processCommand('/endtalk');
            setTalkDropdownOpen(null);
            return;
        }

        // If already in a conversation with someone else, end it first then start new
        if (activeConv) {
            processCommand('/endtalk');
        }

        // Show dropdown for private/normal choice
        setTalkDropdownOpen(talkDropdownOpen === npcId ? null : npcId);
    };

    const startTalk = (npcId: string, mode: 'NORMAL' | 'PRIVATE') => {
        setTalkDropdownOpen(null);
        processCommand(mode === 'PRIVATE' ? `/talk_private ${npcId}` : `/talk ${npcId}`);
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header} onClick={() => setExpanded(!expanded)}>
                <Users size={14} />
                <span className={styles.headerTitle}>
                    Party ({companions.length}/{MAX_PARTY_SIZE})
                </span>
                {companions.length > 1 && !activeConv && (
                    <button
                        className={styles.groupTalkBtn}
                        onClick={(e) => { e.stopPropagation(); processCommand('/group_talk'); }}
                        title="Start party discussion"
                    >
                        <MessagesSquare size={12} />
                    </button>
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

                        // Speech bubble for this companion
                        const bubble = speechBubbles.find(
                            (b: any) => b.npcId === npcId && b.expiresAt > now
                        );

                        return (
                            <div key={npcId || index} className={`${styles.companionCard} ${isTalking ? styles.activeTalkCard : ''}`}>
                                {/* Speech bubble */}
                                {bubble && (
                                    <div className={styles.speechBubble}>
                                        {bubble.text}
                                    </div>
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
                                        color: isFollowing
                                            ? 'var(--color-standing-positive, #6aaa64)'
                                            : 'var(--color-standing-neutral, #b8944f)'
                                    }}>
                                        {isFollowing ? '\u2764 Following' : '\u23f8 Waiting'}
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
                                        <button
                                            className={`${styles.actionBtn} ${isTalking ? styles.talkBtnActive : ''}`}
                                            onClick={(e) => handleTalkClick(e, npcId)}
                                            title={isTalking ? 'End conversation' : 'Talk to companion'}
                                        >
                                            <MessageCircle size={12} />
                                            {isTalking ? 'End Talk' : 'Talk'}
                                        </button>

                                        {talkDropdownOpen === npcId && (
                                            <div className={styles.talkDropdown} onClick={e => e.stopPropagation()}>
                                                <button
                                                    className={styles.dropdownItem}
                                                    onClick={() => startTalk(npcId, 'NORMAL')}
                                                >
                                                    <Unlock size={11} /> Talk Normally
                                                </button>
                                                <button
                                                    className={styles.dropdownItem}
                                                    onClick={() => startTalk(npcId, 'PRIVATE')}
                                                >
                                                    <Lock size={11} /> Talk Privately
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Add to conversation button */}
                                    {activeConv && !isParticipant && companions.length > 1 && (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => processCommand(`/add_to_conversation ${npcId}`)}
                                            title="Add to conversation"
                                        >
                                            <UserPlus size={12} />
                                        </button>
                                    )}

                                    {/* Follow/Wait toggle */}
                                    {isFollowing ? (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => processCommand(`/companion_wait ${char.name}`)}
                                            title="Ask to wait here"
                                        >
                                            <MapPin size={12} />
                                        </button>
                                    ) : (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => processCommand(`/companion_follow ${char.name}`)}
                                            title="Ask to follow"
                                        >
                                            <Footprints size={12} />
                                        </button>
                                    )}

                                    {/* Dismiss */}
                                    <button
                                        className={`${styles.actionBtn} ${styles.dismissBtn}`}
                                        onClick={() => processCommand(`/dismiss_companion ${char.name}`)}
                                        title="Dismiss from party"
                                    >
                                        <UserMinus size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PartyPanel;
