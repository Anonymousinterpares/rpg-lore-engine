import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './InventoryGrid.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, Coins } from 'lucide-react';
import ItemContextMenu from './ItemContextMenu';
import ItemDatasheet from './ItemDatasheet';
import { DataManager } from '../../../ruleset/data/DataManager';
import DroppedItemsPanel from './DroppedItemsPanel';
const InventoryGrid = ({ items, gold, capacity, droppedItems = [], maxSlots = 20, onItemClick, onItemAction, className = '' }) => {
    const [contextMenu, setContextMenu] = useState(null);
    const [datasheetItem, setDatasheetItem] = useState(null);
    const [showDropped, setShowDropped] = useState(false);
    const totalWeight = items.reduce((sum, item) => sum + (item.weight * (item.quantity || 1)), 0);
    const isOverweight = totalWeight > capacity;
    const hasDroppedItems = (droppedItems || []).length > 0;
    const getItemIcon = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('weapon'))
            return _jsx(Sword, { size: 18 });
        if (t.includes('armor') || t.includes('shield'))
            return _jsx(Shield, { size: 18 });
        if (t.includes('potion'))
            return _jsx(FlaskConical, { size: 18 });
        if (t.includes('scroll'))
            return _jsx(Scroll, { size: 18 });
        return _jsx(Package, { size: 18 });
    };
    const handleContextMenu = (e, item) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };
    const handleAction = (action) => {
        if (!contextMenu)
            return;
        const item = contextMenu.item;
        setContextMenu(null);
        if (action === 'info') {
            const fullData = DataManager.getItem(item.id);
            setDatasheetItem({ ...fullData, ...item });
        }
        else if (onItemAction) {
            onItemAction(action, item);
        }
    };
    return (_jsxs("div", { className: `${styles.container} ${parchmentStyles.panel} ${className}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.titleRow, children: [_jsx("h3", { className: parchmentStyles.heading, style: { margin: 0 }, children: "Inventory" }), _jsxs("div", { className: styles.gold, children: [_jsx(Coins, { size: 14, className: styles.goldIcon }), _jsxs("span", { children: [gold.gp, "g ", gold.sp, "s ", gold.cp, "c"] })] })] }), _jsxs("div", { className: styles.itemStats, children: [_jsxs("div", { className: isOverweight ? styles.weightOver : '', children: ["Wgt: ", totalWeight.toFixed(1), " / ", capacity, " lb"] }), _jsxs("div", { children: ["Slots: ", items.length, " / ", maxSlots] })] })] }), _jsxs("div", { className: styles.grid, onDragOver: (e) => e.preventDefault(), onDrop: (e) => {
                    const data = e.dataTransfer.getData('item');
                    const source = e.dataTransfer.getData('source');
                    if (data && source === 'ground') {
                        const item = JSON.parse(data);
                        onItemAction?.('pickup', item);
                    }
                }, children: [items.map((item) => (_jsxs("div", { className: `${styles.itemSlot} ${item.equipped ? styles.equipped : ''}`, onClick: () => onItemClick?.(item), onContextMenu: (e) => handleContextMenu(e, item), title: `${item.name} (${item.type})`, draggable: true, onDragStart: (e) => {
                            e.dataTransfer.setData('item', JSON.stringify(item));
                            e.dataTransfer.setData('source', 'inventory');
                        }, children: [_jsx("div", { className: styles.iconWrapper, children: getItemIcon(item.type) }), item.quantity > 1 && _jsx("span", { className: styles.quantity, children: item.quantity }), item.equipped && _jsx("div", { className: styles.equippedBadge, children: "E" })] }, item.instanceId || item.id))), [...Array(Math.max(0, maxSlots - items.length))].map((_, i) => (_jsx("div", { className: styles.emptySlot }, `empty-${i}`)))] }), _jsxs("button", { className: `${styles.droppedItemsBtn} ${hasDroppedItems ? styles.hasItems : ''}`, onClick: () => hasDroppedItems && setShowDropped(!showDropped), title: hasDroppedItems ? "View items at current location" : "No items on the ground", children: [_jsx(Package, { size: 14 }), hasDroppedItems ? `Dropped Items (${droppedItems?.length})` : 'No items nearby'] }), showDropped && hasDroppedItems && (_jsx(DroppedItemsPanel, { items: droppedItems, onClose: () => setShowDropped(false), onPickup: (itemsToPick) => {
                    itemsToPick.forEach((item) => onItemAction?.('pickup', item));
                    if (droppedItems.length <= itemsToPick.length)
                        setShowDropped(false);
                }, onAction: onItemAction })), contextMenu && (_jsx(ItemContextMenu, { x: contextMenu.x, y: contextMenu.y, itemName: contextMenu.item.name, isEquippable: ['weapon', 'armor', 'shield'].some(t => contextMenu.item.type.toLowerCase().includes(t)), onClose: () => setContextMenu(null), onAction: handleAction })), datasheetItem && (_jsx(ItemDatasheet, { item: datasheetItem, onClose: () => setDatasheetItem(null) }))] }));
};
export default InventoryGrid;
