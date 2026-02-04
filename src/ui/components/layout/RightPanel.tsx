import React from 'react';
import styles from './RightPanel.module.css';
import { MessageSquare, Map as MapIcon, Target } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import HexMapView from '../exploration/HexMapView';
import QuestList from '../exploration/QuestList';

interface RightPanelProps {
    className?: string;
}

const RightPanel: React.FC<RightPanelProps> = ({ className }) => {
    const { state } = useGameState();

    if (!state) return null;

    // Map state.worldMap.hexes to HexMapView format
    const hexData = Object.entries(state.worldMap.hexes).map(([id, hex]) => ({
        id,
        q: hex.coordinates[0],
        r: hex.coordinates[1],
        biome: hex.biome,
        isVisited: hex.visited,
        isCurrent: state.location.hexId === id,
        isDiscovered: hex.visited || hex.generated
    }));

    // Format history for display
    const visibleHistory = state.conversationHistory.slice(-30);

    return (
        <aside className={`${styles.rightPanel} ${className}`}>
            <div className={styles.section}>
                <h3>
                    <MapIcon size={16} />
                    World Map
                </h3>
                <div className={styles.mapContainer}>
                    <HexMapView hexes={hexData} />
                </div>
            </div>

            <div className={`${styles.section} ${styles.questSection}`}>
                <h3>
                    <Target size={16} />
                    Current Quests
                </h3>
                <QuestList quests={state.activeQuests} />
            </div>

            <div className={styles.chatSection}>
                <div className={styles.sectionHeader}>
                    <MessageSquare size={16} />
                    <h2>Narrative & Events</h2>
                </div>
                <div className={styles.log}>
                    {visibleHistory.length === 0 ? (
                        <div className={styles.systemText}>No logs recorded yet.</div>
                    ) : (
                        visibleHistory.map((turn, i) => (
                            <div key={i} className={
                                turn.role === 'narrator' ? styles.narratorText :
                                    turn.role === 'user' ? styles.userText :
                                        styles.systemText
                            }>
                                <span className={styles.timestamp}>[{turn.turnNumber}]</span>
                                <strong>{turn.role.toUpperCase()}: </strong>
                                {turn.content}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </aside>
    );
};

export default RightPanel;
