import React, { useEffect, useState } from 'react';
import styles from './QuestToast.module.css';
import parchmentStyles from '../../styles/parchment.module.css';

export type QuestToastType = 'NEW' | 'UPDATE' | 'COMPLETE' | 'FAIL';

interface QuestToastProps {
    title: string;
    type: QuestToastType;
    duration?: number;
    onClose?: () => void;
}

const QuestToast: React.FC<QuestToastProps> = ({ title, type, duration = 5000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!isVisible) return null;

    const getTypeLabel = () => {
        switch (type) {
            case 'NEW': return 'NEW QUEST';
            case 'UPDATE': return 'QUEST UPDATE';
            case 'COMPLETE': return 'QUEST COMPLETE';
            case 'FAIL': return 'QUEST FAILED';
            default: return 'QUEST';
        }
    };

    const getTypeClass = () => {
        switch (type) {
            case 'COMPLETE': return styles.complete;
            case 'FAIL': return styles.fail;
            case 'UPDATE': return styles.update;
            default: return styles.new;
        }
    };

    return (
        <div className={`${styles.toast} ${parchmentStyles.panel} ${getTypeClass()}`}>
            <div className={styles.content}>
                <span className={styles.label}>{getTypeLabel()}</span>
                <h4 className={styles.title}>{title}</h4>
            </div>
        </div>
    );
};

export default QuestToast;
