import React from 'react';
import styles from './QuestList.module.css';
import { CheckCircle, Circle, Target } from 'lucide-react';
import { Quest } from '../../../ruleset/schemas/QuestSchema';

interface QuestListProps {
    quests: Quest[];
}

const QuestList: React.FC<QuestListProps> = ({ quests }) => {
    if (!quests || quests.length === 0) {
        return (
            <div className={styles.empty}>
                <Target size={32} opacity={0.2} />
                <p>No active chronicles</p>
            </div>
        );
    }

    return (
        <div className={styles.questList}>
            {quests.map(quest => (
                <div key={quest.id} className={styles.questCard}>
                    <h4 className={styles.questTitle}>{quest.title}</h4>
                    <p className={styles.questDesc}>{quest.description}</p>
                    <div className={styles.objectives}>
                        {quest.objectives.map(obj => (
                            <div key={obj.id} className={`${styles.objective} ${obj.isCompleted ? styles.completed : ''}`}>
                                {obj.isCompleted ? (
                                    <CheckCircle size={14} className={styles.icon} />
                                ) : (
                                    <Circle size={14} className={styles.icon} />
                                )}
                                <span className={styles.objText}>
                                    {obj.description}
                                    {obj.maxProgress > 1 && (
                                        <span className={styles.progress}>
                                            [{obj.currentProgress}/{obj.maxProgress}]
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default QuestList;
