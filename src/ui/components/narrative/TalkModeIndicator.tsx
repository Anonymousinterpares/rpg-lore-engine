import React from 'react';
import styles from './TalkModeIndicator.module.css';
import { useGameState } from '../../hooks/useGameState';
import { MessageCircle, Lock, Unlock, Users, X } from 'lucide-react';

const TalkModeIndicator: React.FC = () => {
    const { state, processCommand } = useGameState();

    const conv = state?.conversationState?.activeConversation;
    if (!conv) return null;

    // Find primary NPC name
    const primaryCompanion = state?.companions?.find(
        (c: any) => c.meta?.sourceNpcId === conv.primaryNpcId
    );
    const primaryNpc = state?.worldNpcs?.find(n => n.id === conv.primaryNpcId);
    const npcName = primaryCompanion?.character?.name || primaryNpc?.name || 'Unknown';

    const isPrivate = conv.mode === 'PRIVATE';
    const isGroup = conv.mode === 'GROUP';
    const participantCount = conv.participants?.length || 1;

    return (
        <div className={`${styles.indicator} ${isPrivate ? styles.private : ''}`}>
            <div className={styles.left}>
                {isPrivate ? <Lock size={14} /> : <Unlock size={14} />}
                <MessageCircle size={14} />
                <span className={styles.npcName}>{npcName}</span>
                <span className={styles.modeBadge}>
                    {isPrivate ? 'Private' : isGroup ? 'Party Discussion' : 'Open'}
                </span>
                {participantCount > 1 && (
                    <span className={styles.participantCount}>
                        <Users size={12} /> {participantCount}
                    </span>
                )}
            </div>
            <button
                className={styles.endBtn}
                onClick={() => processCommand('/endtalk')}
                title="End conversation"
            >
                <X size={14} /> End
            </button>
        </div>
    );
};

export default TalkModeIndicator;
