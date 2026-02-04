import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './HexMapView.module.css';
const HexMapView = ({ hexes, onHexClick, className = '' }) => {
    const size = 30;
    const currentHex = hexes.find(h => h.isCurrent);
    // Offset everything so current hex is at (0,0) effectively for the grid container
    const centerQ = currentHex ? currentHex.q : 0;
    const centerR = currentHex ? currentHex.r : 0;
    const getX = (q, r) => size * (3 / 2 * (q - centerQ));
    const getY = (q, r) => size * (Math.sqrt(3) / 2 * (q - centerQ) + Math.sqrt(3) * (r - centerR));
    return (_jsx("div", { className: `${styles.container} ${className}`, children: _jsxs("div", { className: styles.grid, children: [hexes.filter(h => h.isDiscovered).map((hex) => (_jsx("div", { className: `${styles.hex} ${styles[hex.biome.toLowerCase()] || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''}`, title: `${hex.biome} (${hex.q}, ${hex.r})`, style: {
                        left: `calc(50% + ${getX(hex.q, hex.r)}px)`,
                        top: `calc(50% + ${getY(hex.q, hex.r)}px)`,
                        width: `${size * 2}px`,
                        height: `${size * 2}px`,
                    }, onClick: () => onHexClick?.(hex.id), children: _jsx("div", { className: styles.hexInner, children: hex.isCurrent && _jsx("div", { className: styles.playerMarker }) }) }, hex.id))), hexes.length === 0 && (_jsx("div", { className: styles.emptyMap, children: "Exploring the unknown..." }))] }) }));
};
export default HexMapView;
