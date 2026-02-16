import React from 'react';
import styles from './LocationPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { MapPin, Info, Trees, Mountain, Waves, Landmark, Compass, Pickaxe, Users, Route } from 'lucide-react';

interface Poi {
    id: string;
    name: string;
    discovered?: boolean;
    type?: string;
}

interface LocationPanelProps {
    name: string;
    biome: string;
    description: string;
    interestPoints: Poi[];
    resourceNodes?: any[];
    npcs?: { name: string, id: string }[];
    connections?: string;
    onCompassClick?: () => void;
    className?: string;
}

const LocationPanel: React.FC<LocationPanelProps> = ({ name, biome, description, interestPoints, resourceNodes = [], npcs = [], connections, onCompassClick, className = '' }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const getBiomeIcon = (biome: string) => {
        switch (biome.toLowerCase()) {
            case 'forest': return <Trees size={16} />;
            case 'mountains':
            case 'mountain_high': return <Mountain size={16} />;
            case 'ocean':
            case 'coast':
            case 'coast_cold':
            case 'coast_desert': return <Waves size={16} />;
            case 'plains': return <Trees size={16} />; // Use trees for now
            default: return <MapPin size={16} />;
        }
    };

    const parseConnections = (connStr?: string) => {
        if (!connStr) return [];
        return connStr.split(',').map(part => {
            const [side, type, disco] = part.split(':');
            if (disco !== '1') return null;
            return {
                direction: ['N', 'NE', 'SE', 'S', 'SW', 'NW'][parseInt(side)],
                type: type === 'R' ? 'Road' : type === 'A' ? 'Ancient' : 'Path'
            };
        }).filter(c => c !== null);
    };

    const activeConnections = parseConnections(connections);

    return (
        <div className={`${styles.panel} ${isExpanded ? styles.expanded : ''} ${className}`}>
            <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
                <div className={styles.headerMain}>
                    <div className={styles.biomeBadge}>
                        {getBiomeIcon(biome)}
                        <span>{biome}</span>
                    </div>
                    <h3 className={styles.title}>{name}</h3>
                </div>
                <div className={styles.headerActions}>
                    {onCompassClick && (
                        <button
                            className={styles.compassButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                onCompassClick();
                            }}
                            title="Open Navigation & Skills Menu"
                        >
                            <Compass size={24} />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className={styles.content}>
                    {description && <p className={styles.description}>{description}</p>}

                    {interestPoints.filter(p => p.discovered !== false).length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <Landmark size={14} />
                                <span>Points of Interest</span>
                            </div>
                            <div className={styles.itemList}>
                                {interestPoints.filter(p => p.discovered !== false).map(poi => (
                                    <div key={poi.id} className={styles.item}>
                                        <Info size={12} />
                                        <span>{poi.name} {poi.type ? `(${poi.type})` : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {resourceNodes.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <Pickaxe size={14} />
                                <span>Resources</span>
                            </div>
                            <div className={styles.itemList}>
                                {resourceNodes.map((node, i) => (
                                    <div key={i} className={styles.item}>
                                        <Pickaxe size={12} />
                                        <span>{node.resourceType}: {node.itemId} ({node.quantityRemaining})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {npcs.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <Users size={14} />
                                <span>Known NPCs</span>
                            </div>
                            <div className={styles.itemList}>
                                {npcs.map((npc, i) => (
                                    <div key={i} className={styles.item}>
                                        <Users size={12} />
                                        <span>{npc.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeConnections.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <Route size={14} />
                                <span>Infrastructure</span>
                            </div>
                            <div className={styles.itemList}>
                                {activeConnections.map((conn, i) => (
                                    <div key={i} className={styles.item}>
                                        <Route size={12} />
                                        <span>{conn.type} to the {conn.direction}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LocationPanel;
