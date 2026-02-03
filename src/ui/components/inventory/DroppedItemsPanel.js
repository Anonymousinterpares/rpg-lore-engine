import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './DroppedItemsPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, X, CheckSquare, Square } from 'lucide-react';
import ItemContextMenu from './ItemContextMenu';
import ItemDatasheet from './ItemDatasheet';
import { DataManager } from '../../../ruleset/data/DataManager';
const DroppedItemsPanel = ({ items, onClose, onPickup, onAction }) => {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastClickedId, setLastClickedId] = useState(null);
    const [multiSelectActive, setMultiSelectActive] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [datasheetItem, setDatasheetItem] = useState(null);
    const getItemIcon = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('weapon'))
            return _jsx(Sword, { size: 20 });
        if (t.includes('armor') || t.includes('shield'))
            return _jsx(Shield, { size: 20 });
        if (t.includes('potion'))
            return _jsx(FlaskConical, { size: 20 });
        if (t.includes('scroll'))
            return _jsx(Scroll, { size: 20 });
        return _jsx(Package, { size: 20 });
    };
    const handleItemClick = (e, item) => {
        const id = item.instanceId || item.id;
        if (!multiSelectActive && !e.shiftKey) {
            setSelectedIds(new Set([id]));
            setLastClickedId(id);
            return;
        }
        const newSelected = new Set(selectedIds);
        if (e.shiftKey && lastClickedId && items.length > 0) {
            const currentIndex = items.findIndex(i => (i.instanceId || i.id) === id);
            const lastIndex = items.findIndex(i => (i.instanceId || i.id) === lastClickedId);
            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                for (let i = start; i <= end; i++) {
                    const itemId = items[i].instanceId || items[i].id;
                    newSelected.add(itemId);
                }
            }
        }
        else {
            if (newSelected.has(id)) {
                newSelected.delete(id);
            }
            else {
                newSelected.add(id);
            }
        }
        setSelectedIds(newSelected);
        setLastClickedId(id);
    };
    const handleContextMenu = (e, item) => {
        const id = item.instanceId || item.id;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
        // Auto-select on right click if not already part of selection
        if (!selectedIds.has(id)) {
            setSelectedIds(new Set([id]));
        }
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
        else if (action === 'pickup') {
            onPickup([item]);
        }
        else if (onAction) {
            onAction(action, item);
        }
    };
    const handleBatchPickup = () => {
        const selectedItems = items.filter(i => selectedIds.has(i.instanceId || i.id));
        if (selectedItems.length > 0) {
            onPickup(selectedItems);
            setSelectedIds(new Set());
        }
    };
    return (_jsxs("div", { className: styles.overlay, onClick: onClose, children: [_jsxs("div", { className: `${styles.panel} ${parchmentStyles.panel}`, onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: styles.header, children: [_jsx("h3", { className: parchmentStyles.heading, children: "Items at Location" }), _jsx("button", { className: styles.closeBtn, onClick: onClose, children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: styles.grid, onDragOver: (e) => e.preventDefault(), onDrop: (e) => {
                            const data = e.dataTransfer.getData('item');
                            const source = e.dataTransfer.getData('source');
                            if (data && source === 'inventory') {
                                const item = JSON.parse(data);
                                onAction?.('drop', item);
                            }
                        }, children: [items.map((item) => {
                                const id = item.instanceId || item.id;
                                return (_jsxs("div", { className: `${styles.itemSlot} ${selectedIds.has(id) ? styles.selected : ''}`, onClick: (e) => handleItemClick(e, item), onContextMenu: (e) => handleContextMenu(e, item), title: `${item.name} (${item.weight} lb)`, draggable: true, onDragStart: (e) => {
                                        e.dataTransfer.setData('item', JSON.stringify(item));
                                        e.dataTransfer.setData('source', 'ground');
                                    }, children: [_jsx("div", { className: styles.iconWrapper, children: getItemIcon(item.type) }), item.quantity > 1 && _jsx("span", { className: styles.quantity, children: item.quantity }), selectedIds.has(id) && _jsx("div", { className: styles.checkMark, children: _jsx(CheckSquare, { size: 10 }) })] }, id));
                            }), items.length === 0 && _jsx("div", { className: styles.emptyText, children: "No items on the ground." })] }), _jsxs("div", { className: styles.footer, children: [_jsxs("div", { className: styles.multiSelectToggle, onClick: () => setMultiSelectActive(!multiSelectActive), children: [multiSelectActive ? _jsx(CheckSquare, { size: 16 }) : _jsx(Square, { size: 16 }), _jsx("span", { children: "Select Multiple" })] }), _jsxs("button", { className: styles.pickupBtn, disabled: selectedIds.size === 0, onClick: handleBatchPickup, children: ["Pick Up ", selectedIds.size > 0 ? `(${selectedIds.size})` : ''] })] })] }), contextMenu && (_jsx(ItemContextMenu, { x: contextMenu.x, y: contextMenu.y, itemName: contextMenu.item.name, isEquippable: false, onClose: () => setContextMenu(null), onAction: handleAction, 
                // Custom actions for ground
                customActions: [
                    { id: 'pickup', label: 'Pick Up', icon: 'Package' },
                    { id: 'info', label: 'Information', icon: 'Info' }
                ] })), datasheetItem && (_jsx(ItemDatasheet, { item: datasheetItem, onClose: () => setDatasheetItem(null) }))] }));
};
export default DroppedItemsPanel;
