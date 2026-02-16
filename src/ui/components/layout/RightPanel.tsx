import React from 'react';
import styles from './RightPanel.module.css';
import { MessageSquare, Map as MapIcon, Target } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import HexMapView from '../exploration/HexMapView';
import QuestList from '../exploration/QuestList';

interface RightPanelProps {
    className?: string;
    onWorldMap?: () => void;
    onQuests?: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ className, onWorldMap, onQuests }) => {
    const { state, engine, updateState } = useGameState();
    const [viewMode, setViewMode] = React.useState<'normal' | 'zoomed-in' | 'zoomed-out'>('normal');
    const [contextMenu, setContextMenu] = React.useState<{ id: string, x: number, y: number } | null>(null);

    if (!state) return null;

    const toggleViewMode = () => {
        if (viewMode === 'normal') setViewMode('zoomed-in');
        else if (viewMode === 'zoomed-in') setViewMode('zoomed-out');
        else setViewMode('normal');
    };

    const handleHexContextMenu = (id: string, x: number, y: number) => {
        setContextMenu({ id, x, y });
    };

    const handleMove = async (destination: string | [number, number]) => {
        if (engine) {
            if (typeof destination === 'string') {
                await engine.processTurn(`/move ${destination}`);
            } else {
                await engine.processTurn(`/moveto ${destination[0]} ${destination[1]}`);
            }
            setContextMenu(null);
        }
    };

    const closeMenu = () => setContextMenu(null);

    // Map state.worldMap.hexes to HexMapView format
    const hexData = Object.entries(state.worldMap.hexes).map(([id, hex]) => ({
        id,
        q: hex.coordinates[0],
        r: hex.coordinates[1],
        biome: hex.biome,
        isVisited: hex.visited,
        isCurrent: state.location.hexId === id,
        isDiscovered: hex.visited || hex.inLineOfSight || false, // Show if visited or in LOS
        name: hex.name,
        playerName: hex.playerName,
        namingSource: hex.namingSource,
        visualVariant: hex.visualVariant,
        resourceNodes: hex.resourceNodes,
        interest_points: hex.interest_points,
        oceanDirection: (hex as any).oceanDirection,
        connections: hex.connections
    }));

    // Filter based on viewMode
    const currentHex = state.worldMap.hexes[state.location.hexId];
    const filteredHexes = hexData.filter(hex => {
        if (viewMode === 'zoomed-in') return hex.isCurrent;
        const radius = viewMode === 'normal' ? 3 : 10;
        if (!currentHex) return hex.isDiscovered;

        // Simple cube/axial distance calculation
        const dq = hex.q - currentHex.coordinates[0];
        const dr = hex.r - currentHex.coordinates[1];
        const distance = (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
        return distance <= radius;
    });

    // Format history for display
    const visibleHistory = state.conversationHistory.slice(-30);

    return (
        <aside className={`${styles.rightPanel} ${className}`}>
            <div className={styles.section}>
                <h3 className={styles.mapHeader} onClick={onWorldMap} style={{ cursor: 'pointer' }}>
                    <div className={styles.headerLeft}>
                        <MapIcon size={16} />
                        World Map
                    </div>
                    <div className={styles.viewToggleGroup}>
                        <span className={styles.toggleLabel}>Map view:</span>
                        <button
                            className={styles.viewToggle}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleViewMode();
                            }}
                        >
                            {viewMode.replace('-', ' ')}
                        </button>
                    </div>
                </h3>
                <div className={styles.mapContainer}>
                    <HexMapView
                        hexes={filteredHexes}
                        viewMode={viewMode}
                        isDraggable={false}
                        travelAnimation={state.location.travelAnimation}
                        previousCoordinates={state.location.previousCoordinates}
                        previousControlPointOffset={state.location.previousControlPointOffset}
                        findThePathActiveUntil={state.findThePathActiveUntil}
                        navigationTarget={state.navigationTarget}
                        currentWorldTurns={state.worldTime.totalTurns}
                        onHexClick={(id) => {
                            // Left click now only selects, does not move
                            // Ideally, we should set some selected state here if we want inspection
                        }}
                        onHexContextMenu={handleHexContextMenu}
                    />
                </div>
                {contextMenu && (() => {
                    const targetHex = state.worldMap.hexes[contextMenu.id];
                    const currentCoords = state.location.coordinates;
                    const targetCoords = targetHex.coordinates;
                    const dx = targetCoords[0] - currentCoords[0];
                    const dy = targetCoords[1] - currentCoords[1];

                    let direction = '';
                    if (dx === 0 && dy === 1) direction = 'N';
                    else if (dx === 0 && dy === -1) direction = 'S';
                    else if (dx === 1 && dy === 0) direction = 'NE';
                    else if (dx === 1 && dy === -1) direction = 'SE';
                    else if (dx === -1 && dy === 1) direction = 'NW';
                    else if (dx === -1 && dy === 0) direction = 'SW';

                    const isAdjacent = direction !== '';

                    return (
                        <div
                            className={styles.contextMenu}
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {isAdjacent ? (
                                <button onClick={() => handleMove(direction)}>
                                    Move towards {direction}
                                </button>
                            ) : (
                                <div className={styles.contextMenuDisabled}>
                                    Too far to travel
                                </div>
                            )}
                            <button onClick={closeMenu} className={styles.cancelButton}>Cancel</button>
                        </div>
                    );
                })()}
            </div>

            <div className={`${styles.section} ${styles.questSection}`}>
                <h3 onClick={onQuests} style={{ cursor: 'pointer' }}>
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
                                    turn.role === 'player' ? styles.userText :
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
