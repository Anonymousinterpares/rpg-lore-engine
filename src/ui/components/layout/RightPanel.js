import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import glassStyles from '../../styles/glass.module.css';
import styles from './RightPanel.module.css';
import terminalStyles from '../../styles/terminal.module.css';
import { Map as MapIcon, MessageSquare } from 'lucide-react';
const RightPanel = ({ className }) => {
    return (_jsxs("aside", { className: `${styles.container} ${className}`, children: [_jsxs("div", { className: `${glassStyles.panel} ${styles.mapSection}`, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx(MapIcon, { size: 18 }), _jsx("h2", { children: "Hex Map" })] }), _jsx("div", { className: styles.mapPlaceholder, children: "Map Simulation Placeholder" })] }), _jsxs("div", { className: `${terminalStyles.panel} ${styles.chatSection}`, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx(MessageSquare, { size: 18 }), _jsx("h2", { children: "Combat & Chat" })] }), _jsxs("div", { className: styles.log, children: [_jsx("div", { className: terminalStyles.system, children: "[System] Welcome to the session." }), _jsx("div", { className: terminalStyles.system, children: "[System] Game state loaded successfully." }), _jsxs("div", { className: terminalStyles.text, children: [_jsx("span", { className: styles.timestamp, children: "12:45" }), " [Narrator] Roll for initiative!"] }), _jsxs("div", { className: terminalStyles.text, children: [_jsx("span", { className: styles.timestamp, children: "12:46" }), " [Player] I draw my sword."] })] })] })] }));
};
export default RightPanel;
