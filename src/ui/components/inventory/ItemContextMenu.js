import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import styles from './ItemContextMenu.module.css';
import { Info, Trash2, Search, Zap, ArrowUpCircle, Package } from 'lucide-react';
const ItemContextMenu = ({ x, y, onClose, onAction, itemName, isEquippable, isConsumable, customActions }) => {
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    // Prevent context menu from going off screen
    const adjustedX = Math.min(x, window.innerWidth - 160);
    const adjustedY = Math.min(y, window.innerHeight - 200);
    return (_jsxs("div", { ref: menuRef, className: styles.menu, style: { top: adjustedY, left: adjustedX }, onContextMenu: (e) => e.preventDefault(), children: [_jsx("div", { className: styles.itemName, children: itemName }), customActions ? (customActions.map(action => (_jsxs("button", { onClick: () => onAction(action.id), children: [_jsx(Package, { size: 14 }), " ", action.label] }, action.id)))) : (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => onAction('info'), children: [_jsx(Info, { size: 14 }), " Information"] }), isEquippable && (_jsxs("button", { onClick: () => onAction('equip'), children: [_jsx(ArrowUpCircle, { size: 14 }), " Equip / Unequip"] })), isConsumable && (_jsxs("button", { onClick: () => onAction('use'), children: [_jsx(Zap, { size: 14 }), " Use"] })), _jsxs("button", { onClick: () => onAction('examine'), className: styles.disabled, title: "Requires further investigation...", children: [_jsx(Search, { size: 14 }), " Examine"] }), _jsx("div", { className: styles.divider }), _jsxs("button", { onClick: () => onAction('drop'), className: styles.dropButton, children: [_jsx(Trash2, { size: 14 }), " Drop"] })] }))] }));
};
export default ItemContextMenu;
