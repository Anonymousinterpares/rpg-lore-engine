import React, { useMemo, useCallback } from 'react';
import styles from './PaperdollScreen.module.css';
import PaperdollFigure from './PaperdollFigure';
import InventoryBag from './InventoryBag';
import { PaperdollItem, EquippedSlots, SlotId, ItemType } from './types';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';

/**
 * Convert a flat inventory item from game state into a PaperdollItem.
 * Enriches with data from DataManager where available.
 */
function mapToPaperdollItem(item: any): PaperdollItem {
    const enriched = DataManager.getItem(item.name || item.id);

    return {
        id: item.id || item.name,
        instanceId: item.instanceId || '',
        name: item.name,
        type: (item.type || enriched?.type || 'Misc') as ItemType,
        weight: item.weight ?? enriched?.weight ?? 0,
        quantity: item.quantity ?? 1,
        equipped: item.equipped ?? false,
        description: enriched?.description,
        isMagic: (enriched as any)?.isMagic,
        charges: item.charges ?? (enriched as any)?.charges,
        // Weapon fields
        damage: (enriched as any)?.damage ? {
            dice: typeof (enriched as any).damage.dice === 'string'
                ? (enriched as any).damage.dice
                : `${(enriched as any).damage.dice.count}d${(enriched as any).damage.dice.sides}`,
            type: (enriched as any).damage.type,
        } : undefined,
        properties: (enriched as any)?.properties,
        range: (enriched as any)?.range,
        // Armor fields
        acBonus: (enriched as any)?.acBonus,
        acCalculated: (enriched as any)?.acCalculated,
        strengthReq: (enriched as any)?.strengthReq,
        stealthDisadvantage: (enriched as any)?.stealthDisadvantage,
    };
}

const PaperdollScreen: React.FC = () => {
    const { state, engine } = useGameState();

    const sex = (state?.character as any)?.sex || 'male';

    // Map inventory items to PaperdollItems (unequipped only for the bag)
    const inventoryItems = useMemo(() => {
        if (!state?.character?.inventory?.items) return [];
        return state.character.inventory.items
            .filter(item => !item.equipped)
            .map(mapToPaperdollItem);
    }, [state?.character?.inventory?.items]);

    // Build equipped slots from character's equipmentSlots
    const equippedSlots = useMemo<EquippedSlots>(() => {
        if (!state?.character) return {};
        const slots = state.character.equipmentSlots as Record<string, string | undefined>;
        const items = state.character.inventory.items;
        const result: EquippedSlots = {};

        for (const [slotId, instanceId] of Object.entries(slots)) {
            if (!instanceId) {
                result[slotId] = null;
                continue;
            }
            const item = items.find(i => i.instanceId === instanceId);
            if (item) {
                result[slotId] = mapToPaperdollItem(item);
            } else {
                result[slotId] = null;
            }
        }

        return result;
    }, [state?.character?.equipmentSlots, state?.character?.inventory?.items]);

    const gold = useMemo(() => {
        if (!state?.character?.inventory?.gold) return { gp: 0, sp: 0, cp: 0 };
        const g = state.character.inventory.gold;
        return { gp: (g as any).gp ?? 0, sp: (g as any).sp ?? 0, cp: (g as any).cp ?? 0 };
    }, [state?.character?.inventory?.gold]);

    // Drag-drop equip to specific slot
    const handleEquipToSlot = useCallback(async (slotId: string, item: PaperdollItem) => {
        if (!engine) return;
        await engine.equipItemToSlot(item.instanceId, slotId);
    }, [engine]);

    // Right-click unequip from specific slot
    const handleUnequip = useCallback(async (slotId: string) => {
        if (!engine) return;
        await engine.unequipFromSlot(slotId);
    }, [engine]);

    // Double-click inventory item → auto-equip
    const handleInventoryEquip = useCallback(async (item: PaperdollItem) => {
        if (!engine) return;
        await engine.equipItem(item.instanceId);
    }, [engine]);

    // Item dragged from equipped slot back to inventory (unequip)
    const handleReceiveFromSlot = useCallback(async (item: PaperdollItem) => {
        if (!engine) return;
        // Find which slot this item is in and unequip
        const slots = state?.character?.equipmentSlots as Record<string, string | undefined>;
        if (slots) {
            const slotEntry = Object.entries(slots).find(([_, id]) => id === item.instanceId);
            if (slotEntry) {
                await engine.unequipFromSlot(slotEntry[0]);
            }
        }
    }, [engine, state?.character?.equipmentSlots]);

    if (!state?.character) {
        return <div className={styles.screen}>Loading...</div>;
    }

    return (
        <div className={styles.screen}>
            <div className={styles.ornamentTop} />
            <div className={styles.content}>
                <PaperdollFigure
                    equippedSlots={equippedSlots}
                    sex={sex}
                    onDrop={handleEquipToSlot}
                    onUnequip={handleUnequip}
                />
                <InventoryBag
                    items={inventoryItems}
                    gold={gold}
                    onItemEquipped={handleInventoryEquip}
                    onReceiveItem={handleReceiveFromSlot}
                />
            </div>
            <div className={styles.ornamentBottom} />
        </div>
    );
};

export default PaperdollScreen;
