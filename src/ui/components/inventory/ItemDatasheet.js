import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import styles from './ItemDatasheet.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Weight, Coins, Shield, Sword } from 'lucide-react';
import ReactDOM from 'react-dom';
import { useGameState } from '../../hooks/useGameState';
const ItemDatasheet = ({ item, onClose }) => {
    const { engine, updateState } = useGameState();
    React.useEffect(() => {
        if (engine) {
            engine.trackTutorialEvent(`examined_item:${item.name}`);
            updateState();
        }
    }, [engine, item.name, updateState]);
    // Render into portal to document.body to avoid stacking issues
    return ReactDOM.createPortal(_jsx("div", { className: styles.overlay, onClick: onClose, children: _jsxs("div", { className: `${styles.sheet} ${parchmentStyles.panel}`, onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) }), _jsxs("div", { className: styles.header, children: [_jsx("h2", { className: styles.name, children: item.name }), _jsx("div", { className: styles.type, children: item.type })] }), _jsxs("div", { className: styles.infoGrid, children: [_jsxs("div", { className: styles.infoItem, children: [_jsx(Weight, { size: 14 }), _jsxs("span", { children: [item.weight, " lb"] })] }), item.cost && (_jsxs("div", { className: styles.infoItem, children: [_jsx(Coins, { size: 14 }), _jsxs("span", { children: [item.cost.gp > 0 && `${item.cost.gp}gp `, item.cost.sp > 0 && `${item.cost.sp}sp `, item.cost.cp > 0 && `${item.cost.cp}cp `] })] }))] }), _jsxs("div", { className: styles.content, children: [(item.damage || item.ac !== undefined) && (_jsxs("div", { className: styles.statsSection, children: [item.damage && (_jsxs("div", { className: styles.statLine, children: [_jsx(Sword, { size: 14 }), _jsx("strong", { children: "Damage:" }), " ", item.damage] })), item.ac !== undefined && (_jsxs("div", { className: styles.statLine, children: [_jsx(Shield, { size: 14 }), _jsx("strong", { children: "AC Bonus:" }), " +", item.ac] }))] })), item.properties && item.properties.length > 0 && (_jsx("div", { className: styles.properties, children: item.properties.map(p => (_jsx("span", { className: styles.propertyBadge, children: p }, p))) })), _jsx("div", { className: styles.divider }), _jsx("div", { className: styles.description, children: item.description || "No description available." })] }), _jsx("div", { className: styles.footer, children: "Right-click for more actions" })] }) }), document.body);
};
export default ItemDatasheet;
