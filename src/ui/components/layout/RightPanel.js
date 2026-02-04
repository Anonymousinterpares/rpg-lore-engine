import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './RightPanel.module.css';
import { MessageSquare, Map as MapIcon, Target } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
import HexMapView from '../exploration/HexMapView';
import QuestList from '../exploration/QuestList';
const RightPanel = ({ className }) => {
    const { state } = useGameState();
    if (!state)
        return null;
    // Map state.worldMap.hexes to HexMapView format
    const hexData = Object.entries(state.worldMap.hexes).map(([id, hex]) => ({
        id,
        q: hex.coordinates[0],
        r: hex.coordinates[1],
        biome: hex.biome,
        isVisited: hex.visited,
        isCurrent: state.location.hexId === id,
        isDiscovered: hex.visited || hex.generated
    }));
    // Format history for display
    const visibleHistory = state.conversationHistory.slice(-30);
    return (_jsxs("aside", { className: `${styles.rightPanel} ${className}`, children: [_jsxs("div", { className: styles.section, children: [_jsxs("h3", { children: [_jsx(MapIcon, { size: 16 }), "World Map"] }), _jsx("div", { className: styles.mapContainer, children: _jsx(HexMapView, { hexes: hexData }) })] }), _jsxs("div", { className: `${styles.section} ${styles.questSection}`, children: [_jsxs("h3", { children: [_jsx(Target, { size: 16 }), "Current Quests"] }), _jsx(QuestList, { quests: state.activeQuests })] }), _jsxs("div", { className: styles.chatSection, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx(MessageSquare, { size: 16 }), _jsx("h2", { children: "Narrative & Events" })] }), _jsx("div", { className: styles.log, children: visibleHistory.length === 0 ? (_jsx("div", { className: styles.systemText, children: "No logs recorded yet." })) : (visibleHistory.map((turn, i) => (_jsxs("div", { className: turn.role === 'narrator' ? styles.narratorText :
                                turn.role === 'user' ? styles.userText :
                                    styles.systemText, children: [_jsxs("span", { className: styles.timestamp, children: ["[", turn.turnNumber, "]"] }), _jsxs("strong", { children: [turn.role.toUpperCase(), ": "] }), turn.content] }, i)))) })] })] }));
};
export default RightPanel;
