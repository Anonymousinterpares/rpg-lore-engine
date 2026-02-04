import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import styles from './RightPanel.module.css';
import { MessageSquare, Map as MapIcon, Target } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import HexMapView from '../exploration/HexMapView';
import QuestList from '../exploration/QuestList';
const RightPanel = ({ className, onWorldMap, onQuests }) => {
    const { state, updateState } = useGameState();
    const [viewMode, setViewMode] = React.useState('normal');
    if (!state)
        return null;
    const toggleViewMode = () => {
        if (viewMode === 'normal')
            setViewMode('zoomed-in');
        else if (viewMode === 'zoomed-in')
            setViewMode('zoomed-out');
        else
            setViewMode('normal');
    };
    // Map state.worldMap.hexes to HexMapView format
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
    // Filter based on viewMode
    const currentHex = state.worldMap.hexes[state.location.hexId];
    const filteredHexes = hexData.filter(hex => {
        if (viewMode === 'zoomed-in')
            return hex.isCurrent;
        const radius = viewMode === 'normal' ? 3 : 10;
        if (!currentHex)
            return hex.isDiscovered;
        // Simple cube/axial distance calculation
        const dq = hex.q - currentHex.coordinates[0];
        const dr = hex.r - currentHex.coordinates[1];
        const distance = (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
        return distance <= radius && hex.isDiscovered;
    });
    // Format history for display
    const visibleHistory = state.conversationHistory.slice(-30);
    return (_jsxs("aside", { className: `${styles.rightPanel} ${className}`, children: [_jsxs("div", { className: styles.section, children: [_jsxs("h3", { className: styles.mapHeader, onClick: onWorldMap, style: { cursor: 'pointer' }, children: [_jsxs("div", { className: styles.headerLeft, children: [_jsx(MapIcon, { size: 16 }), "World Map"] }), _jsxs("div", { className: styles.viewToggleGroup, children: [_jsx("span", { className: styles.toggleLabel, children: "Map view:" }), _jsx("button", { className: styles.viewToggle, onClick: (e) => {
                                            e.stopPropagation();
                                            toggleViewMode();
                                        }, children: viewMode.replace('-', ' ') })] })] }), _jsx("div", { className: styles.mapContainer, children: _jsx(HexMapView, { hexes: filteredHexes, viewMode: viewMode, isDraggable: false }) })] }), _jsxs("div", { className: `${styles.section} ${styles.questSection}`, children: [_jsxs("h3", { onClick: onQuests, style: { cursor: 'pointer' }, children: [_jsx(Target, { size: 16 }), "Current Quests"] }), _jsx(QuestList, { quests: state.activeQuests })] }), _jsxs("div", { className: styles.chatSection, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx(MessageSquare, { size: 16 }), _jsx("h2", { children: "Narrative & Events" })] }), _jsx("div", { className: styles.log, children: visibleHistory.length === 0 ? (_jsx("div", { className: styles.systemText, children: "No logs recorded yet." })) : (visibleHistory.map((turn, i) => (_jsxs("div", { className: turn.role === 'narrator' ? styles.narratorText :
                                turn.role === 'user' ? styles.userText :
                                    styles.systemText, children: [_jsxs("span", { className: styles.timestamp, children: ["[", turn.turnNumber, "]"] }), _jsxs("strong", { children: [turn.role.toUpperCase(), ": "] }), turn.content] }, i)))) })] })] }));
};
export default RightPanel;
