import React from 'react';
import styles from './HexMapView.module.css';

interface HexData {
    id: string;
    q: number;
    r: number;
    biome: string;
    isVisited: boolean;
    isCurrent: boolean;
    isDiscovered: boolean;
}

interface HexMapViewProps {
    hexes: HexData[];
    onHexClick?: (id: string) => void;
    className?: string;
}

const HexMapView: React.FC<HexMapViewProps> = ({ hexes, onHexClick, className = '' }) => {
    // Simple axial to pixel conversion
    const size = 30;
    const getX = (q: number, r: number) => size * (3 / 2 * q);
    const getY = (q: number, r: number) => size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);

    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.grid}>
                {hexes.map((hex) => (
                    <div
                        key={hex.id}
                        className={`${styles.hex} ${styles[hex.biome.toLowerCase()] || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''}`}
                        style={{
                            left: `calc(50% + ${getX(hex.q, hex.r)}px)`,
                            top: `calc(50% + ${getY(hex.q, hex.r)}px)`,
                            width: `${size * 2}px`,
                            height: `${size * 2}px`,
                        }}
                        onClick={() => onHexClick?.(hex.id)}
                    >
                        <div className={styles.hexInner}>
                            {hex.isCurrent && <div className={styles.playerMarker} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HexMapView;
