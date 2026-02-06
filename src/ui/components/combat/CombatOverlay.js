import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './CombatOverlay.module.css';
const CombatOverlay = ({ events }) => {
    // We only want to show very recent events
    const [activeEvents, setActiveEvents] = useState([]);
    useEffect(() => {
        const now = Date.now();
        // Filter for events in the last 2 seconds
        const recent = events.filter(e => now - e.timestamp < 1500);
        setActiveEvents(recent);
        // Cleanup old events from local state after they finish animating
        const timer = setInterval(() => {
            const currentNow = Date.now();
            setActiveEvents(prev => prev.filter(e => currentNow - e.timestamp < 1500));
        }, 500);
        return () => clearInterval(timer);
    }, [events]);
    return (_jsx("div", { className: styles.overlayContainer, children: activeEvents.map(event => (_jsxs("div", { className: `${styles.floatingEvent} ${styles[event.type.toLowerCase()]}`, children: [event.type === 'MISS' ? 'MISS' : (event.value !== undefined ? event.value : event.text), event.type === 'CRIT' && _jsx("span", { className: styles.critLabel, children: "!" })] }, event.id))) }));
};
export default CombatOverlay;
