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
    npcs?: any[];
    connections?: string;
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
    previousControlPointOffset?: [number, number];
    findThePathActiveUntil?: number;
    navigationTarget?: [number, number];
    currentWorldTurns?: number;
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
    previousCoordinates,
    previousControlPointOffset,
    findThePathActiveUntil = 0,
    navigationTarget,
    currentWorldTurns = 0
}) => {
    const baseSize = viewMode === 'zoomed-in' ? 60 : viewMode === 'zoomed-out' ? 15 : 30;
    const size = baseSize * zoomScale;

    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [renderTrigger, setRenderTrigger] = useState(0);
    const lastTargetRef = useRef<{ q: number, r: number } | null>(null);
    const localStartTimeRef = useRef<number | null>(null);
    const lastAnimIdRef = useRef<string | null>(null);

    // Identify animation by coordinates to prevent resets if parent sends new objects
    const currentAnimId = travelAnimation
        ? `anim-${travelAnimation.startCoordinates.join(',')}-to-${travelAnimation.targetCoordinates.join(',')}`
        : null;

    if (currentAnimId !== lastAnimIdRef.current) {
        localStartTimeRef.current = travelAnimation ? performance.now() : null;
        lastAnimIdRef.current = currentAnimId;
    }

    // Calculate 't' using stable local clock
    const getT = () => {
        if (!travelAnimation || !localStartTimeRef.current) return 0;
        const now = performance.now();
        const elapsed = now - localStartTimeRef.current;
        const duration = Math.max(1, travelAnimation.duration);
        return Math.min(1, Math.max(0, elapsed / duration));
    };

    const t = getT();

    // Update lastTargetRef when travelAnimation changes to provide a stable fallback
    useEffect(() => {
        if (travelAnimation) {
            lastTargetRef.current = {
                q: travelAnimation.targetCoordinates[0],
                r: travelAnimation.targetCoordinates[1]
            };
        }
    }, [travelAnimation]);

    const getCameraAxial = () => {
        if (travelAnimation) {
            const { startCoordinates, targetCoordinates, controlPointOffset } = travelAnimation;

            const startQ = startCoordinates[0];
            const startR = startCoordinates[1];
            const targetQ = targetCoordinates[0];
            const targetR = targetCoordinates[1];

            const midQ = (startQ + targetQ) / 2;
            const midR = (startR + targetR) / 2;
            const controlQ = midQ + controlPointOffset[0];
            const controlR = midR + controlPointOffset[1];

            // Quadratic Bezier interpolation
            const q = Math.pow(1 - t, 2) * startQ + 2 * (1 - t) * t * controlQ + Math.pow(t, 2) * targetQ;
            const r = Math.pow(1 - t, 2) * startR + 2 * (1 - t) * t * controlR + Math.pow(t, 2) * targetR;

            return { q, r };
        }

        // Fallback: Use current hex, or the last targeted coordinates during transition
        const currentHex = hexes.find(h => h.isCurrent);
        if (currentHex) return { q: currentHex.q, r: currentHex.r };
        if (lastTargetRef.current) return lastTargetRef.current;
        return { q: 0, r: 0 };
    };

    const cameraAxial = getCameraAxial();

    const getX = (q: number, r: number) => {
        const offset = isDraggable ? panOffset.x : 0;
        return size * (3 / 2 * (q - cameraAxial.q)) + offset;
    };
    const getY = (q: number, r: number) => {
        const offset = isDraggable ? panOffset.y : 0;
        return -size * (Math.sqrt(3) / 2 * (q - cameraAxial.q) + Math.sqrt(3) * (r - cameraAxial.r)) + offset;
    };

    // Animation Loop - Continuous re-render while animation is active
    useEffect(() => {
        if (!travelAnimation) return;

        let rafId: number;
        const step = () => {
            const currentT = getT();
            setRenderTrigger(prev => prev + 1);

            if (currentT < 1) {
                rafId = requestAnimationFrame(step);
            }
        };

        rafId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafId);
    }, [currentAnimId]);

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

    const getMovingPlayerPos = () => {
        // Dot is ALWAYS at 0,0 relative to centered camera
        return { x: getX(cameraAxial.q, cameraAxial.r), y: getY(cameraAxial.q, cameraAxial.r) };
    };

    const playerPos = getMovingPlayerPos();

    // Calculate Trail Segments (Curved) using Axial Math
    const getInfrastructurePaths = () => {
        const infrastructure: { d: string, type: 'Road' | 'Path' | 'Ancient' | 'Disappearing' }[] = [];
        const processedPairs = new Set<string>();

        hexes.forEach(hex => {
            if (!hex.connections || !hex.isDiscovered) return;

            // Only render if relatively close to camera to save performance
            const dq = hex.q - cameraAxial.q;
            const dr = hex.r - cameraAxial.r;
            const dist = (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
            if (dist > 15) return;

            const parts = hex.connections.split(',');
            parts.forEach(part => {
                const [sideStr, typeCode, disco] = part.split(':');
                if (disco !== '1') return;

                const side = parseInt(sideStr, 10);
                let type: 'Road' | 'Path' | 'Ancient' | 'Disappearing' = 'Path';
                if (typeCode === 'R') type = 'Road';
                else if (typeCode === 'A') type = 'Ancient';
                else if (typeCode === 'D') type = 'Disappearing';

                // Calculate neighbor coordinates
                let nQ = hex.q;
                let nR = hex.r;
                switch (side) {
                    case 0: nR++; break; // N
                    case 1: nQ++; break; // NE
                    case 2: nQ++; nR--; break; // SE
                    case 3: nR--; break; // S
                    case 4: nQ--; break; // SW
                    case 5: nQ--; nR++; break; // NW
                }
                const neighborId = `${nQ},${nR}`;
                // REMOVED deduplication: each hex renders its own half-curve to allow biome-specific styles
                // const pairKey = [hex.id, neighborId].sort().join('-');
                // if (processedPairs.has(pairKey)) return;
                // processedPairs.add(pairKey);

                // Deterministic Bezier (Matches GameLoop.ts logic)
                const seed = (Math.min(hex.q, nQ) * 131 + Math.min(hex.r, nR) * 7 + Math.max(hex.q, nQ) * 31 + Math.max(hex.r, nR) * 3) % 1000;
                const pseudoRand = (s: number) => ((s * 9301 + 49297) % 233280) / 233280;

                const midQ = (hex.q + nQ) / 2;
                const midR = (hex.r + nR) / 2;
                const cX = pseudoRand(seed) * 0.8 - 0.4;
                const cY = pseudoRand(seed + 1) * 0.8 - 0.4;

                // Original Quadratic Bezier Points: P0 (hex), P1 (cp), P2 (neighbor)
                // cp = [midQ + cX, midR + cY]
                const p0: [number, number] = [hex.q, hex.r];
                const p1: [number, number] = [midQ + cX, midR + cY];
                const p2: [number, number] = [nQ, nR];

                // For split rendering, we draw the segment from t=0 to t=0.5 (the hex's half)
                // New points for the half-segment Bezier:
                // New P0 = p0
                // New P1 = (p0 + p1) / 2
                // New P2 = B(0.5) = (p0 + 2*p1 + p2) / 4

                const hp0 = p0;
                const hp1: [number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
                const hp2: [number, number] = [(p0[0] + 2 * p1[0] + p2[0]) / 4, (p0[1] + 2 * p1[1] + p2[1]) / 4];

                const sX = getX(hp0[0], hp0[1]);
                const sY = getY(hp0[0], hp0[1]);
                const ctX = getX(hp1[0], hp1[1]);
                const ctY = getY(hp1[0], hp1[1]);
                const eX = getX(hp2[0], hp2[1]);
                const eY = getY(hp2[0], hp2[1]);

                infrastructure.push({
                    d: `M ${sX} ${sY} Q ${ctX} ${ctY} ${eX} ${eY}`,
                    type: type
                });
            });
        });

        return infrastructure;
    };

    // Calculate Trail Segments (Curved) using Axial Math
    const getTrailPaths = () => {
        const paths: string[] = [];

        // Helper to get Axial path data for a sub-segment of a Quadratic Bezier curve using Blossoming
        const getAxialBezierSubcurve = (p0: [number, number], p1: [number, number], p2: [number, number], t0: number, t1: number) => {
            if (Math.abs(t1 - t0) < 0.001) return "";

            // Blossom formula for Quadratic Bezier: P(u, v) = (1-u)(1-v)P0 + [u(1-v) + v(1-u)]P1 + uvP2
            const blossom = (u: number, v: number): [number, number] => [
                (1 - u) * (1 - v) * p0[0] + (u * (1 - v) + v * (1 - u)) * p1[0] + u * v * p2[0],
                (1 - u) * (1 - v) * p0[1] + (u * (1 - v) + v * (1 - u)) * p1[1] + u * v * p2[1]
            ];

            // A sub-segment [t0, t1] of a quadratic Bezier has control points:
            // Q0 = P(t0, t0), Q1 = P(t0, t1), Q2 = P(t1, t1)
            const q0 = blossom(t0, t0);
            const q1 = blossom(t0, t1);
            const q2 = blossom(t1, t1);

            const sX = getX(q0[0], q0[1]);
            const sY = getY(q0[0], q0[1]);
            const cX = getX(q1[0], q1[1]);
            const cY = getY(q1[0], q1[1]);
            const eX = getX(q2[0], q2[1]);
            const eY = getY(q2[0], q2[1]);

            return `M ${sX} ${sY} Q ${cX} ${cY} ${eX} ${eY}`;
        };

        if (travelAnimation) {
            const { startCoordinates, targetCoordinates, controlPointOffset } = travelAnimation;

            const midQ = (startCoordinates[0] + targetCoordinates[0]) / 2;
            const midR = (startCoordinates[1] + targetCoordinates[1]) / 2;
            const cp: [number, number] = [midQ + controlPointOffset[0], midR + controlPointOffset[1]];

            // 1. Head Segment (Growing): Anchor (Start) -> Player (Center)
            const dHead = getAxialBezierSubcurve(startCoordinates, cp, targetCoordinates, 0, t);
            if (dHead) paths.push(dHead);

            if (previousCoordinates) {
                // 2. Tail Segment (Shrinking): Previous -> Anchor (Start)
                const pMidQ = (previousCoordinates[0] + startCoordinates[0]) / 2;
                const pMidR = (previousCoordinates[1] + startCoordinates[1]) / 2;
                const pCp: [number, number] = previousControlPointOffset ?
                    [pMidQ + previousControlPointOffset[0], pMidR + previousControlPointOffset[1]] : [pMidQ, pMidR];

                const dTail = getAxialBezierSubcurve(previousCoordinates, pCp, startCoordinates, t, 1);
                if (dTail) paths.push(dTail);
            }
        } else if (previousCoordinates) {
            const currentHex = hexes.find(h => h.isCurrent);
            if (currentHex) {
                const currentCoords: [number, number] = [currentHex.q, currentHex.r];
                const pMidQ = (previousCoordinates[0] + currentCoords[0]) / 2;
                const pMidR = (previousCoordinates[1] + currentCoords[1]) / 2;
                const pCp: [number, number] = previousControlPointOffset ?
                    [pMidQ + previousControlPointOffset[0], pMidR + previousControlPointOffset[1]] : [pMidQ, pMidR];

                const dIdle = getAxialBezierSubcurve(previousCoordinates, pCp, currentCoords, 0, 1);
                if (dIdle) paths.push(dIdle);
            }
        }

        return paths;
    };

    const getGoldenThreadPath = () => {
        if (!navigationTarget || currentWorldTurns >= findThePathActiveUntil) return null;

        const startQ = cameraAxial.q;
        const startR = cameraAxial.r;
        const targetQ = navigationTarget[0];
        const targetR = navigationTarget[1];

        const sX = getX(startQ, startR);
        const sY = getY(startQ, startR);
        const eX = getX(targetQ, targetR);
        const eY = getY(targetQ, targetR);

        // Simple bezier curve toward the target
        const midQ = (startQ + targetQ) / 2;
        const midR = (startR + targetR) / 2;

        // Add a slight "magical" arc
        const cX = getX(midQ + 0.5, midR + 0.5);
        const cY = getY(midQ + 0.5, midR + 0.5);

        return `M ${sX} ${sY} Q ${cX} ${cY} ${eX} ${eY}`;
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
                        <g className="infrastructure">
                            {getInfrastructurePaths().map((path, i) => (
                                <path
                                    key={`infra-${i}`}
                                    d={path.d}
                                    fill="none"
                                    stroke={
                                        path.type === 'Road' ? '#5d4037' :
                                            path.type === 'Ancient' ? '#9c27b0' :
                                                path.type === 'Disappearing' ? '#c2956b' :
                                                    '#a1887f'
                                    }
                                    strokeWidth={
                                        path.type === 'Road' ? '4' :
                                            path.type === 'Ancient' ? '3' :
                                                path.type === 'Disappearing' ? '1.5' :
                                                    '2'
                                    }
                                    strokeDasharray={
                                        path.type === 'Road' ? 'none' :
                                            path.type === 'Ancient' ? '5,5' :
                                                path.type === 'Disappearing' ? '3,6' :
                                                    '6,4'
                                    }
                                    opacity={
                                        path.type === 'Ancient' ? 0.8 :
                                            path.type === 'Disappearing' ? 0.3 :
                                                0.6
                                    }
                                    strokeLinecap="round"
                                    style={
                                        path.type === 'Ancient' ? { filter: 'drop-shadow(0 0 5px rgba(156, 39, 176, 0.5))' } :
                                            {}
                                    }
                                />
                            ))}
                        </g>

                        <g className="playerTrail">
                            {getTrailPaths().map((pathData, i) => (
                                <path
                                    key={`trail-${i}`}
                                    d={pathData}
                                    fill="none"
                                    stroke="#343d3dff"
                                    strokeWidth="4"
                                    strokeDasharray="8,6"
                                    opacity="0.8"
                                    strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.6))' }}
                                />
                            ))}
                        </g>

                        {/* Golden Thread (§6.4) */}
                        <g className="goldenThread">
                            {(() => {
                                const d = getGoldenThreadPath();
                                if (!d) return null;
                                return (
                                    <>
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke="#ffd700"
                                            strokeWidth="6"
                                            opacity="0.2"
                                            strokeLinecap="round"
                                            style={{ filter: 'blur(4px)' }}
                                        />
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke="#fffacd"
                                            strokeWidth="2"
                                            opacity="0.8"
                                            strokeLinecap="round"
                                            style={{ filter: 'drop-shadow(0 0 12px rgba(255, 215, 0, 0.9))' }}
                                        />
                                    </>
                                );
                            })()}
                        </g>
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
