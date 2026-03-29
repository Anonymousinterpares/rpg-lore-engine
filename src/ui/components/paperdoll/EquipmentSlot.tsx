import React, { useState, useRef, useCallback } from 'react';
import styles from './EquipmentSlot.module.css';
import { PaperdollItem, SlotConfig } from './types';
import ItemTooltip from './ItemTooltip';
import {
    Sword, Shield, Crown, Footprints, Shirt,
    CircleDot, Target, Gem, Wind,
    Crosshair, HandMetal, Layers, Ribbon
} from 'lucide-react';

interface EquipmentSlotProps {
    config: SlotConfig;
    item: PaperdollItem | null;
    onDrop: (slotId: string, item: PaperdollItem) => void;
    onUnequip: (slotId: string) => void;
    isRingSlot?: boolean;
}

const SLOT_ICONS: Record<string, React.ReactNode> = {
    head: <Crown size={20} />,
    neck: <Gem size={20} />,
    shoulders: <Layers size={20} />,
    armor: <Shirt size={20} />,
    cloak: <Wind size={20} />,
    belt: <Ribbon size={20} />,
    bracers: <HandMetal size={20} />,
    gloves: <HandMetal size={20} />,
    legs: <Layers size={18} />,
    feet: <Footprints size={20} />,
    mainHand: <Sword size={22} />,
    offHand: <Shield size={22} />,
    ammunition: <Target size={20} />,
};

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
    Weapon: <Sword size={22} />,
    Armor: <Shirt size={22} />,
    Shield: <Shield size={22} />,
    Helmet: <Crown size={20} />,
    Cloak: <Wind size={20} />,
    Amulet: <Gem size={20} />,
    Belt: <Ribbon size={20} />,
    Bracers: <HandMetal size={20} />,
    Gloves: <HandMetal size={20} />,
    Boots: <Footprints size={20} />,
    Ring: <CircleDot size={14} />,
    Ammunition: <Target size={20} />,
};

const RARITY_GLOW: Record<string, string> = {
    uncommon: 'rgba(30, 255, 0, 0.35)',
    rare: 'rgba(0, 112, 221, 0.45)',
    'very-rare': 'rgba(163, 53, 238, 0.45)',
    legendary: 'rgba(255, 128, 0, 0.5)',
};

const EquipmentSlot: React.FC<EquipmentSlotProps> = ({ config, item, onDrop, onUnequip, isRingSlot }) => {
    const [dragOver, setDragOver] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const slotRef = useRef<HTMLDivElement>(null);

    const size = isRingSlot ? 'small' : (config.size || 'normal');

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        try {
            const itemData = JSON.parse(e.dataTransfer.getData('paperdoll-item'));
            if (config.accepts.includes(itemData.type)) {
                onDrop(config.id, itemData);
            }
        } catch { /* invalid data */ }
    }, [config, onDrop]);

    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (!item) return;
        e.dataTransfer.setData('paperdoll-item', JSON.stringify(item));
        e.dataTransfer.setData('source-slot', config.id);
        e.dataTransfer.effectAllowed = 'move';
    }, [item, config.id]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (item) onUnequip(config.id);
    }, [item, config.id, onUnequip]);

    const rarityGlow = item?.rarity ? RARITY_GLOW[item.rarity] : undefined;
    const anchorRect = slotRef.current?.getBoundingClientRect() ?? null;

    return (
        <>
            <div
                ref={slotRef}
                className={`${styles.slot} ${styles[size]} ${dragOver ? styles.dragOver : ''} ${item ? styles.filled : ''}`}
                style={rarityGlow && item ? { boxShadow: `0 0 10px ${rarityGlow}, inset 0 0 6px ${rarityGlow}` } : undefined}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                draggable={!!item}
                onDragStart={handleDragStart}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => item && setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                title={!item ? config.label : undefined}
            >
                {item ? (
                    <div className={styles.itemIcon}>
                        {ITEM_TYPE_ICONS[item.type] || <Crosshair size={18} />}
                    </div>
                ) : (
                    <div className={styles.placeholder}>
                        {isRingSlot ? <CircleDot size={12} /> : (SLOT_ICONS[config.id] || <Crosshair size={16} />)}
                    </div>
                )}

                {!item && !isRingSlot && (
                    <span className={styles.slotLabel}>{config.label}</span>
                )}
            </div>

            {item && (
                <ItemTooltip item={item} anchorRect={anchorRect} visible={showTooltip} />
            )}
        </>
    );
};

export default EquipmentSlot;
