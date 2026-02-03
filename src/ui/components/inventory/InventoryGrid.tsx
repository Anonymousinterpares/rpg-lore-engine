import React from 'react';
import styles from './InventoryGrid.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, Coins } from 'lucide-react';

interface Item {
    id: string;
    name: string;
    type: string;
    quantity: number;
    weight: number;
    equipped?: boolean;
}

interface InventoryGridProps {
    items: Item[];
    gold: { gp: number, sp: number, cp: number };
    onItemClick?: (item: Item) => void;
    className?: string;
}

const InventoryGrid: React.FC<InventoryGridProps> = ({ items, gold, onItemClick, className = '' }) => {
    const getItemIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('weapon')) return <Sword size={18} />;
        if (t.includes('armor') || t.includes('shield')) return <Shield size={18} />;
        if (t.includes('potion')) return <FlaskConical size={18} />;
        if (t.includes('scroll')) return <Scroll size={18} />;
        return <Package size={18} />;
    };

    return (
        <div className={`${styles.container} ${parchmentStyles.panel} ${className}`}>
            <div className={styles.header}>
                <h3 className={parchmentStyles.heading}>Inventory</h3>
                <div className={styles.gold}>
                    <Coins size={14} className={styles.goldIcon} />
                    <span>{gold.gp}g {gold.sp}s {gold.cp}c</span>
                </div>
            </div>

            <div className={styles.grid}>
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`${styles.itemSlot} ${item.equipped ? styles.equipped : ''}`}
                        onClick={() => onItemClick?.(item)}
                        title={`${item.name} (${item.type})`}
                    >
                        <div className={styles.iconWrapper}>
                            {getItemIcon(item.type)}
                        </div>
                        {item.quantity > 1 && <span className={styles.quantity}>{item.quantity}</span>}
                        {item.equipped && <div className={styles.equippedBadge}>E</div>}
                    </div>
                ))}
                {/* Fill empty slots */}
                {[...Array(Math.max(0, 20 - items.length))].map((_, i) => (
                    <div key={`empty-${i}`} className={styles.emptySlot} />
                ))}
            </div>
        </div>
    );
};

export default InventoryGrid;
