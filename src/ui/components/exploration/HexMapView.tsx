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
        travelType?: 'Road' | 'Path' | 'Ancient' | 'Stealth' | 'Wilderness';
    };
    previousCoordinates?: [number, number];
    previousPreviousCoordinates?: [number, number];
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
    previousPreviousCoordinates,
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

    // Extract the shared wiggle logic so roads, camera, and trails are perfectly synced.
    const getAxialWiggle = (
        startQ: number, startR: number,
        endQ: number, endR: number,
        t: number,
        travelType: 'Road' | 'Path' | 'Ancient' | 'Stealth' | 'Wilderness' = 'Wilderness'
    ) => {
        // Simple hash function for consistent seeds
        const hashString = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        };

        // For paths/roads, we want the seed to be identical regardless of travel direction
        const isReversed = startQ > endQ || (startQ === endQ && startR > endR);
        const canonStartQ = isReversed ? endQ : startQ;
        const canonStartR = isReversed ? endR : startR;
        const canonEndQ = isReversed ? startQ : endQ;
        const canonEndR = isReversed ? startR : endR;

        // If wandering wilderness, we can use a different seed or the raw coordinates
        // so it looks like walking off-path.
        const seedStr = (travelType === 'Stealth' || travelType === 'Wilderness')
            ? `${startQ},${startR}-${endQ},${endR}-wild`
            : `${canonStartQ},${canonStartR}-${canonEndQ},${canonEndR}`;

        const seed = hashString(seedStr);
        const pseudoRand = (s: number) => ((s * 9301 + 49297) % 233280) / 233280;

        // Amplitude values based on travel type
        // Roads are tighter, wilderness is wilder
        let baseAmp = 1.0;
        if (travelType === 'Stealth') baseAmp = 1.5;
        if (travelType === 'Road') baseAmp = 0.5;

        const amp1 = (pseudoRand(seed) - 0.5) * 0.15 * baseAmp;
        const amp2 = (pseudoRand(seed + 1) - 0.5) * 0.25 * baseAmp;
        const amp3 = (pseudoRand(seed + 2) - 0.5) * 0.20 * baseAmp;
        const amp4 = (pseudoRand(seed + 3) - 0.5) * 0.15 * baseAmp;
        const amp5 = (pseudoRand(seed + 4) - 0.5) * 0.10 * baseAmp;

        const getDisplacement = (val: number) => {
            // Evaluates the fourier series for a canonical t from 0 to 1
            return amp1 * Math.sin(Math.PI * val) +
                amp2 * Math.sin(2 * Math.PI * val) +
                amp3 * Math.sin(3 * Math.PI * val) +
                amp4 * Math.sin(4 * Math.PI * val) +
                amp5 * Math.sin(5 * Math.PI * val);
        };

        // If we are traveling 'reversed' down a canonical path, we evaluate the curve backwards
        const canonicalT = isReversed ? 1.0 - t : t;
        const disp = getDisplacement(canonicalT);

        // Vector math in RAW screen space (ignoring camera and pan offsets for now, we just want the geometric shape)
        const sX = size * (3 / 2 * canonStartQ);
        const sY = -size * (Math.sqrt(3) / 2 * canonStartQ + Math.sqrt(3) * canonStartR);
        const eX = size * (3 / 2 * canonEndQ);
        const eY = -size * (Math.sqrt(3) / 2 * canonEndQ + Math.sqrt(3) * canonEndR);

        const vX = eX - sX;
        const vY = eY - sY;
        const len = Math.sqrt(vX * vX + vY * vY) || 1;

        // Normal vector to the axis line
        let nX = -vY / len;
        let nY = vX / len;

        // Apply normal displacement in screen space
        const pixelDisp = disp * size;

        // Pure un-offset pixel position of the point on the curve
        const rawPX = sX + vX * canonicalT + nX * pixelDisp;
        const rawPY = sY + vY * canonicalT + nY * pixelDisp;

        // Convert back to pure axial coordinates
        const q = rawPX / (size * 1.5);
        const r = (rawPY / -size - (Math.sqrt(3) / 2) * q) / Math.sqrt(3);

        return { q, r };
    };

    const getCameraAxial = () => {
        if (travelAnimation) {
            const { startCoordinates, targetCoordinates, travelType } = travelAnimation;
            const res = getAxialWiggle(
                startCoordinates[0], startCoordinates[1],
                targetCoordinates[0], targetCoordinates[1],
                t,
                travelType as any
            );
            return { q: res.q, r: res.r };
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
        if (travelAnimation) {
            const { startCoordinates, targetCoordinates, travelType } = travelAnimation;
            const res = getAxialWiggle(
                startCoordinates[0], startCoordinates[1],
                targetCoordinates[0], targetCoordinates[1],
                t,
                travelType as any
            );
            return { x: getX(res.q, res.r), y: getY(res.q, res.r) };
        }
        return { x: getX(cameraAxial.q, cameraAxial.r), y: getY(cameraAxial.q, cameraAxial.r) };
    };

    const playerPos = getMovingPlayerPos();

    // Calculate Infrastructure Segments (Curved) using Axial Math
    const getInfrastructurePaths = () => {
        const infrastructure: { d: string, type: 'Road' | 'Path' | 'Ancient' | 'Disappearing' }[] = [];

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

                // To ensure seamless paths, generate the entire path from a canonical "start" hex to "end" hex 
                // and only draw the first half depending on which hex we are processing.
                // Since getAxialWiggle internalizes canonical directions, we simply ask for t=0.0 to 0.5
                // which represents the segment from the center of THIS hex to the boundary of the neighbor.
                const STEPS = 8; // 8 segments per hex 'half', resulting in 16 total per connection
                const pathParts: string[] = [];

                for (let i = 0; i <= STEPS; i++) {
                    const stepT = 0.5 * (i / STEPS);
                    const res = getAxialWiggle(hex.q, hex.r, nQ, nR, stepT, type === 'Ancient' ? 'Ancient' : (type === 'Road' ? 'Road' : 'Path'));

                    // getAxialWiggle pX/pY gives raw screen space from hex 0,0. 
                    // We need to add panOffset for the SVG to render correctly relative to the viewport.
                    const pX = getX(res.q, res.r);
                    const pY = getY(res.q, res.r);

                    if (i === 0) {
                        pathParts.push(`M ${pX} ${pY}`);
                    } else {
                        pathParts.push(`L ${pX} ${pY}`);
                    }
                }

                infrastructure.push({
                    d: pathParts.join(' '),
                    type: type
                });
            });
        });

        return infrastructure;
    };

    // Calculate Trail Segments matching the wiggles
    const getTrailPaths = () => {
        const result = {
            head: '',
            fullTails: [] as string[],
            recentFadeTail: null as { pathD: string, grad: { x1: number, y1: number, x2: number, y2: number, stop1: number, stop2: number } } | null,
            olderFadeTail: null as { pathD: string, grad: { x1: number, y1: number, x2: number, y2: number, stop1: number, stop2: number } } | null
        };

        const getConnectionType = (hex: any, targetQ: number, targetR: number): 'Road' | 'Path' | 'Ancient' | 'Wilderness' => {
            if (!hex || !hex.connections) return 'Wilderness';
            const parts = hex.connections.split(',');
            for (const part of parts) {
                const [sideStr, typeCode, disco] = part.split(':');
                if (disco !== '1') continue;
                const side = parseInt(sideStr, 10);
                let nQ = hex.q; let nR = hex.r;
                switch (side) {
                    case 0: nR++; break;
                    case 1: nQ++; break;
                    case 2: nQ++; nR--; break;
                    case 3: nR--; break;
                    case 4: nQ--; break;
                    case 5: nQ--; nR++; break;
                }
                if (nQ === targetQ && nR === targetR) {
                    if (typeCode === 'R') return 'Road';
                    if (typeCode === 'A') return 'Ancient';
                    return 'Path';
                }
            }
            return 'Wilderness';
        };

        const buildFullSegment = (prev: [number, number], current: [number, number], tMode: string, animT: number = 0) => {
            const tailPath: string[] = [];
            const STEPS = 16;
            for (let i = 0; i <= STEPS; i++) {
                const stepT = 1.0 - (i / STEPS);
                const res = getAxialWiggle(prev[0], prev[1], current[0], current[1], stepT, tMode as any);
                const pX = getX(res.q, res.r);
                const pY = getY(res.q, res.r);
                if (i === 0) tailPath.push(`M ${pX} ${pY}`);
                else tailPath.push(`L ${pX} ${pY}`);
            }
            if (animT > 0) {
                const startPoint = getAxialWiggle(prev[0], prev[1], current[0], current[1], 1.0, tMode as any);
                const endPoint = getAxialWiggle(prev[0], prev[1], current[0], current[1], 0.0, tMode as any);
                return {
                    pathD: tailPath.join(' '),
                    grad: {
                        x1: getX(startPoint.q, startPoint.r),
                        y1: getY(startPoint.q, startPoint.r),
                        x2: getX(endPoint.q, endPoint.r),
                        y2: getY(endPoint.q, endPoint.r),
                        stop1: (1.0 - animT) * 100,
                        stop2: ((1.0 - animT) + 0.5) * 100
                    }
                };
            }
            return { pathD: tailPath.join(' '), grad: null };
        };

        const buildFadingSegment = (prev: [number, number], current: [number, number], tMode: string, animT: number = 0) => {
            const tailPath: string[] = [];
            const STEPS = 16;

            const minT = 0.5 + (0.5 * animT);

            if (minT > 0.99) return null;

            for (let i = 0; i <= STEPS; i++) {
                // Smoothly map i=0..STEPS onto stepT=1.0..minT
                const stepT = 1.0 - ((1.0 - minT) * (i / STEPS));

                const res = getAxialWiggle(prev[0], prev[1], current[0], current[1], stepT, tMode as any);
                const pX = getX(res.q, res.r);
                const pY = getY(res.q, res.r);
                if (i === 0) tailPath.push(`M ${pX} ${pY}`);
                else tailPath.push(`L ${pX} ${pY}`);
            }

            // The gradient slides up to minT to match the shrinking path.
            const startPoint = getAxialWiggle(prev[0], prev[1], current[0], current[1], 1.0, tMode as any);
            const MathEndPointT = Math.min(1.0, minT + 0.05);
            const endPoint = getAxialWiggle(prev[0], prev[1], current[0], current[1], MathEndPointT, tMode as any);

            return {
                pathD: tailPath.join(' '),
                grad: {
                    x1: getX(startPoint.q, startPoint.r),
                    y1: getY(startPoint.q, startPoint.r),
                    x2: getX(endPoint.q, endPoint.r),
                    y2: getY(endPoint.q, endPoint.r),
                    stop1: 0,
                    stop2: 100
                }
            };
        };

        if (travelAnimation) {
            const { startCoordinates, targetCoordinates, travelType } = travelAnimation;

            // 1. Head Segment (Growing): Anchor (Start) -> Player (Center)
            const STEPS = Math.max(2, Math.floor(t * 16));
            if (t > 0.01) {
                const headPath: string[] = [];
                for (let i = 0; i <= STEPS; i++) {
                    const stepT = i / STEPS * t;
                    const res = getAxialWiggle(
                        startCoordinates[0], startCoordinates[1],
                        targetCoordinates[0], targetCoordinates[1],
                        stepT, travelType as any
                    );
                    const pX = getX(res.q, res.r);
                    const pY = getY(res.q, res.r);
                    if (i === 0) headPath.push(`M ${pX} ${pY}`);
                    else headPath.push(`L ${pX} ${pY}`);
                }
                result.head = headPath.join(' ');
            }

            if (previousCoordinates) {
                // Full segment trailing the current start coordinates
                const startHex = hexes.find(h => h.q === startCoordinates[0] && h.r === startCoordinates[1]);
                const travelMode = startHex ? getConnectionType(startHex, previousCoordinates[0], previousCoordinates[1]) : 'Wilderness';
                const fullTailData = buildFullSegment(previousCoordinates, startCoordinates, travelMode, t);

                if (fullTailData.grad) {
                    result.recentFadeTail = fullTailData as any;
                } else {
                    result.fullTails.push(fullTailData.pathD);
                }

                if (previousPreviousCoordinates && t < 1.0) {
                    // Fading segment trailing behind that one (A back to Start)
                    const prevHex = hexes.find(h => h.q === previousCoordinates[0] && h.r === previousCoordinates[1]);
                    const olderTravelMode = prevHex ? getConnectionType(prevHex, previousPreviousCoordinates[0], previousPreviousCoordinates[1]) : 'Wilderness';
                    const fadedSeg = buildFadingSegment(previousPreviousCoordinates, previousCoordinates, olderTravelMode, t);

                    if (fadedSeg) {
                        result.olderFadeTail = fadedSeg;
                    }
                }
            }
        } else if (previousCoordinates) {
            const currentHex = hexes.find(h => h.isCurrent);
            if (currentHex) {
                const currentCoords: [number, number] = [currentHex.q, currentHex.r];
                const travelMode = getConnectionType(currentHex, previousCoordinates[0], previousCoordinates[1]);
                const fullTailData = buildFullSegment(previousCoordinates, currentCoords, travelMode, 0);
                result.fullTails.push(fullTailData.pathD);

                if (previousPreviousCoordinates) {
                    const prevHex = hexes.find(h => h.q === previousCoordinates[0] && h.r === previousCoordinates[1]);
                    const olderTravelMode = prevHex ? getConnectionType(prevHex, previousPreviousCoordinates[0], previousPreviousCoordinates[1]) : 'Wilderness';
                    const fadedSeg = buildFadingSegment(previousPreviousCoordinates, previousCoordinates, olderTravelMode, 0);
                    if (fadedSeg) {
                        result.olderFadeTail = fadedSeg;
                    }
                }
            }
        }

        return result;
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
                            {(() => {
                                const trailData = getTrailPaths();
                                return (
                                    <>
                                        {trailData.recentFadeTail && (
                                            <defs>
                                                <linearGradient id="recentFadeTailGrad" x1={trailData.recentFadeTail.grad.x1} y1={trailData.recentFadeTail.grad.y1} x2={trailData.recentFadeTail.grad.x2} y2={trailData.recentFadeTail.grad.y2} gradientUnits="userSpaceOnUse">
                                                    <stop offset={`${trailData.recentFadeTail.grad.stop1}%`} stopColor="#343d3dff" stopOpacity="0.8" />
                                                    <stop offset={`${trailData.recentFadeTail.grad.stop2}%`} stopColor="#343d3dff" stopOpacity="0" />
                                                </linearGradient>
                                            </defs>
                                        )}
                                        {trailData.recentFadeTail && (
                                            <path
                                                d={trailData.recentFadeTail.pathD}
                                                fill="none"
                                                stroke="url(#recentFadeTailGrad)"
                                                strokeWidth="4"
                                                strokeDasharray="8,6"
                                                strokeLinecap="round"
                                                style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.6))' }}
                                            />
                                        )}

                                        {trailData.olderFadeTail && (
                                            <defs>
                                                <linearGradient id="olderFadeTailGrad" x1={trailData.olderFadeTail.grad.x1} y1={trailData.olderFadeTail.grad.y1} x2={trailData.olderFadeTail.grad.x2} y2={trailData.olderFadeTail.grad.y2} gradientUnits="userSpaceOnUse">
                                                    <stop offset={`${trailData.olderFadeTail.grad.stop1}%`} stopColor="#343d3dff" stopOpacity="0.8" />
                                                    <stop offset={`${trailData.olderFadeTail.grad.stop2}%`} stopColor="#343d3dff" stopOpacity="0" />
                                                </linearGradient>
                                            </defs>
                                        )}
                                        {trailData.olderFadeTail && (
                                            <path
                                                d={trailData.olderFadeTail.pathD}
                                                fill="none"
                                                stroke="url(#olderFadeTailGrad)"
                                                strokeWidth="4"
                                                strokeDasharray="8,6"
                                                strokeLinecap="round"
                                                style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.6))' }}
                                            />
                                        )}

                                        {trailData.fullTails.map((tPath, idx) => (
                                            <path
                                                key={`fulltail-${idx}`}
                                                d={tPath}
                                                fill="none"
                                                stroke="#343d3dff"
                                                strokeWidth="4"
                                                strokeDasharray="8,6"
                                                strokeLinecap="round"
                                                opacity="0.8"
                                                style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.6))' }}
                                            />
                                        ))}
                                        {trailData.head && (
                                            <path
                                                d={trailData.head}
                                                fill="none"
                                                stroke="#343d3dff"
                                                strokeWidth="4"
                                                strokeDasharray="8,6"
                                                opacity="0.8"
                                                strokeLinecap="round"
                                                style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.6))' }}
                                            />
                                        )}
                                    </>
                                );
                            })()}
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
