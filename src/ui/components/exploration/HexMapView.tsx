import React from 'react';
import styles from './HexMapView.module.css';

import { Target, Pickaxe, Leaf, MapPin } from 'lucide-react';

interface HexData {
    id: string;
    q: number;
    r: number;
    biome: string;
    isVisited: boolean;
    isCurrent: boolean;
    isDiscovered: boolean;
    name?: string;
    playerName?: string;
    namingSource?: 'engine' | 'llm' | 'player';
    visualVariant?: number;
    resourceNodes?: { resourceType: string }[];
    interest_points?: { name: string }[];
}

interface HexMapViewProps {
    hexes: HexData[];
    onHexClick?: (id: string) => void;
    onHexContextMenu?: (id: string, x: number, y: number) => void;
    className?: string;
    viewMode?: 'normal' | 'zoomed-in' | 'zoomed-out';
    selectedHexId?: string;
    zoomScale?: number;
    isDraggable?: boolean;
}

const HexMapView: React.FC<HexMapViewProps> = ({
    hexes,
    onHexClick,
    onHexContextMenu,
    className = '',
    viewMode = 'normal',
    selectedHexId,
    zoomScale = 1,
    isDraggable = true
}) => {
    // Dynamic size based on view mode and zoom scale
    const baseSize = viewMode === 'zoomed-in' ? 60 : viewMode === 'zoomed-out' ? 15 : 30;
    const size = baseSize * zoomScale;

    // Panning state
    const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [lastMousePos, setLastMousePos] = React.useState({ x: 0, y: 0 });

    const currentHex = hexes.find(h => h.isCurrent);

    // Offset everything so current hex is at (0,0) effectively for the grid container
    const centerQ = currentHex ? currentHex.q : 0;
    const centerR = currentHex ? currentHex.r : 0;

    const getX = (q: number, r: number) => {
        const offset = isDraggable ? panOffset.x : 0;
        return size * (3 / 2 * (q - centerQ)) + offset;
    };
    const getY = (q: number, r: number) => {
        const offset = isDraggable ? panOffset.y : 0;
        return size * (Math.sqrt(3) / 2 * (q - centerQ) + Math.sqrt(3) * (r - centerR)) + offset;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isDraggable) return;
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isDraggable) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div
            className={`${styles.container} ${className} ${isDragging ? styles.dragging : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className={styles.grid}>
                {hexes.map((hex) => {
                    const biomeBase = hex.biome.toLowerCase();
                    const variantClass = hex.visualVariant ? styles[`${biomeBase}_${hex.visualVariant}`] : styles[biomeBase];
                    const tooltip = hex.playerName
                        ? `${hex.playerName} (${hex.name})`
                        : (hex.name || `${hex.biome} (${hex.q}, ${hex.r})`);

                    const isZoomedIn = viewMode === 'zoomed-in';
                    const isSelected = selectedHexId === hex.id;

                    return (
                        <div
                            key={hex.id}
                            className={`${styles.hex} ${variantClass || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''} ${isSelected ? styles.selected : ''}`}
                            title={tooltip}
                            style={{
                                left: `calc(50% + ${getX(hex.q, hex.r)}px)`,
                                top: `calc(50% + ${getY(hex.q, hex.r)}px)`,
                                width: `${size * 2}px`,
                                height: `${size * 2}px`,
                                transform: 'translate(-50%, -50%)'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onHexClick?.(hex.id);
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onHexContextMenu?.(hex.id, e.clientX, e.clientY);
                            }}
                        >
                            <div className={styles.hexInner}>
                                {hex.isCurrent && <div className={styles.playerMarker} />}

                                {isZoomedIn && (
                                    <div className={styles.details}>
                                        {hex.resourceNodes?.map((node, i) => (
                                            <div key={`res-${i}`} className={styles.detailIcon} title={node.resourceType}>
                                                {node.resourceType === 'Ore' || node.resourceType === 'Gem' ? <Pickaxe size={12} /> : <Leaf size={12} />}
                                            </div>
                                        ))}
                                        {hex.interest_points?.map((poi, i) => (
                                            <div key={`poi-${i}`} className={styles.detailIcon} title={poi.name}>
                                                <MapPin size={12} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {hexes.length === 0 && (
                    <div className={styles.emptyMap}>
                        Exploring the unknown...
                    </div>
                )}
            </div>
        </div>
    );
};

export default HexMapView;
