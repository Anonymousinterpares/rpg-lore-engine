import React, { useEffect, useRef } from 'react';
import styles from './ItemContextMenu.module.css';
import { Info, Trash2, Search, Zap, ArrowUpCircle, Package } from 'lucide-react';

interface ItemContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAction: (action: string) => void;
    itemName: string;
    isEquippable?: boolean;
    isConsumable?: boolean;
    customActions?: { id: string, label: string, icon: string }[];
}

const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
    x, y, onClose, onAction, itemName, isEquippable, isConsumable, customActions
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Prevent context menu from going off screen
    const adjustedX = Math.min(x, window.innerWidth - 160);
    const adjustedY = Math.min(y, window.innerHeight - 200);

    return (
        <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: adjustedY, left: adjustedX }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className={styles.itemName}>{itemName}</div>

            {customActions ? (
                customActions.map(action => (
                    <button key={action.id} onClick={() => onAction(action.id)}>
                        <Package size={14} /> {action.label}
                    </button>
                ))
            ) : (
                <>
                    <button onClick={() => onAction('info')}>
                        <Info size={14} /> Information
                    </button>

                    {isEquippable && (
                        <button onClick={() => onAction('equip')}>
                            <ArrowUpCircle size={14} /> Equip / Unequip
                        </button>
                    )}

                    {isConsumable && (
                        <button onClick={() => onAction('use')}>
                            <Zap size={14} /> Use
                        </button>
                    )}

                    <button onClick={() => onAction('examine')} className={styles.disabled} title="Requires further investigation...">
                        <Search size={14} /> Examine
                    </button>

                    <div className={styles.divider} />

                    <button onClick={() => onAction('drop')} className={styles.dropButton}>
                        <Trash2 size={14} /> Drop
                    </button>
                </>
            )}
        </div>
    );
};

export default ItemContextMenu;
