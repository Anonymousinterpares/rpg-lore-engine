import React, { useState } from 'react';
import styles from './QuestsPage.module.css';
import { useGameState } from '../../hooks/useGameState';
import { Target, CheckCircle, XCircle, Scroll, ShieldQuestion } from 'lucide-react';

const QuestsPage: React.FC = () => {
    const { state, engine, updateState } = useGameState();
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED' | 'FAILED'>('ACTIVE');

    if (!state) return null;

    const quests = state.activeQuests || [];
    const filteredQuests = quests.filter(q => q.status === activeTab);

    const markAsRead = (questId: string) => {
        if (engine) {
            engine.markQuestAsRead(questId);
            updateState();
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.sidebar}>
                <h2 className={styles.title}>Chronicles</h2>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'ACTIVE' ? styles.active : ''}`}
                        onClick={() => setActiveTab('ACTIVE')}
                    >
                        <Target size={18} />
                        Active
                        {quests.some(q => q.status === 'ACTIVE' && q.isNew) && <div className={styles.redDot} />}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'COMPLETED' ? styles.active : ''}`}
                        onClick={() => setActiveTab('COMPLETED')}
                    >
                        <CheckCircle size={18} />
                        Completed
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'FAILED' ? styles.active : ''}`}
                        onClick={() => setActiveTab('FAILED')}
                    >
                        <XCircle size={18} />
                        Failed
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {filteredQuests.length > 0 ? (
                    <div className={styles.questList}>
                        {filteredQuests.map(quest => (
                            <div
                                key={quest.id}
                                className={`${styles.questCard} ${quest.isNew ? styles.isNew : ''}`}
                                onClick={() => markAsRead(quest.id)}
                            >
                                <div className={styles.questHeader}>
                                    <h3>{quest.title}</h3>
                                    {quest.isNew && <span className={styles.newBadge}>NEW</span>}
                                </div>
                                <p className={styles.description}>{quest.description}</p>

                                <div className={styles.objectives}>
                                    <h4>Objectives</h4>
                                    {quest.objectives.map(obj => (
                                        <div key={obj.id} className={`${styles.objective} ${obj.isCompleted ? styles.completed : ''}`}>
                                            <div className={styles.objCheck}>
                                                {obj.isCompleted ? <CheckCircle size={14} /> : <div className={styles.circle} />}
                                            </div>
                                            <span className={styles.objText}>{obj.description}</span>
                                            {obj.maxProgress > 1 && (
                                                <span className={styles.progress}>
                                                    [{obj.currentProgress}/{obj.maxProgress}]
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {quest.rewards && (
                                    <div className={styles.rewards}>
                                        <h4>Rewards</h4>
                                        <div className={styles.rewardTags}>
                                            {quest.rewards.xp > 0 && <span className={styles.rewardTag}>{quest.rewards.xp} XP</span>}
                                            {quest.rewards.gold && <span className={styles.rewardTag}>{quest.rewards.gold.gp} GP</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <Scroll size={60} />
                        <p>No chronicles found in this section.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestsPage;
