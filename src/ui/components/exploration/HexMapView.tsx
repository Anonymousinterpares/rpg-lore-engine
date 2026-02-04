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
    const size = 30;
    const currentHex = hexes.find(h => h.isCurrent);

    // Offset everything so current hex is at (0,0) effectively for the grid container
    const centerQ = currentHex ? currentHex.q : 0;
    const centerR = currentHex ? currentHex.r : 0;

    const getX = (q: number, r: number) => size * (3 / 2 * (q - centerQ));
    const getY = (q: number, r: number) => size * (Math.sqrt(3) / 2 * (q - centerQ) + Math.sqrt(3) * (r - centerR));

    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.grid}>
                {hexes.filter(h => h.isDiscovered).map((hex) => (
                    <div
                        key={hex.id}
                        className={`${styles.hex} ${styles[hex.biome.toLowerCase()] || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''}`}
                        title={`${hex.biome} (${hex.q}, ${hex.r})`}
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
