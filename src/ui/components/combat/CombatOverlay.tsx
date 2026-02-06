import React, { useState, useEffect } from 'react';
import styles from './CombatOverlay.module.css';

interface CombatEvent {
    id: string;
    type: 'HIT' | 'MISS' | 'CRIT' | 'HEAL' | 'CONDITION';
    targetId: string;
    value?: number;
    text?: string;
    timestamp: number;
}

interface CombatOverlayProps {
    events: CombatEvent[];
}

const CombatOverlay: React.FC<CombatOverlayProps> = ({ events }) => {
    // We only want to show very recent events
    const [activeEvents, setActiveEvents] = useState<CombatEvent[]>([]);

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

    return (
        <div className={styles.overlayContainer}>
            {activeEvents.map(event => (
                <div
                    key={event.id}
                    className={`${styles.floatingEvent} ${styles[event.type.toLowerCase()]}`}
                >
                    {event.type === 'MISS' ? 'MISS' : (event.value !== undefined ? event.value : event.text)}
                    {event.type === 'CRIT' && <span className={styles.critLabel}>!</span>}
                </div>
            ))}
        </div>
    );
};

export default CombatOverlay;
