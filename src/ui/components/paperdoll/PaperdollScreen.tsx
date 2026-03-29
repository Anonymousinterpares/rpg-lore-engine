import React, { useState, useCallback } from 'react';
import styles from './PaperdollScreen.module.css';
import PaperdollFigure from './PaperdollFigure';
import InventoryBag from './InventoryBag';
import { PaperdollItem, EquippedSlots, SlotId } from './types';
import { MOCK_ITEMS, MOCK_EQUIPPED, MOCK_GOLD } from './mockData';

// Map item types to their default equipment slot
const TYPE_TO_SLOT: Partial<Record<string, SlotId>> = {
    Helmet: 'head',
    Amulet: 'neck',
    Armor: 'armor',
    Cloak: 'cloak',
    Belt: 'belt',
    Bracers: 'bracers',
    Gloves: 'gloves',
    Boots: 'feet',
    Shield: 'offHand',
    Ammunition: 'ammunition',
};

function findSlotForItem(item: PaperdollItem, equipped: EquippedSlots): SlotId | null {
    // Weapons go to mainHand first, then offHand
    if (item.type === 'Weapon') {
        if (!equipped.mainHand) return 'mainHand';
        if (!equipped.offHand) return 'offHand';
        return 'mainHand'; // replace
    }

    // Rings go to first empty ring slot
    if (item.type === 'Ring') {
        const ringSlots: SlotId[] = [
            'leftRing1', 'leftRing2', 'leftRing3', 'leftRing4', 'leftRing5',
            'rightRing1', 'rightRing2', 'rightRing3', 'rightRing4', 'rightRing5',
        ];
        const empty = ringSlots.find(s => !equipped[s]);
        return empty || 'leftRing1';
    }

    const defaultSlot = TYPE_TO_SLOT[item.type];
    return defaultSlot || null;
}

const PaperdollScreen: React.FC = () => {
    const [inventoryItems, setInventoryItems] = useState<PaperdollItem[]>([...MOCK_ITEMS]);
    const [equippedSlots, setEquippedSlots] = useState<EquippedSlots>({ ...MOCK_EQUIPPED });

    const equipItem = useCallback((slotId: string, item: PaperdollItem) => {
        setEquippedSlots(prev => {
            const updated = { ...prev };
            // If slot already has an item, return it to inventory
            const existing = updated[slotId];
            if (existing) {
                setInventoryItems(inv => [...inv, { ...existing, equipped: false }]);
            }
            updated[slotId] = { ...item, equipped: true };
            return updated;
        });
        // Remove from inventory
        setInventoryItems(prev => prev.filter(i => i.instanceId !== item.instanceId));
    }, []);

    const unequipItem = useCallback((slotId: string) => {
        setEquippedSlots(prev => {
            const item = prev[slotId];
            if (!item) return prev;
            setInventoryItems(inv => [...inv, { ...item, equipped: false }]);
            return { ...prev, [slotId]: null };
        });
    }, []);

    const handleInventoryEquip = useCallback((item: PaperdollItem) => {
        const slot = findSlotForItem(item, equippedSlots);
        if (slot) {
            equipItem(slot, item);
        }
    }, [equippedSlots, equipItem]);

    const handleReceiveFromSlot = useCallback((item: PaperdollItem) => {
        // Item dragged from equipment slot back to inventory
        // The unequip is handled by the slot's drag end; here we just add to inventory
        setInventoryItems(prev => {
            if (prev.some(i => i.instanceId === item.instanceId)) return prev;
            return [...prev, { ...item, equipped: false }];
        });
    }, []);

    return (
        <div className={styles.screen}>
            <div className={styles.ornamentTop} />
            <div className={styles.content}>
                <PaperdollFigure
                    equippedSlots={equippedSlots}
                    onDrop={equipItem}
                    onUnequip={unequipItem}
                />
                <InventoryBag
                    items={inventoryItems}
                    gold={MOCK_GOLD}
                    onItemEquipped={handleInventoryEquip}
                    onReceiveItem={handleReceiveFromSlot}
                />
            </div>
            <div className={styles.ornamentBottom} />
        </div>
    );
};

export default PaperdollScreen;
