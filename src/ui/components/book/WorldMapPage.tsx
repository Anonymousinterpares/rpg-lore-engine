import React, { useState } from 'react';
import styles from './WorldMapPage.module.css';
import HexMapView from '../exploration/HexMapView';
import { useGameState } from '../../hooks/useGameState';
import { MapPin, Pickaxe, Leaf, Info } from 'lucide-react';

const WorldMapPage: React.FC = () => {
    const { state } = useGameState();
    const [selectedHexId, setSelectedHexId] = useState<string | null>(state?.location.hexId || null);
    const [zoomMultiplier, setZoomMultiplier] = useState(1);

    if (!state) return null;

    const hexData = Object.entries(state.worldMap.hexes).map(([id, hex]) => ({
        id,
        q: hex.coordinates[0],
        r: hex.coordinates[1],
        biome: hex.biome,
        isVisited: hex.visited,
        isCurrent: state.location.hexId === id,
        isDiscovered: hex.visited || hex.generated,
        name: hex.name,
        playerName: hex.playerName,
        namingSource: hex.namingSource,
        visualVariant: hex.visualVariant,
        resourceNodes: hex.resourceNodes,
        interest_points: hex.interest_points
    }));

    const selectedHex = selectedHexId ? state.worldMap.hexes[selectedHexId] : null;

    const handleZoomIn = () => setZoomMultiplier(m => Math.min(m + 0.2, 3));
    const handleZoomOut = () => setZoomMultiplier(m => Math.max(m - 0.2, 0.5));

    return (
        <div className={styles.container}>
            <div className={styles.mapArea}>
                <div className={styles.zoomControls}>
                    <button onClick={handleZoomIn} title="Zoom In">+</button>
                    <button onClick={handleZoomOut} title="Zoom Out">-</button>
                    <button onClick={() => setZoomMultiplier(1)} title="Reset Zoom">1:1</button>
                </div>
                <HexMapView
                    hexes={hexData}
                    onHexClick={setSelectedHexId}
                    className={styles.largeMap}
                    viewMode="normal"
                    selectedHexId={selectedHexId || undefined}
                    zoomScale={zoomMultiplier}
                />
            </div>

            <div className={styles.detailsPanel}>
                <h2 className={styles.title}>
                    <MapPin size={20} />
                    {selectedHexId || 'Unknown Territory'}
                </h2>

                {selectedHex ? (
                    <div className={styles.detailsContent}>
                        <div className={styles.section}>
                            <h3>Name</h3>
                            <p className={styles.hexName}>
                                {selectedHex.playerName ? (
                                    <span className={styles.playerName}>{selectedHex.playerName}</span>
                                ) : (
                                    <span className={styles.engineName}>{selectedHex.name || 'Unnamed'}</span>
                                )}
                            </p>
                        </div>

                        <div className={styles.section}>
                            <h3>Biome</h3>
                            <p>{selectedHex.biome}</p>
                        </div>

                        {selectedHex.interest_points.length > 0 && (
                            <div className={styles.section}>
                                <h3>Points of Interest</h3>
                                <ul className={styles.poiList}>
                                    {selectedHex.interest_points.map((poi, i) => (
                                        <li key={i}>{poi.name}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {selectedHex.resourceNodes.length > 0 && (
                            <div className={styles.section}>
                                <h3>Known Resources</h3>
                                <ul className={styles.resourceList}>
                                    {selectedHex.resourceNodes.map((node, i) => (
                                        <li key={i} className={styles.resourceItem}>
                                            {node.resourceType === 'Ore' || node.resourceType === 'Gem' ? <Pickaxe size={14} /> : <Leaf size={14} />}
                                            {node.resourceType} ({node.quantityRemaining} left)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className={styles.section}>
                            <h3>Description</h3>
                            <p className={styles.description}>{selectedHex.description}</p>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <Info size={40} />
                        <p>Select a region on the map to view detailed chronicles and resources.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorldMapPage;
