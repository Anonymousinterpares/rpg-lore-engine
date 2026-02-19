import React, { useState } from 'react';
import styles from './InventoryGrid.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, Coins, ChevronDown } from 'lucide-react';
import ItemContextMenu from './ItemContextMenu';
import ItemDatasheet from './ItemDatasheet';
import { DataManager } from '../../../ruleset/data/DataManager';
import { EquipmentEngine } from '../../../ruleset/combat/EquipmentEngine';
import { Item as RulesetItem } from '../../../ruleset/schemas/ItemSchema';
import DroppedItemsPanel from './DroppedItemsPanel';
import { useGameState } from '../../hooks/useGameState';

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
    combatLoot?: Item[];
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
    combatLoot = [],
    maxSlots = 20,
    onItemClick,
    onItemAction,
    className = ''
}) => {
    const { state } = useGameState();
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Item } | null>(null);
    const [datasheetItem, setDatasheetItem] = useState<any>(null);
    const [showDropped, setShowDropped] = useState(false);
    const [showLoot, setShowLoot] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const totalWeight = items.reduce((sum, item) => sum + (item.weight * (item.quantity || 1)), 0);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 1500);
    };

    const handlePickupWithValidation = (itemsToPick: Item[], actionType: 'pickup' | 'pickupLoot') => {
        let currentSlots = items.length;
        let currentWgt = totalWeight;
        let successCount = 0;

        for (const item of itemsToPick) {
            const isStackable = !['weapon', 'armor', 'shield'].some(t => (item.type || '').toLowerCase().includes(t));
            const existing = items.find(i => (i.id === item.id || i.id === item.name || i.id === item.name.toLowerCase().replace(/ /g, '_')) && isStackable);

            if (currentWgt + (item.weight * (item.quantity || 1)) > capacity) {
                showToast("Too heavy!");
                break;
            }
            if (!existing) {
                if (currentSlots >= maxSlots) {
                    showToast("Not enough space in your inventory!");
                    break;
                }
                currentSlots++;
            }
            currentWgt += item.weight * (item.quantity || 1);
            onItemAction?.(actionType, item);
            successCount++;
        }
        return successCount;
    };
    const isOverweight = totalWeight > capacity;
    const hasDroppedItems = (droppedItems || []).length > 0;
    const hasCombatLoot = (combatLoot || []).length > 0;

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
            {toast && (
                <div className={styles.inventoryToast}>
                    {toast}
                </div>
            )}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'var(--spacing-sm)' }}>
                {hasCombatLoot && (
                    <button
                        className={`${styles.lootBtn} ${styles.hasLoot}`}
                        onClick={() => setShowLoot(!showLoot)}
                        title="View loot from recent combat"
                    >
                        <Coins size={14} />
                        Combat Loot ({combatLoot?.length})
                    </button>
                )}

                <button
                    className={`${styles.droppedItemsBtn} ${hasDroppedItems ? styles.hasItems : ''}`}
                    onClick={() => hasDroppedItems && setShowDropped(!showDropped)}
                    title={hasDroppedItems ? "View items at current location" : "No items on the ground"}
                >
                    <Package size={14} />
                    {hasDroppedItems ? `Dropped Items (${droppedItems?.length})` : 'No items nearby'}
                </button>
            </div>

            {showDropped && hasDroppedItems && (
                <DroppedItemsPanel
                    items={droppedItems}
                    onClose={() => setShowDropped(false)}
                    onPickup={(itemsToPick: Item[]) => {
                        const picked = handlePickupWithValidation(itemsToPick, 'pickup');
                        if (droppedItems.length <= picked) setShowDropped(false);
                    }}
                    onAction={onItemAction}
                />
            )}

            {showLoot && hasCombatLoot && (
                <DroppedItemsPanel
                    items={combatLoot!}
                    onClose={() => setShowLoot(false)}
                    onPickup={(itemsToPick: Item[]) => {
                        const picked = handlePickupWithValidation(itemsToPick, 'pickupLoot');
                        if (combatLoot!.length <= picked) setShowLoot(false);
                    }}
                    onAction={(action, item) => {
                        if (action === 'pickup') handlePickupWithValidation([item], 'pickupLoot');
                        else onItemAction?.(action, item);
                    }}
                />
            )}

            {contextMenu && (() => {
                const fullItem = DataManager.getItem(contextMenu.item.id);
                if (!state || !fullItem) return null;
                const validation = EquipmentEngine.canEquip(state.character, fullItem as any);
                return (
                    <ItemContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        itemName={contextMenu.item.name}
                        isEquippable={['weapon', 'armor', 'shield'].some(t => contextMenu.item.type.toLowerCase().includes(t))}
                        equipAllowed={validation.valid}
                        equipReason={validation.reason}
                        onClose={() => setContextMenu(null)}
                        onAction={handleAction}
                    />
                );
            })()}

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
