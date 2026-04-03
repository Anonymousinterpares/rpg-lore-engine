import React, { useState } from 'react';
import styles from './PartyPanel.module.css';
import { useGameState } from '../../hooks/useGameState';
import { Users, ChevronDown, ChevronRight, MessageCircle, UserMinus, MapPin, Footprints } from 'lucide-react';
import { MAX_PARTY_SIZE } from '../../../ruleset/schemas/CompanionSchema';

const PartyPanel: React.FC = () => {
    const { state, processCommand } = useGameState();
    const [expanded, setExpanded] = useState(true);

    if (!state || !state.companions || state.companions.length === 0) return null;

    const companions = state.companions;

    const getHpPercent = (hp: { current: number; max: number }) =>
        Math.min(Math.round((hp.current / hp.max) * 100), 100);

    const getHpColor = (percent: number) => {
        if (percent > 60) return 'var(--color-hp-healthy, #6aaa64)';
        if (percent > 30) return 'var(--color-hp-wounded, #c9a227)';
        return 'var(--color-hp-critical, #c94040)';
    };

    const getStandingLabel = (state: 'following' | 'waiting') => {
        return state === 'following'
            ? { symbol: '\u2764', label: 'Following', color: 'var(--color-standing-positive, #6aaa64)' }
            : { symbol: '\u23f8', label: 'Waiting', color: 'var(--color-standing-neutral, #b8944f)' };
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header} onClick={() => setExpanded(!expanded)}>
                <Users size={14} />
                <span className={styles.headerTitle}>
                    Party ({companions.length}/{MAX_PARTY_SIZE})
                </span>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>

            {expanded && (
                <div className={styles.companionList}>
                    {companions.map((companion: any, index: number) => {
                        const char = companion.character;
                        const meta = companion.meta;
                        const hpPercent = getHpPercent(char.hp);
                        const statusInfo = getStandingLabel(meta.followState);

                        return (
                            <div key={meta.sourceNpcId || index} className={styles.companionCard}>
                                <div className={styles.companionHeader}>
                                    <span className={styles.companionName}>{char.name}</span>
                                </div>

                                <div className={styles.companionMeta}>
                                    <span className={styles.companionRole}>
                                        {meta.originalRole || 'Adventurer'}
                                    </span>
                                    <span className={styles.companionStatus} style={{ color: statusInfo.color }}>
                                        {statusInfo.symbol} {statusInfo.label}
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
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => processCommand(`/talk ${meta.sourceNpcId}`)}
                                        title="Talk to companion"
                                    >
                                        <MessageCircle size={12} /> Talk
                                    </button>

                                    {meta.followState === 'following' ? (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => processCommand(`/companion_wait ${char.name}`)}
                                            title="Ask companion to wait here"
                                        >
                                            <MapPin size={12} /> Wait
                                        </button>
                                    ) : (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => processCommand(`/companion_follow ${char.name}`)}
                                            title="Ask companion to follow"
                                        >
                                            <Footprints size={12} /> Follow
                                        </button>
                                    )}

                                    <button
                                        className={`${styles.actionBtn} ${styles.dismissBtn}`}
                                        onClick={() => processCommand(`/dismiss_companion ${char.name}`)}
                                        title="Dismiss from party"
                                    >
                                        <UserMinus size={12} /> Dismiss
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
