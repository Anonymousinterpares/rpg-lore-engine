import { GameState } from '../../schemas/FullSaveStateSchema';
import { DataManager } from '../../data/DataManager';
import { MechanicsEngine } from '../MechanicsEngine';
import { EquipmentEngine } from '../EquipmentEngine';

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
        const isStackable = !['weapon', 'armor', 'shield'].some(t => typeLower.includes(t));

        // Use name as ID for stackables if not already set (parity with addItem)
        // But for pickup, we trust item.id might already be correct from world generation?
        // Actually, backup just checked i.id === item.id. 
        // If an item on ground was created via addItem logic, its ID should already be the name if stackable.
        // However, to be safe and match `addItem` parity:

        const existingItem = char.inventory.items.find(i => i.id === item.id);

        if (existingItem && isStackable) {
            existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
        } else {
            char.inventory.items.push({ ...item, equipped: false });
        }

        droppedItems.splice(itemIndex, 1);
        await this.emitStateUpdate();
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
        return `Dropped ${item.name}.`;
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
            await this.emitStateUpdate();
            return `Unequipped ${item.name}.`;
        } else {
            const type = (item.type || '').toLowerCase();
            let slot = '';

            if (type.includes('weapon')) slot = 'mainHand';
            else if (type.includes('armor')) slot = 'armor';
            else if (type.includes('shield')) slot = 'offHand';

            if (!slot) return `${item.name} cannot be equipped.`;

            // NEW: Hardware validation (STR requirements, etc.)
            const validation = EquipmentEngine.validateEquip(char, item as any);
            if (!validation.valid) {
                const errorMsg = `${item.name} cannot be equipped: ${validation.reason}`;
                this.addCombatLog(errorMsg); // Ensure it shows in combat log if triggered
                return errorMsg;
            }

            const slots = char.equipmentSlots as Record<string, string | undefined>;
            const currentInSlotId = slots[slot];
            if (currentInSlotId) {
                const currentItem = char.inventory.items.find(i => i.instanceId === currentInSlotId);
                if (currentItem) currentItem.equipped = false;
            }

            slots[slot] = instanceId;
            item.equipped = true;

            if (slot === 'armor' || slot === 'offHand') {
                await this.recalculateAC();
            }

            await this.emitStateUpdate();
            return `Equipped ${item.name}.`;
        }
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
        const isStackable = !['weapon', 'armor', 'shield'].some(t => typeLower.includes(t));

        // Use name as ID for stackables if not already set (parity with addItem)
        // CRITICAL FIX: ALL items must use name as ID for DataManager lookups (Legacy Architecture)
        const targetId = item.name;

        // Only stack if it's stackable
        const existing = this.state.character.inventory.items.find(i => i.id === targetId && isStackable);

        if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        } else {
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
    }

    public async addItem(itemName: string, count: number = 1): Promise<string> {
        const item = DataManager.getItem(itemName);
        if (!item) return `Item "${itemName}" not found.`;

        const char = this.state.character;

        const typeLower = item.type.toLowerCase();
        // Fix: Strict Backup Parity
        const isStackable = !['weapon', 'armor', 'shield'].some(t => typeLower.includes(t));

        // CRITICAL FIX: Check by name-as-id for strict parity.
        // Even non-stackables use ID=Name in this legacy architecture.
        // But for stacking, we only care if isStackable is true.
        const existingItem = char.inventory.items.find(i => i.id === item.name);

        if (existingItem && isStackable) {
            existingItem.quantity = (existingItem.quantity || 1) + count;
        } else {
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
        return `Added ${count}x ${item.name} to inventory.`;
    }

    public async recalculateAC() {
        const char = this.state.character;
        let baseAC = 10 + Math.floor(((char.stats.DEX || 10) - 10) / 2);
        // Future: add armor bonuses here
        this.state.character.ac = baseAC;
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
        return true;
    }
}
