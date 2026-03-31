import React, { useMemo, useCallback, useState } from 'react';
import styles from './PaperdollScreen.module.css';
import PaperdollFigure from './PaperdollFigure';
import InventoryBag from './InventoryBag';
import ItemContextMenu from '../inventory/ItemContextMenu';
import ItemDatasheet from '../inventory/ItemDatasheet';
import { PaperdollItem, EquippedSlots, SlotId, ItemType } from './types';
import { useGameState } from '../../hooks/useGameState';
import { DataManager } from '../../../ruleset/data/DataManager';

/**
 * Convert a flat inventory item from game state into a PaperdollItem.
 * Enriches with data from DataManager where available.
 */
/**
 * Normalizes rarity from schema format to CSS format.
 * "Very Rare" → "very-rare", "Common" → "common"
 */
function normalizeRarity(rarity?: string): PaperdollItem['rarity'] {
    if (!rarity) return undefined;
    return rarity.toLowerCase().replace(' ', '-') as PaperdollItem['rarity'];
}

function mapToPaperdollItem(item: any): PaperdollItem {
    const enriched = DataManager.getItem(item.name || item.id);
    // For forged items, inventory data takes priority over DataManager template
    const src = item.isForged ? { ...enriched, ...item } : { ...item };
    const base = enriched || {};

    return {
        id: item.id || item.name,
        instanceId: item.instanceId || '',
        name: item.name,
        type: (item.type || (base as any)?.type || 'Misc') as ItemType,
        weight: item.weight ?? (base as any)?.weight ?? 0,
        quantity: item.quantity ?? 1,
        equipped: item.equipped ?? false,
        description: item.description || (base as any)?.description,
        isMagic: src.isMagic ?? (base as any)?.isMagic ?? false,
        charges: item.charges ?? (base as any)?.charges,
        rarity: normalizeRarity(item.rarity || (base as any)?.rarity),
        // Weapon fields (forged items carry these directly)
        damage: src.damage ? {
            dice: typeof src.damage.dice === 'string'
                ? src.damage.dice
                : `${src.damage.dice.count}d${src.damage.dice.sides}`,
            type: src.damage.type,
        } : undefined,
        properties: src.properties || (base as any)?.properties,
        range: src.range || (base as any)?.range,
        // Armor fields
        acBonus: src.acBonus ?? (base as any)?.acBonus,
        acCalculated: src.acCalculated ?? (base as any)?.acCalculated,
        strengthReq: src.strengthReq ?? (base as any)?.strengthReq,
        stealthDisadvantage: src.stealthDisadvantage ?? (base as any)?.stealthDisadvantage,
        // Forge fields
        modifiers: item.modifiers || (base as any)?.modifiers || [],
        magicalProperties: item.magicalProperties || (base as any)?.magicalProperties || [],
        isForged: item.isForged || false,
        forgeSource: item.forgeSource,
        itemLevel: item.itemLevel,
    };
}

const PaperdollScreen: React.FC = () => {
    const { state, engine } = useGameState();

    const sex = (state?.character as any)?.sex || 'male';

    // Derive a change key so useMemo invalidates on equip/unequip
    const equipKey = JSON.stringify(state?.character?.equipmentSlots);
    const invKey = state?.character?.inventory?.items?.map(i => `${i.instanceId}:${i.equipped}`).join(',');

    // Map inventory items to PaperdollItems (unequipped only for the bag)
    const inventoryItems = useMemo(() => {
        if (!state?.character?.inventory?.items) return [];
        return state.character.inventory.items
            .filter(item => !item.equipped)
            .map(mapToPaperdollItem);
    }, [invKey]);

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
    }, [equipKey, invKey]);

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

    // Context menu state for equipment slots
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: PaperdollItem; slotId: string } | null>(null);
    const [datasheetItem, setDatasheetItem] = useState<any>(null);

    const handleSlotContextMenu = useCallback((e: React.MouseEvent, item: PaperdollItem, slotId: string) => {
        setCtxMenu({ x: e.clientX, y: e.clientY, item, slotId });
    }, []);

    const handleCtxAction = useCallback(async (action: string) => {
        if (!ctxMenu) return;
        const { item, slotId } = ctxMenu;
        setCtxMenu(null);

        if (action === 'info') {
            const baseItem = DataManager.getItem(item.id);
            setDatasheetItem({ ...baseItem, ...item });
        } else if (action === 'equip' && engine) {
            // "Unequip" for equipped items
            await engine.unequipFromSlot(slotId);
        } else if (action === 'drop' && engine) {
            await engine.unequipFromSlot(slotId);
            // Could also drop, but unequip is the safe action
        }
    }, [ctxMenu, engine]);

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
                    onItemContextMenu={handleSlotContextMenu}
                />
                <InventoryBag
                    items={inventoryItems}
                    gold={gold}
                    onItemEquipped={handleInventoryEquip}
                    onReceiveItem={handleReceiveFromSlot}
                />
            </div>
            <div className={styles.ornamentBottom} />

            {ctxMenu && (
                <ItemContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    itemName={ctxMenu.item.name}
                    isEquippable={true}
                    equipAllowed={true}
                    onClose={() => setCtxMenu(null)}
                    onAction={handleCtxAction}
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

export default PaperdollScreen;
