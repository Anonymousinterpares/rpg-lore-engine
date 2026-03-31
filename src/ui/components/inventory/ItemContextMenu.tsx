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
    equipAllowed?: boolean;
    equipReason?: string;
    isConsumable?: boolean;
    isUnidentified?: boolean;
    examineDisabledReason?: string; // e.g., "No Arcana/Investigation skill", "Cooldown: 12h remaining"
    customActions?: { id: string, label: string, icon: string }[];
}

const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
    x, y, onClose, onAction, itemName, isEquippable, equipAllowed = true, equipReason, isConsumable, isUnidentified, examineDisabledReason, customActions
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
                        <button
                            onClick={() => equipAllowed && onAction('equip')}
                            className={!equipAllowed ? styles.requirementUnmet : ''}
                            title={!equipAllowed ? equipReason : ''}
                        >
                            <ArrowUpCircle size={14} /> Equip / Unequip
                        </button>
                    )}

                    {isConsumable && (
                        <button onClick={() => onAction('use')}>
                            <Zap size={14} /> Use
                        </button>
                    )}

                    {(() => {
                        const canExamine = isUnidentified && !examineDisabledReason;
                        const tooltip = !isUnidentified
                            ? 'This item is already identified.'
                            : examineDisabledReason || 'Attempt to identify this item (Arcana/Investigation check)';
                        return (
                            <button
                                onClick={() => canExamine ? onAction('examine') : undefined}
                                className={canExamine ? '' : styles.disabled}
                                title={tooltip}
                            >
                                <Search size={14} /> {isUnidentified ? 'Examine (Identify)' : 'Examine'}
                            </button>
                        );
                    })()}

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
