import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './WorldMapPage.module.css';
import HexMapView from '../exploration/HexMapView';
import { useGameState } from '../../hooks/useGameState';
import { MapPin, Pickaxe, Leaf, Info } from 'lucide-react';
const WorldMapPage = () => {
    const { state } = useGameState();
    const [selectedHexId, setSelectedHexId] = useState(state?.location.hexId || null);
    const [zoomMultiplier, setZoomMultiplier] = useState(1);
    if (!state)
        return null;
    const hexData = Object.entries(state.worldMap.hexes).map(([id, hex]) => ({
        id,
        q: hex.coordinates[0],
        r: hex.coordinates[1],
        biome: hex.biome,
        isVisited: hex.visited,
        isCurrent: state.location.hexId === id,
        isDiscovered: hex.visited || hex.generated,
        name: hex.name,
        playerName: hex.playerName,
        namingSource: hex.namingSource,
        visualVariant: hex.visualVariant,
        resourceNodes: hex.resourceNodes,
        interest_points: hex.interest_points
    }));
    const selectedHex = selectedHexId ? state.worldMap.hexes[selectedHexId] : null;
    const handleZoomIn = () => setZoomMultiplier(m => Math.min(m + 0.2, 3));
    const handleZoomOut = () => setZoomMultiplier(m => Math.max(m - 0.2, 0.5));
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.mapArea, children: [_jsxs("div", { className: styles.zoomControls, children: [_jsx("button", { onClick: handleZoomIn, title: "Zoom In", children: "+" }), _jsx("button", { onClick: handleZoomOut, title: "Zoom Out", children: "-" }), _jsx("button", { onClick: () => setZoomMultiplier(1), title: "Reset Zoom", children: "1:1" })] }), _jsx(HexMapView, { hexes: hexData, onHexClick: setSelectedHexId, className: styles.largeMap, viewMode: "normal", selectedHexId: selectedHexId || undefined, zoomScale: zoomMultiplier })] }), _jsxs("div", { className: styles.detailsPanel, children: [_jsxs("h2", { className: styles.title, children: [_jsx(MapPin, { size: 20 }), selectedHexId || 'Unknown Territory'] }), selectedHex ? (_jsxs("div", { className: styles.detailsContent, children: [_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Name" }), _jsx("p", { className: styles.hexName, children: selectedHex.playerName ? (_jsx("span", { className: styles.playerName, children: selectedHex.playerName })) : (_jsx("span", { className: styles.engineName, children: selectedHex.name || 'Unnamed' })) })] }), _jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Biome" }), _jsx("p", { children: selectedHex.biome })] }), selectedHex.interest_points.length > 0 && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Points of Interest" }), _jsx("ul", { className: styles.poiList, children: selectedHex.interest_points.map((poi, i) => (_jsx("li", { children: poi.name }, i))) })] })), selectedHex.resourceNodes.length > 0 && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Known Resources" }), _jsx("ul", { className: styles.resourceList, children: selectedHex.resourceNodes.map((node, i) => (_jsxs("li", { className: styles.resourceItem, children: [node.resourceType === 'Ore' || node.resourceType === 'Gem' ? _jsx(Pickaxe, { size: 14 }) : _jsx(Leaf, { size: 14 }), node.resourceType, " (", node.quantityRemaining, " left)"] }, i))) })] })), _jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Description" }), _jsx("p", { className: styles.description, children: selectedHex.description })] })] })) : (_jsxs("div", { className: styles.emptyState, children: [_jsx(Info, { size: 40 }), _jsx("p", { children: "Select a region on the map to view detailed chronicles and resources." })] }))] })] }));
};
export default WorldMapPage;
