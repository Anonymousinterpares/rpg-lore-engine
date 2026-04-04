import { GameState } from '../../schemas/FullSaveStateSchema';
import { DataManager } from '../../data/DataManager';
import { MechanicsEngine } from '../MechanicsEngine';
import { EquipmentEngine } from '../EquipmentEngine';
import { EventBusManager } from './EventBusManager';

/**
 * Handles inventory operations, items, equipment, and equipment-related stat recalculations.
 */
export class InventoryManager {
    constructor(
        private state: GameState,
        private emitStateUpdate: () => Promise<void>,
        private addCombatLog: (message: string) => void
    ) { }

    public async pickupItem(instanceId: string): Promise<string> {
        const char = this.state.character;
        const droppedItems = this.state.location.droppedItems || [];
        const itemIndex = droppedItems.findIndex(i => i.instanceId === instanceId);

        if (itemIndex === -1) return "Item not found on the ground.";

        const item = droppedItems[itemIndex];
        const currentWeight = char.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
        if (currentWeight + (item.weight * (item.quantity || 1)) > (char.stats.STR || 10) * 15) {
            return "You are carrying too much to pick this up.";
        }

        // Fix: Strict Backup Parity (Exclusion based + ID matching)
        const typeLower = item.type.toLowerCase();
        // Original logic: items are stackable if NOT weapon/armor/shield
        const isStackable = !['weapon', 'armor', 'shield', 'ring', 'amulet', 'cloak', 'belt', 'boots', 'gloves', 'bracers', 'helmet'].some(t => typeLower.includes(t));

        // Use name as ID for stackables if not already set (parity with addItem)
        // But for pickup, we trust item.id might already be correct from world generation?
        // Actually, backup just checked i.id === item.id. 
        // If an item on ground was created via addItem logic, its ID should already be the name if stackable.
        // However, to be safe and match `addItem` parity:

        const existingItem = char.inventory.items.find(i => i.id === item.id);

        if (existingItem && isStackable) {
            existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
        } else {
            if (char.inventory.items.length >= 20) {
                return "Not enough space in your inventory!";
            }
            char.inventory.items.push({ ...item, equipped: false });
        }

        droppedItems.splice(itemIndex, 1);
        await this.emitStateUpdate();
        EventBusManager.publish('ITEM_ACQUIRED', { itemId: item.id || item.name, quantity: item.quantity || 1 });
        return `Picked up ${item.name}.`;
    }

    public async dropItem(instanceId: string): Promise<string> {
        const char = this.state.character;
        const itemIndex = char.inventory.items.findIndex(i => i.instanceId === instanceId);

        if (itemIndex === -1) return "Item not found in inventory.";

        const item = char.inventory.items[itemIndex];
        char.inventory.items.splice(itemIndex, 1);

        if (!this.state.location.droppedItems) {
            this.state.location.droppedItems = [];
        }

        this.state.location.droppedItems.push({
            ...item,
            instanceId: item.instanceId || `${item.id}-${Date.now()}`
        });

        const slots = char.equipmentSlots as Record<string, string | undefined>;
        Object.keys(slots).forEach(slot => {
            if (slots[slot] === instanceId) {
                slots[slot] = undefined;
            }
        });

        await this.emitStateUpdate();
        EventBusManager.publish('ITEM_LOST', { itemId: item.id || item.name, quantity: item.quantity || 1 });
        return `Dropped ${item.name}.`;
    }

    /** Map item type to its default equipment slot. */
    private static readonly TYPE_TO_SLOT: Record<string, string> = {
        'weapon': 'mainHand',
        'armor': 'armor',
        'shield': 'offHand',
        'helmet': 'head',
        'amulet': 'neck',
        'cloak': 'cloak',
        'belt': 'belt',
        'bracers': 'bracers',
        'gloves': 'gloves',
        'boots': 'feet',
        'ammunition': 'ammunition',
    };

    private static readonly RING_SLOTS = [
        'leftRing1', 'leftRing2', 'leftRing3', 'leftRing4', 'leftRing5',
        'rightRing1', 'rightRing2', 'rightRing3', 'rightRing4', 'rightRing5',
    ];

    private findSlotForType(type: string): string {
        const typeLower = type.toLowerCase();

        // Ring: find first empty ring slot
        if (typeLower === 'ring') {
            const slots = this.state.character.equipmentSlots as Record<string, string | undefined>;
            const empty = InventoryManager.RING_SLOTS.find(s => !slots[s]);
            return empty || 'leftRing1';
        }

        // Weapon: prefer mainHand, fall back to offHand
        if (typeLower === 'weapon') {
            const slots = this.state.character.equipmentSlots as Record<string, string | undefined>;
            if (!slots.mainHand) return 'mainHand';
            if (!slots.offHand) return 'offHand';
            return 'mainHand';
        }

        return InventoryManager.TYPE_TO_SLOT[typeLower] || '';
    }

    public async equipItem(instanceId: string): Promise<string> {
        const char = this.state.character;
        const item = char.inventory.items.find(i => i.instanceId === instanceId);

        if (!item) return "Item not found.";

        if (item.equipped) {
            item.equipped = false;
            const slots = char.equipmentSlots as Record<string, string | undefined>;
            Object.keys(slots).forEach(slot => {
                if (slots[slot] === instanceId) {
                    slots[slot] = undefined;
                }
            });
            EquipmentEngine.recalculateAC(char);
            await this.emitStateUpdate();
            return `Unequipped ${item.name}.`;
        } else {
            const slot = this.findSlotForType(item.type || '');
            if (!slot) return `${item.name} cannot be equipped.`;

            const validation = EquipmentEngine.validateEquip(char, item as any);
            if (!validation.valid) {
                const errorMsg = `${item.name} cannot be equipped: ${validation.reason}`;
                this.addCombatLog(errorMsg);
                return errorMsg;
            }

            const slots = char.equipmentSlots as Record<string, string | undefined>;

            // Two-handed weapon handling
            const itemData = DataManager.getItem(item.id || item.name);
            const itemProps = (itemData as any)?.properties || (item as any).properties || [];
            const isTwoHanded = itemProps.some((p: string) => /two.?handed/i.test(p));

            // If equipping two-handed weapon to mainHand, clear offHand
            if (slot === 'mainHand' && isTwoHanded && slots['offHand']) {
                const offItem = char.inventory.items.find(i => i.instanceId === slots['offHand']);
                if (offItem) offItem.equipped = false;
                slots['offHand'] = undefined;
            }

            // Block offHand if mainHand is two-handed
            if (slot === 'offHand') {
                const mainHandId = slots['mainHand'];
                if (mainHandId) {
                    const mainItem = char.inventory.items.find(i => i.instanceId === mainHandId);
                    const mainData = mainItem ? DataManager.getItem(mainItem.id || mainItem.name) : null;
                    const mainProps = (mainData as any)?.properties || (mainItem as any)?.properties || [];
                    if (mainProps.some((p: string) => /two.?handed/i.test(p))) {
                        return `Cannot equip off-hand: ${mainItem?.name || 'weapon'} requires two hands.`;
                    }
                }
            }

            const currentInSlotId = slots[slot];
            if (currentInSlotId) {
                const currentItem = char.inventory.items.find(i => i.instanceId === currentInSlotId);
                if (currentItem) currentItem.equipped = false;
            }

            slots[slot] = instanceId;
            item.equipped = true;

            EquipmentEngine.recalculateAC(char);
            await this.emitStateUpdate();
            return `Equipped ${item.name}.`;
        }
    }

    /**
     * Equip item to a specific slot (for drag-drop targeting).
     */
    public async equipItemToSlot(instanceId: string, slotId: string): Promise<string> {
        const char = this.state.character;
        const item = char.inventory.items.find(i => i.instanceId === instanceId);

        if (!item) return "Item not found.";

        if (!EquipmentEngine.isSlotCompatible(slotId, item.type || '')) {
            return `${item.name} cannot be equipped in ${slotId}.`;
        }

        const validation = EquipmentEngine.validateEquip(char, item as any);
        if (!validation.valid) {
            const errorMsg = `${item.name} cannot be equipped: ${validation.reason}`;
            this.addCombatLog(errorMsg);
            return errorMsg;
        }

        const slots = char.equipmentSlots as Record<string, string | undefined>;

        // If item is already equipped elsewhere, remove from old slot
        if (item.equipped) {
            Object.keys(slots).forEach(slot => {
                if (slots[slot] === instanceId) slots[slot] = undefined;
            });
        }

        // Two-handed weapon checks for drag-drop
        const itemData2 = DataManager.getItem(item.id || item.name);
        const itemProps2 = (itemData2 as any)?.properties || (item as any).properties || [];
        const isTwoHanded2 = itemProps2.some((p: string) => /two.?handed/i.test(p));

        if (slotId === 'mainHand' && isTwoHanded2 && slots['offHand']) {
            const offItem = char.inventory.items.find(i => i.instanceId === slots['offHand']);
            if (offItem) offItem.equipped = false;
            slots['offHand'] = undefined;
        }
        if (slotId === 'offHand') {
            const mainHandId = slots['mainHand'];
            if (mainHandId) {
                const mainItem = char.inventory.items.find(i => i.instanceId === mainHandId);
                const mainData = mainItem ? DataManager.getItem(mainItem.id || mainItem.name) : null;
                const mainProps = (mainData as any)?.properties || (mainItem as any)?.properties || [];
                if (mainProps.some((p: string) => /two.?handed/i.test(p))) {
                    return `Cannot equip off-hand: ${mainItem?.name || 'weapon'} requires two hands.`;
                }
            }
        }

        // Swap out existing item in target slot
        const currentInSlotId = slots[slotId];
        if (currentInSlotId) {
            const currentItem = char.inventory.items.find(i => i.instanceId === currentInSlotId);
            if (currentItem) currentItem.equipped = false;
        }

        slots[slotId] = instanceId;
        item.equipped = true;

        EquipmentEngine.recalculateAC(char);
        await this.emitStateUpdate();
        return `Equipped ${item.name} to ${slotId}.`;
    }

    /**
     * Unequip item from a specific slot.
     */
    public async unequipFromSlot(slotId: string): Promise<string> {
        const char = this.state.character;
        const slots = char.equipmentSlots as Record<string, string | undefined>;
        const instanceId = slots[slotId];

        if (!instanceId) return "Slot is empty.";

        const item = char.inventory.items.find(i => i.instanceId === instanceId);
        if (item) item.equipped = false;

        slots[slotId] = undefined;
        EquipmentEngine.recalculateAC(char);
        await this.emitStateUpdate();
        return `Unequipped ${item?.name || 'item'}.`;
    }

    public async pickupCombatLoot(instanceId: string) {
        if (!this.state.location.combatLoot) return;

        const itemIndex = this.state.location.combatLoot.findIndex(i => i.instanceId === instanceId);
        if (itemIndex === -1) return;

        const item = this.state.location.combatLoot[itemIndex];
        const currentWeight = this.state.character.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
        const itemWeight = item.weight * (item.quantity || 1);
        const maxWeight = (this.state.character.stats.STR || 10) * 15;

        if (currentWeight + itemWeight > maxWeight) {
            this.addCombatLog(`Too heavy! You cannot carry any more.`);
            return;
        }

        // Fix: Strict Backup Parity for Loot
        const typeLower = item.type.toLowerCase();

        // Original logic: items are stackable if NOT weapon/armor/shield
        const isStackable = !['weapon', 'armor', 'shield', 'ring', 'amulet', 'cloak', 'belt', 'boots', 'gloves', 'bracers', 'helmet'].some(t => typeLower.includes(t));

        // Use name as ID for stackables if not already set (parity with addItem)
        // CRITICAL FIX: ALL items must use name as ID for DataManager lookups (Legacy Architecture)
        const targetId = item.name;

        // Only stack if it's stackable
        const existing = this.state.character.inventory.items.find(i => i.id === targetId && isStackable);

        if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        } else {
            if (this.state.character.inventory.items.length >= 20) {
                this.addCombatLog(`Not enough space in your inventory!`);
                return;
            }

            // Normalizing ID to name for ALL items to ensure DataManager compatibility
            const newItem = { ...item, equipped: false };
            newItem.id = item.name; // Force Template ID

            // Ensure instanceId is unique if missing (though LootEngine usually provides it)
            if (!newItem.instanceId) {
                newItem.instanceId = `${item.name.toLowerCase().replace(/ /g, '_')}_${Date.now()}`;
            }

            this.state.character.inventory.items.push(newItem);
        }

        this.state.location.combatLoot.splice(itemIndex, 1);
        this.addCombatLog(`Picked up ${item.name}.`);
        await this.emitStateUpdate();
        EventBusManager.publish('ITEM_ACQUIRED', { itemId: item.name, quantity: item.quantity || 1 });
    }

    public async addItem(itemName: string, count: number = 1): Promise<string> {
        const item = DataManager.getItem(itemName);
        if (!item) return `Item "${itemName}" not found.`;

        const char = this.state.character;

        const typeLower = item.type.toLowerCase();
        // Fix: Strict Backup Parity
        const isStackable = !['weapon', 'armor', 'shield', 'ring', 'amulet', 'cloak', 'belt', 'boots', 'gloves', 'bracers', 'helmet'].some(t => typeLower.includes(t));

        // CRITICAL FIX: Check by name-as-id for strict parity.
        // Even non-stackables use ID=Name in this legacy architecture.
        // But for stacking, we only care if isStackable is true.
        const existingItem = char.inventory.items.find(i => i.id === item.name);

        if (existingItem && isStackable) {
            existingItem.quantity = (existingItem.quantity || 1) + count;
        } else {
            // Count how many new slots are needed
            const newSlotsNeeded = isStackable ? 1 : count;
            if (char.inventory.items.length + newSlotsNeeded > 20) {
                return "Not enough space in your inventory!";
            }

            for (let i = 0; i < count; i++) {
                // Fix: Use item name as ID for ALL items (Legacy Architecture)
                // This ensures DataManager.getItem(id) works for CombatOrchestrator
                const newId = item.name;

                char.inventory.items.push({
                    ...item,
                    id: newId, // Template ID
                    quantity: 1,
                    equipped: false,
                    instanceId: `dev_${Date.now()}_${i}` // Unique Instance ID
                });

                // Backup logic for loop count:
                // if stackable, we execute loop once (additions=1) with full quantity.
                // if not, loop 'count' times with qty 1.
                if (isStackable) break;
            }
            // Fix: If stackable and new, ensure quantity is correct
            if (isStackable) {
                const added = char.inventory.items.find(i => i.id === item.name);
                if (added) added.quantity = count;
            }
        }

        await this.emitStateUpdate();
        EventBusManager.publish('ITEM_ACQUIRED', { itemId: item.name, quantity: count });
        return `Added ${count}x ${item.name} to inventory.`;
    }

    public async recalculateAC() {
        EquipmentEngine.recalculateAC(this.state.character);
        await this.emitStateUpdate();
    }

    public hasItem(itemName: string): boolean {
        return this.state.character.inventory.items.some(i => i.name === itemName);
    }

    public async consumeCharge(itemName: string): Promise<boolean> {
        const item = this.state.character.inventory.items.find(i => i.name === itemName);
        if (!item || (item.charges ?? 0) <= 0) return false;

        item.charges = (item.charges ?? 0) - 1;
        if (item.charges <= 0) {
            const index = this.state.character.inventory.items.indexOf(item);
            this.state.character.inventory.items.splice(index, 1);
        }

        await this.emitStateUpdate();
        EventBusManager.publish('ITEM_LOST', { itemId: item.name, quantity: 1 });
        return true;
    }

    public async consumeQuantity(itemName: string, count: number): Promise<boolean> {
        const item = this.state.character.inventory.items.find(i => i.name === itemName);
        if (!item || (item.quantity ?? 1) < count) return false;

        item.quantity = (item.quantity ?? 1) - count;
        if (item.quantity <= 0) {
            const index = this.state.character.inventory.items.indexOf(item);
            this.state.character.inventory.items.splice(index, 1);
        }

        await this.emitStateUpdate();
        EventBusManager.publish('ITEM_LOST', { itemId: item.name, quantity: count });
        return true;
    }
}
