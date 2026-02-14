import React, { useState, useEffect, useRef } from 'react';
import styles from './HexMapView.module.css';
import { Pickaxe, Leaf, MapPin } from 'lucide-react';

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
    namingSource?: 'engine' | 'llm' | 'player' | 'npc';
    visualVariant?: number;
    resourceNodes?: { resourceType: string }[];
    interest_points?: { name: string }[];
    inLineOfSight?: boolean;
    oceanDirection?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'SE' | 'NW' | 'SW';
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
    travelAnimation?: {
        startCoordinates: [number, number];
        targetCoordinates: [number, number];
        controlPointOffset: [number, number];
        startTime: number;
        duration: number;
    };
    previousCoordinates?: [number, number];
}

const HexMapView: React.FC<HexMapViewProps> = ({
    hexes,
    onHexClick,
    onHexContextMenu,
    className = '',
    viewMode = 'normal',
    selectedHexId,
    zoomScale = 1,
    isDraggable = true,
    travelAnimation,
    previousCoordinates
}) => {
    const baseSize = viewMode === 'zoomed-in' ? 60 : viewMode === 'zoomed-out' ? 15 : 30;
    const size = baseSize * zoomScale;

    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [animationProgress, setAnimationProgress] = useState(0);

    const currentHex = hexes.find(h => h.isCurrent);
    const centerQ = currentHex ? currentHex.q : 0;
    const centerR = currentHex ? currentHex.r : 0;

    const getX = (q: number, r: number) => {
        const offset = isDraggable ? panOffset.x : 0;
        return size * (3 / 2 * (q - centerQ)) + offset;
    };
    const getY = (q: number, r: number) => {
        const offset = isDraggable ? panOffset.y : 0;
        return -size * (Math.sqrt(3) / 2 * (q - centerQ) + Math.sqrt(3) * (r - centerR)) + offset;
    };

    // Animation Loop
    useEffect(() => {
        if (!travelAnimation) {
            setAnimationProgress(0);
            return;
        }

        let rafId: number;
        const update = () => {
            const now = Date.now();
            const elapsed = now - travelAnimation.startTime;
            const progress = Math.min(1, Math.max(0, elapsed / travelAnimation.duration));
            setAnimationProgress(progress);
            if (progress < 1) {
                rafId = requestAnimationFrame(update);
            }
        };
        rafId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafId);
    }, [travelAnimation]);

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

    const handleMouseUp = () => setIsDragging(false);

    // Calculate interpolated player position on a Quadratic Bezier Curve
    const getMovingPlayerPos = () => {
        if (!travelAnimation) {
            return { x: getX(centerQ, centerR), y: getY(centerQ, centerR) };
        }

        const { startCoordinates, targetCoordinates, controlPointOffset, startTime, duration } = travelAnimation;
        const now = Date.now();
        const t = Math.min(1, Math.max(0, (now - startTime) / duration));

        const startX = getX(startCoordinates[0], startCoordinates[1]);
        const startY = getY(startCoordinates[0], startCoordinates[1]);
        const targetX = getX(targetCoordinates[0], targetCoordinates[1]);
        const targetY = getY(targetCoordinates[0], targetCoordinates[1]);

        const midX = (startX + targetX) / 2;
        const midY = (startY + targetY) / 2;

        const controlX = midX + controlPointOffset[0] * (size * 2);
        const controlY = midY + controlPointOffset[1] * (size * 2);

        // Quadratic Bezier Formula: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
        const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * targetX;
        const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * targetY;

        return { x, y };
    };

    const playerPos = getMovingPlayerPos();

    // Calculate Trail Segments (Curved)
    const getTrailPaths = () => {
        const paths: string[] = [];

        if (travelAnimation) {
            const { startCoordinates, targetCoordinates, controlPointOffset } = travelAnimation;
            const startX = getX(startCoordinates[0], startCoordinates[1]);
            const startY = getY(startCoordinates[0], startCoordinates[1]);
            const targetX = getX(targetCoordinates[0], targetCoordinates[1]);
            const targetY = getY(targetCoordinates[0], targetCoordinates[1]);

            const cpOffset = controlPointOffset || [0, 0];
            const midX = (startX + targetX) / 2;
            const midY = (startY + targetY) / 2;
            const controlX = midX + cpOffset[0] * (size * 2);
            const controlY = midY + cpOffset[1] * (size * 2);

            const now = Date.now();
            const t = Math.min(1, Math.max(0, (now - travelAnimation.startTime) / travelAnimation.duration));
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

            const q1x = lerp(startX, controlX, t);
            const q1y = lerp(startY, controlY, t);

            const dHead = `M ${startX} ${startY} Q ${q1x} ${q1y} ${playerPos.x} ${playerPos.y}`;
            paths.push(dHead);

            if (previousCoordinates) {
                const prevX = getX(previousCoordinates[0], previousCoordinates[1]);
                const prevY = getY(previousCoordinates[0], previousCoordinates[1]);
                const tailT = t;
                const tailX = prevX + (startX - prevX) * tailT;
                const tailY = prevY + (startY - prevY) * tailT;

                const dTail = `M ${startX} ${startY} L ${tailX} ${tailY}`;
                paths.push(dTail);
            }
        } else if (previousCoordinates) {
            const prevX = getX(previousCoordinates[0], previousCoordinates[1]);
            const prevY = getY(previousCoordinates[0], previousCoordinates[1]);
            const currentX = getX(centerQ, centerR);
            const currentY = getY(centerQ, centerR);

            const dIdle = `M ${prevX} ${prevY} L ${currentX} ${currentY}`;
            paths.push(dIdle);
        }

        return paths;
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
                    const displayName = hex.name || `${hex.biome} (${hex.q}, ${hex.r})`;
                    const tooltip = hex.playerName ? `${hex.name || hex.biome} (${hex.playerName})` : displayName;
                    const isZoomedIn = viewMode === 'zoomed-in';
                    const isSelected = selectedHexId === hex.id;
                    const showBiomeImage = (hex.isVisited || hex.name?.includes('(Discovered)') || hex.name?.includes('(Uncharted Territory)')) && hex.name !== 'Uncharted Territory';

                    return (
                        <div
                            key={hex.id}
                            className={`${styles.hex} ${variantClass || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''} ${isSelected ? styles.selected : ''}`}
                            title={tooltip}
                            style={{
                                left: `calc(50% + ${getX(hex.q, hex.r)}px)`,
                                top: `calc(50% + ${getY(hex.q, hex.r)}px)`,
                                width: `${size * 2}px`,
                                height: `${size * Math.sqrt(3)}px`,
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
                                {showBiomeImage && hex.visualVariant && (
                                    <img
                                        src={`/assets/biomes/${biomeBase}_${hex.visualVariant}.png`}
                                        className={styles.biomeImage}
                                        alt=""
                                        style={hex.biome === 'Coast' ? {
                                            transform: `rotate(${(() => {
                                                switch (hex.oceanDirection) {
                                                    case 'E': case 'SE': case 'NE': return '0deg';
                                                    case 'W': case 'SW': case 'NW': return '180deg';
                                                    case 'N': return '-90deg';
                                                    case 'S': return '90deg';
                                                    default: return '0deg';
                                                }
                                            })()})`
                                        } : {}}
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            if (!img.src.endsWith('_1.png')) img.src = `/assets/biomes/${biomeBase}_1.png`;
                                            else img.style.display = 'none';
                                        }}
                                    />
                                )}

                                {isZoomedIn && (
                                    <div className={styles.details}>
                                        {hex.resourceNodes?.map((node, i) => (
                                            <div key={`res-${i}`} className={styles.detailIcon} title={node.resourceType}>
                                                <Leaf size={12} />
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

                {/* Overlay Layer for Trail and Floating Marker */}
                <div className={styles.overlayLayerContainer} style={{ zIndex: 100 }}>
                    <svg
                        className={styles.overlayLayerSvg}
                        viewBox="-500 -500 1000 1000"
                        style={{ overflow: 'visible' }}
                    >
                        {getTrailPaths().map((pathData, i) => (
                            <path
                                key={i}
                                d={pathData}
                                fill="none"
                                stroke="#4ecdc4"
                                strokeWidth="4"
                                strokeDasharray="8,6"
                                opacity="0.8"
                                strokeLinecap="round"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.6))' }}
                            />
                        ))}
                    </svg>

                    <div
                        className={styles.playerMarkerFloating}
                        style={{
                            left: `calc(50% + ${playerPos.x}px)`,
                            top: `calc(50% + ${playerPos.y}px)`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default HexMapView;
