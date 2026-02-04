import React, { useState } from 'react';
import styles from './InventoryGrid.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, Coins, ChevronDown } from 'lucide-react';
import ItemContextMenu from './ItemContextMenu';
import ItemDatasheet from './ItemDatasheet';
import { DataManager } from '../../../ruleset/data/DataManager';
import DroppedItemsPanel from './DroppedItemsPanel';

interface Item {
    id: string;
    name: string;
    type: string;
    quantity: number;
    weight: number;
    equipped?: boolean;
    instanceId?: string;
}

interface InventoryGridProps {
    items: Item[];
    gold: { gp: number, sp: number, cp: number };
    capacity: number;
    droppedItems?: Item[];
    maxSlots?: number;
    onItemClick?: (item: Item) => void;
    onItemAction?: (action: string, item: Item) => void;
    className?: string;
}

const InventoryGrid: React.FC<InventoryGridProps> = ({
    items,
    gold,
    capacity,
    droppedItems = [],
    maxSlots = 20,
    onItemClick,
    onItemAction,
    className = ''
}) => {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Item } | null>(null);
    const [datasheetItem, setDatasheetItem] = useState<any>(null);
    const [showDropped, setShowDropped] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const totalWeight = items.reduce((sum, item) => sum + (item.weight * (item.quantity || 1)), 0);
    const isOverweight = totalWeight > capacity;
    const hasDroppedItems = (droppedItems || []).length > 0;

    const getItemIcon = (type: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('weapon')) return <Sword size={18} />;
        if (t.includes('armor') || t.includes('shield')) return <Shield size={18} />;
        if (t.includes('potion')) return <FlaskConical size={18} />;
        if (t.includes('scroll')) return <Scroll size={18} />;
        return <Package size={18} />;
    };

    const handleContextMenu = (e: React.MouseEvent, item: Item) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    const handleAction = (action: string) => {
        if (!contextMenu) return;
        const item = contextMenu.item;
        setContextMenu(null);

        if (action === 'info') {
            const fullData = DataManager.getItem(item.id);
            setDatasheetItem({ ...fullData, ...item });
        } else if (onItemAction) {
            onItemAction(action, item);
        }
    };

    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            className={`${styles.toggleBtn} ${isCollapsed ? '' : styles.rotated}`}
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            title={isCollapsed ? "Expand Inventory" : "Collapse Inventory"}
                        >
                            <ChevronDown size={18} />
                        </button>
                        <h3 className={parchmentStyles.heading} style={{ margin: 0 }}>Inventory</h3>
                    </div>
                    <div className={styles.gold}>
                        <Coins size={14} className={styles.goldIcon} />
                        <span>{gold.gp}g {gold.sp}s {gold.cp}c</span>
                    </div>
                </div>

                <div className={styles.itemStats}>
                    <div className={isOverweight ? styles.weightOver : ''}>
                        Wgt: {totalWeight.toFixed(1)}/{capacity}lb
                    </div>
                    <div>
                        Slots: {items.length}/{maxSlots}
                    </div>
                </div>
            </div>

            <div
                className={`${styles.grid} ${isCollapsed ? styles.collapsed : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    const data = e.dataTransfer.getData('item');
                    const source = e.dataTransfer.getData('source');
                    if (data && source === 'ground') {
                        const item = JSON.parse(data);
                        onItemAction?.('pickup', item);
                    }
                }}
            >
                {items.map((item) => (
                    <div
                        key={item.instanceId || item.id}
                        className={`${styles.itemSlot} ${item.equipped ? styles.equipped : ''}`}
                        onClick={() => onItemClick?.(item)}
                        onContextMenu={(e) => handleContextMenu(e, item)}
                        title={`${item.name} (${item.type})`}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('item', JSON.stringify(item));
                            e.dataTransfer.setData('source', 'inventory');
                        }}
                    >
                        <div className={styles.iconWrapper}>
                            {getItemIcon(item.type)}
                        </div>
                        {item.quantity > 1 && <span className={styles.quantity}>{item.quantity}</span>}
                        {item.equipped && <div className={styles.equippedBadge}>E</div>}
                    </div>
                ))}
                {/* Fill empty slots */}
                {[...Array(Math.max(0, maxSlots - items.length))].map((_, i) => (
                    <div key={`empty-${i}`} className={styles.emptySlot} />
                ))}
            </div>

            <button
                className={`${styles.droppedItemsBtn} ${hasDroppedItems ? styles.hasItems : ''}`}
                onClick={() => hasDroppedItems && setShowDropped(!showDropped)}
                title={hasDroppedItems ? "View items at current location" : "No items on the ground"}
            >
                <Package size={14} />
                {hasDroppedItems ? `Dropped Items (${droppedItems?.length})` : 'No items nearby'}
            </button>

            {showDropped && hasDroppedItems && (
                <DroppedItemsPanel
                    items={droppedItems}
                    onClose={() => setShowDropped(false)}
                    onPickup={(itemsToPick: Item[]) => {
                        itemsToPick.forEach((item: Item) => onItemAction?.('pickup', item));
                        if (droppedItems.length <= itemsToPick.length) setShowDropped(false);
                    }}
                    onAction={onItemAction}
                />
            )}

            {contextMenu && (
                <ItemContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemName={contextMenu.item.name}
                    isEquippable={['weapon', 'armor', 'shield'].some(t => contextMenu.item.type.toLowerCase().includes(t))}
                    onClose={() => setContextMenu(null)}
                    onAction={handleAction}
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

export default InventoryGrid;
