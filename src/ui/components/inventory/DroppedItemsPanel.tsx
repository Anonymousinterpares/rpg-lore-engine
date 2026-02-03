import React, { useState, useEffect } from 'react';
import styles from './DroppedItemsPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, X, CheckSquare, Square } from 'lucide-react';
import ItemContextMenu from './ItemContextMenu';
import ItemDatasheet from './ItemDatasheet';
import { DataManager } from '../../../ruleset/data/DataManager';

interface Item {
    id: string;
    name: string;
    type: string;
    quantity: number;
    weight: number;
    instanceId?: string;
}

interface DroppedItemsPanelProps {
    items: Item[];
    onClose: () => void;
    onPickup: (items: Item[]) => void;
    onAction?: (action: string, item: Item) => void;
}

const DroppedItemsPanel: React.FC<DroppedItemsPanelProps> = ({
    items,
    onClose,
    onPickup,
    onAction
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [multiSelectActive, setMultiSelectActive] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Item } | null>(null);
    const [datasheetItem, setDatasheetItem] = useState<any>(null);

    const getItemIcon = (type: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('weapon')) return <Sword size={20} />;
        if (t.includes('armor') || t.includes('shield')) return <Shield size={20} />;
        if (t.includes('potion')) return <FlaskConical size={20} />;
        if (t.includes('scroll')) return <Scroll size={20} />;
        return <Package size={20} />;
    };

    const handleItemClick = (e: React.MouseEvent, item: Item) => {
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
        } else {
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
        }

        setSelectedIds(newSelected);
        setLastClickedId(id);
    };

    const handleContextMenu = (e: React.MouseEvent, item: Item) => {
        const id = item.instanceId || item.id;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
        // Auto-select on right click if not already part of selection
        if (!selectedIds.has(id)) {
            setSelectedIds(new Set([id]));
        }
    };

    const handleAction = (action: string) => {
        if (!contextMenu) return;
        const item = contextMenu.item;
        setContextMenu(null);

        if (action === 'info') {
            const fullData = DataManager.getItem(item.id);
            setDatasheetItem({ ...fullData, ...item });
        } else if (action === 'pickup') {
            onPickup([item]);
        } else if (onAction) {
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

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.panel} ${parchmentStyles.panel}`} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={parchmentStyles.heading}>Items at Location</h3>
                    <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
                </div>

                <div
                    className={styles.grid}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        const data = e.dataTransfer.getData('item');
                        const source = e.dataTransfer.getData('source');
                        if (data && source === 'inventory') {
                            const item = JSON.parse(data);
                            onAction?.('drop', item);
                        }
                    }}
                >
                    {items.map((item) => {
                        const id = item.instanceId || item.id;
                        return (
                            <div
                                key={id}
                                className={`${styles.itemSlot} ${selectedIds.has(id) ? styles.selected : ''}`}
                                onClick={(e) => handleItemClick(e, item)}
                                onContextMenu={(e) => handleContextMenu(e, item)}
                                title={`${item.name} (${item.weight} lb)`}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('item', JSON.stringify(item));
                                    e.dataTransfer.setData('source', 'ground');
                                }}
                            >
                                <div className={styles.iconWrapper}>
                                    {getItemIcon(item.type)}
                                </div>
                                {item.quantity > 1 && <span className={styles.quantity}>{item.quantity}</span>}
                                {selectedIds.has(id) && <div className={styles.checkMark}><CheckSquare size={10} /></div>}
                            </div>
                        );
                    })}
                    {items.length === 0 && <div className={styles.emptyText}>No items on the ground.</div>}
                </div>

                <div className={styles.footer}>
                    <div
                        className={styles.multiSelectToggle}
                        onClick={() => setMultiSelectActive(!multiSelectActive)}
                    >
                        {multiSelectActive ? <CheckSquare size={16} /> : <Square size={16} />}
                        <span>Select Multiple</span>
                    </div>

                    <button
                        className={styles.pickupBtn}
                        disabled={selectedIds.size === 0}
                        onClick={handleBatchPickup}
                    >
                        Pick Up {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                    </button>
                </div>
            </div>

            {contextMenu && (
                <ItemContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemName={contextMenu.item.name}
                    isEquippable={false} // Can't equip from ground directly usually
                    onClose={() => setContextMenu(null)}
                    onAction={handleAction}
                    // Custom actions for ground
                    customActions={[
                        { id: 'pickup', label: 'Pick Up', icon: 'Package' },
                        { id: 'info', label: 'Information', icon: 'Info' }
                    ]}
                />
            )}

            {datasheetItem && (
                <ItemDatasheet
                    item={datasheetItem}
                    onClose={() => setDatasheetItem(null)}
                />
            )}
        </div>
    );
};

export default DroppedItemsPanel;
