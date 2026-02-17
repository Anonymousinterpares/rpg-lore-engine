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

interface NpcCardData {
    id: string;
    name: string;
    role?: string;
    factionId?: string;
    isMerchant: boolean;
    standing: number;
}

interface LocationPanelProps {
    name: string;
    biome: string;
    description: string;
    interestPoints: Poi[];
    resourceNodes?: any[];
    npcs?: NpcCardData[];
    connections?: string;
    onCompassClick?: () => void;
    onTalkToNpc?: (npcId: string) => void;
    talkingNpcId?: string | null;
    className?: string;
}

const LocationPanel: React.FC<LocationPanelProps> = ({
    name, biome, description, interestPoints, resourceNodes = [],
    npcs = [], connections, onCompassClick, onTalkToNpc, talkingNpcId, className = ''
}) => {
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

    const getStandingLabel = (standing: number): string => {
        if (standing >= 50) return 'Allied';
        if (standing >= 25) return 'Friendly';
        if (standing >= 0) return 'Neutral';
        if (standing >= -25) return 'Wary';
        if (standing >= -50) return 'Hostile';
        return 'Nemesis';
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
                            <div className={styles.npcList}>
                                {npcs.map((npc) => (
                                    <div key={npc.id} className={styles.npcCard}>
                                        <div className={styles.npcHeader}>
                                            <Users size={14} />
                                            <span className={styles.npcName}>{npc.name}</span>
                                        </div>
                                        <div className={styles.npcMeta}>
                                            {npc.role && <span className={styles.npcRole}>{npc.role}</span>}
                                            {npc.factionId && (
                                                <span className={styles.npcFaction}>
                                                    {npc.factionId.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.npcStanding}>
                                            <span className={
                                                npc.standing > 0 ? styles.standingPositive :
                                                    npc.standing < 0 ? styles.standingNegative :
                                                        styles.standingNeutral
                                            }>
                                                {npc.standing > 0 ? '♥' : npc.standing < 0 ? '☠' : '◆'} {getStandingLabel(npc.standing)}
                                            </span>
                                        </div>
                                        <div className={styles.npcActions}>
                                            {talkingNpcId === npc.id ? (
                                                <div className={styles.npcThinking}>
                                                    <span className={styles.thinkingDot}>.</span>
                                                    <span className={styles.thinkingDot}>.</span>
                                                    <span className={styles.thinkingDot}>.</span>
                                                    <span className={styles.thinkingText}>Listening</span>
                                                </div>
                                            ) : (
                                                <button
                                                    className={styles.npcActionButton}
                                                    onClick={() => onTalkToNpc?.(npc.id)}
                                                    title={`Talk to ${npc.name}`}
                                                    disabled={!!talkingNpcId} // Disable all buttons while talking
                                                >
                                                    💬 Talk
                                                </button>
                                            )}
                                            {talkingNpcId === npc.id && (
                                                <button
                                                    className={`${styles.npcActionButton} ${styles.endTalkButton}`}
                                                    onClick={() => onTalkToNpc?.('__end__')}
                                                    title="End Conversation"
                                                >
                                                    🚪 Exit
                                                </button>
                                            )}
                                            {npc.isMerchant && (
                                                <button
                                                    className={styles.npcActionButton}
                                                    disabled
                                                    title="Trading coming in Phase B"
                                                >
                                                    🛒 Trade
                                                </button>
                                            )}
                                        </div>
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
