import React, { useState, useRef, useCallback } from 'react';
import styles from './InventoryBag.module.css';
import { PaperdollItem } from './types';
import ItemTooltip from './ItemTooltip';
import {
    Sword, Shield, Shirt, Crown, Wind, Gem, Ribbon,
    HandMetal, Footprints, CircleDot, Target, FlaskConical,
    Scroll, Package, Wrench, Sparkles, Crosshair, Coins
} from 'lucide-react';

interface InventoryBagProps {
    items: PaperdollItem[];
    gold: { gp: number; sp: number; cp: number };
    onItemEquipped: (item: PaperdollItem) => void;
    onReceiveItem: (item: PaperdollItem) => void;
    onItemContextMenu?: (e: React.MouseEvent, item: PaperdollItem) => void;
}

const ITEM_ICONS: Record<string, React.ReactNode> = {
    Weapon: <Sword size={20} />,
    Armor: <Shirt size={20} />,
    Shield: <Shield size={20} />,
    Helmet: <Crown size={18} />,
    Cloak: <Wind size={18} />,
    Amulet: <Gem size={18} />,
    Belt: <Ribbon size={18} />,
    Bracers: <HandMetal size={18} />,
    Gloves: <HandMetal size={18} />,
    Boots: <Footprints size={18} />,
    Ring: <CircleDot size={16} />,
    Ammunition: <Target size={18} />,
    'Adventuring Gear': <FlaskConical size={18} />,
    'Spell Scroll': <Scroll size={18} />,
    Tool: <Wrench size={18} />,
    'Magic Item': <Sparkles size={18} />,
    Misc: <Package size={18} />,
};

const RARITY_BORDER: Record<string, string> = {
    common: '#5d4037',
    uncommon: '#1eff00',
    rare: '#0070dd',
    'very-rare': '#a335ee',
    legendary: '#ff8000',
};

const MAX_SLOTS = 24;

const InventoryBag: React.FC<InventoryBagProps> = ({ items, gold, onItemEquipped, onReceiveItem, onItemContextMenu }) => {
    const [tooltipItem, setTooltipItem] = useState<PaperdollItem | null>(null);
    const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback((e: React.DragEvent, item: PaperdollItem) => {
        e.dataTransfer.setData('paperdoll-item', JSON.stringify(item));
        e.dataTransfer.setData('source', 'inventory');
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const sourceSlot = e.dataTransfer.getData('source-slot');
        if (sourceSlot) {
            try {
                const itemData = JSON.parse(e.dataTransfer.getData('paperdoll-item'));
                onReceiveItem(itemData);
            } catch { /* invalid */ }
        }
    }, [onReceiveItem]);

    const handleMouseEnter = useCallback((e: React.MouseEvent, item: PaperdollItem) => {
        setTooltipItem(item);
        setTooltipRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    }, []);

    const handleMouseLeave = useCallback(() => {
        setTooltipItem(null);
    }, []);

    const handleDoubleClick = useCallback((item: PaperdollItem) => {
        onItemEquipped(item);
    }, [onItemEquipped]);

    const emptySlots = Math.max(0, MAX_SLOTS - items.length);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Inventory</h3>
                <div className={styles.goldDisplay}>
                    <Coins size={14} />
                    <span className={styles.goldAmount}>{gold.gp}</span>
                    <span className={styles.silverAmount}>{gold.sp}</span>
                    <span className={styles.copperAmount}>{gold.cp}</span>
                </div>
            </div>

            <div className={styles.slotCount}>{items.length}/{MAX_SLOTS} slots</div>

            <div
                ref={gridRef}
                className={styles.grid}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {items.map((item) => (
                    <div
                        key={item.instanceId}
                        className={`${styles.itemSlot} ${item.equipped ? styles.equipped : ''}`}
                        style={{ borderColor: RARITY_BORDER[item.rarity || 'common'] }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                        onMouseLeave={handleMouseLeave}
                        onDoubleClick={() => handleDoubleClick(item)}
                        onContextMenu={(e) => { e.preventDefault(); onItemContextMenu?.(e, item); }}
                    >
                        <div className={styles.itemIcon}>
                            {ITEM_ICONS[item.type] || <Package size={18} />}
                        </div>
                        {item.quantity > 1 && (
                            <span className={styles.quantity}>{item.quantity}</span>
                        )}
                        {item.equipped && (
                            <span className={styles.equippedBadge}>E</span>
                        )}
                        {item.identified === false && (() => {
                            const badgeColors: Record<string, string> = {
                                uncommon: '#1eff00', rare: '#0070dd', 'very-rare': '#a335ee', legendary: '#ff8000',
                            };
                            return <span className={styles.equippedBadge} style={{ background: badgeColors[item.rarity || ''] || '#888', right: 'auto', left: 2, color: '#000', fontWeight: 700 }}>?</span>;
                        })()}
                    </div>
                ))}

                {Array.from({ length: emptySlots }).map((_, i) => (
                    <div key={`empty-${i}`} className={styles.emptySlot} />
                ))}
            </div>

            <div className={styles.hint}>
                Double-click or drag to equip. Right-click equipped slot to unequip.
            </div>

            {tooltipItem && (
                <ItemTooltip
                    item={tooltipItem}
                    anchorRect={tooltipRect}
                    visible={!!tooltipItem}
                />
            )}
        </div>
    );
};

export default InventoryBag;
