import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import styles from './NotificationOverlay.module.css';
import { BookOpen, X } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
const NotificationOverlay = ({ onOpenCodex }) => {
    const { state, updateState } = useGameState();
    const [activeNotif, setActiveNotif] = useState(null);
    useEffect(() => {
        if (state?.notifications && state.notifications.length > 0) {
            const unread = state.notifications.find(n => !n.isRead);
            if (unread) {
                setActiveNotif(unread);
                // Auto-hide after 8 seconds
                const timer = setTimeout(() => {
                    markAsRead(unread.id);
                }, 8000);
                return () => clearTimeout(timer);
            }
            else {
                setActiveNotif(null);
            }
        }
    }, [state?.notifications]);
    const markAsRead = (id) => {
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
    if (!activeNotif)
        return null;
    return (_jsxs("div", { className: styles.container, onClick: handleClick, children: [_jsx("div", { className: styles.icon, children: _jsx(BookOpen, { size: 20 }) }), _jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.title, children: "New Lore Discovered" }), _jsx("span", { className: styles.message, children: activeNotif.message })] }), _jsx("button", { className: styles.closeBtn, onClick: (e) => {
                    e.stopPropagation();
                    markAsRead(activeNotif.id);
                }, children: _jsx(X, { size: 16 }) }), _jsx("div", { className: styles.progressBar })] }));
};
export default NotificationOverlay;
