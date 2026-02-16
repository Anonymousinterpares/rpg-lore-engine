import React, { useEffect, useState } from 'react';
import styles from './NotificationOverlay.module.css';
import { BookOpen, X, AlertCircle } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';

interface NotificationOverlayProps {
    onOpenCodex: (category: string, entryId: string) => void;
}

const NotificationOverlay: React.FC<NotificationOverlayProps> = ({ onOpenCodex }) => {
    const { state, updateState } = useGameState();
    const [activeNotif, setActiveNotif] = useState<any>(null);

    useEffect(() => {
        if (!state?.notifications) return;

        const now = Date.now();
        const unreadList = state.notifications.filter(n => !n.isRead);

        // Auto-dismiss stale notifications
        const stale = unreadList.filter(n => now - n.createdAt > 15000);
        if (stale.length > 0) {
            stale.forEach(n => { n.isRead = true; });
            updateState();
            return;
        }

        const nextNotif = unreadList[0];
        if (nextNotif) {
            setActiveNotif(nextNotif);

            // Shorter time for errors (3s), longer for lore (8s)
            const duration = nextNotif.type === 'SYSTEM_ERROR' ? 3000 : 8000;
            const timer = setTimeout(() => {
                markAsRead(nextNotif.id);
            }, duration);

            return () => clearTimeout(timer);
        } else {
            setActiveNotif(null);
        }
    }, [state]);

    const markAsRead = (id: string) => {
        const notif = state?.notifications?.find(n => n.id === id);
        if (notif) {
            notif.isRead = true;
            updateState();
        }
    };

    const handleClick = () => {
        if (activeNotif && activeNotif.type === 'CODEX_ENTRY') {
            onOpenCodex(activeNotif.data.category, activeNotif.data.entityId);
            markAsRead(activeNotif.id);
        }
    };

    if (!activeNotif) return null;

    const isError = activeNotif.type === 'SYSTEM_ERROR';

    return (
        <div 
            className={`${styles.container} ${isError ? styles.errorContainer : ''}`} 
            onClick={isError ? undefined : handleClick}
        >
            <div className={styles.icon}>
                {isError ? <AlertCircle size={20} /> : <BookOpen size={20} />}
            </div>
            <div className={styles.content}>
                <span className={styles.title}>{isError ? 'System Error' : 'New Lore Discovered'}</span>
                <span className={styles.message}>{activeNotif.message}</span>
            </div>
            <button
                className={styles.closeBtn}
                onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(activeNotif.id);
                }}
            >
                <X size={16} />
            </button>
            <div className={isError ? styles.errorProgressBar : styles.progressBar} />
        </div>
    );
};

export default NotificationOverlay;
