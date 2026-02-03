import { jsx as _jsx } from "react/jsx-runtime";
import styles from './HexMapView.module.css';
const HexMapView = ({ hexes, onHexClick, className = '' }) => {
    // Simple axial to pixel conversion
    const size = 30;
    const getX = (q, r) => size * (3 / 2 * q);
    const getY = (q, r) => size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return (_jsx("div", { className: `${styles.container} ${className}`, children: _jsx("div", { className: styles.grid, children: hexes.map((hex) => (_jsx("div", { className: `${styles.hex} ${styles[hex.biome.toLowerCase()] || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''}`, style: {
                    left: `calc(50% + ${getX(hex.q, hex.r)}px)`,
                    top: `calc(50% + ${getY(hex.q, hex.r)}px)`,
                    width: `${size * 2}px`,
                    height: `${size * 2}px`,
                }, onClick: () => onHexClick?.(hex.id), children: _jsx("div", { className: styles.hexInner, children: hex.isCurrent && _jsx("div", { className: styles.playerMarker }) }) }, hex.id))) }) }));
};
export default HexMapView;
