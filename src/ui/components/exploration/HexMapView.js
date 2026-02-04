import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import styles from './HexMapView.module.css';
import { Pickaxe, Leaf, MapPin } from 'lucide-react';
const HexMapView = ({ hexes, onHexClick, onHexContextMenu, className = '', viewMode = 'normal', selectedHexId, zoomScale = 1, isDraggable = true }) => {
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
    const getX = (q, r) => {
        const offset = isDraggable ? panOffset.x : 0;
        return size * (3 / 2 * (q - centerQ)) + offset;
    };
    const getY = (q, r) => {
        const offset = isDraggable ? panOffset.y : 0;
        return size * (Math.sqrt(3) / 2 * (q - centerQ) + Math.sqrt(3) * (r - centerR)) + offset;
    };
    const handleMouseDown = (e) => {
        if (!isDraggable)
            return;
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseMove = (e) => {
        if (!isDragging || !isDraggable)
            return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => {
        setIsDragging(false);
    };
    return (_jsx("div", { className: `${styles.container} ${className} ${isDragging ? styles.dragging : ''}`, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, children: _jsxs("div", { className: styles.grid, children: [hexes.map((hex) => {
                    const biomeBase = hex.biome.toLowerCase();
                    const variantClass = hex.visualVariant ? styles[`${biomeBase}_${hex.visualVariant}`] : styles[biomeBase];
                    const tooltip = hex.playerName
                        ? `${hex.playerName} (${hex.name})`
                        : (hex.name || `${hex.biome} (${hex.q}, ${hex.r})`);
                    const isZoomedIn = viewMode === 'zoomed-in';
                    const isSelected = selectedHexId === hex.id;
                    return (_jsx("div", { className: `${styles.hex} ${variantClass || styles.plains} ${hex.isVisited ? styles.visited : styles.unvisited} ${hex.isCurrent ? styles.current : ''} ${isSelected ? styles.selected : ''}`, title: tooltip, style: {
                            left: `calc(50% + ${getX(hex.q, hex.r)}px)`,
                            top: `calc(50% + ${getY(hex.q, hex.r)}px)`,
                            width: `${size * 2}px`,
                            height: `${size * 2}px`,
                            transform: 'translate(-50%, -50%)'
                        }, onClick: (e) => {
                            e.stopPropagation();
                            onHexClick?.(hex.id);
                        }, onContextMenu: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onHexContextMenu?.(hex.id, e.clientX, e.clientY);
                        }, children: _jsxs("div", { className: styles.hexInner, children: [hex.isCurrent && _jsx("div", { className: styles.playerMarker }), isZoomedIn && (_jsxs("div", { className: styles.details, children: [hex.resourceNodes?.map((node, i) => (_jsx("div", { className: styles.detailIcon, title: node.resourceType, children: node.resourceType === 'Ore' || node.resourceType === 'Gem' ? _jsx(Pickaxe, { size: 12 }) : _jsx(Leaf, { size: 12 }) }, `res-${i}`))), hex.interest_points?.map((poi, i) => (_jsx("div", { className: styles.detailIcon, title: poi.name, children: _jsx(MapPin, { size: 12 }) }, `poi-${i}`)))] }))] }) }, hex.id));
                }), hexes.length === 0 && (_jsx("div", { className: styles.emptyMap, children: "Exploring the unknown..." }))] }) }));
};
export default HexMapView;
