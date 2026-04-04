import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { EquipmentEngine } from './EquipmentEngine';

export interface EncumbranceStatus {
    currentWeight: number;
    capacity: number;
    isEncumbered: boolean;
    statusEffect: string | null;
}

export class InventoryEngine {
    /**
     * Calculates current inventory weight and capacity status
     */
    public static getEncumbrance(pc: PlayerCharacter): EncumbranceStatus {
        const currentWeight = pc.inventory.items.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
        const strScore = pc.stats['STR'] || 10;
        const capacity = strScore * 15;

        let statusEffect = null;
        if (currentWeight > capacity) {
            statusEffect = 'Encumbered: Speed drops to 5ft.';
        }

        return {
            currentWeight,
            capacity,
            isEncumbered: currentWeight > capacity,
            statusEffect
        };
    }

    /**
     * Adds an item to the inventory
     */
    public static addItem(pc: PlayerCharacter, item: { id: string, name: string, weight: number, type?: string, quantity?: number }) {
        const existing = pc.inventory.items.find(i => i.id === item.id);
        if (existing && !['weapon', 'armor', 'shield'].some(t => (item.type || '').toLowerCase().includes(t))) {
            existing.quantity += item.quantity || 1;
        } else {
            pc.inventory.items.push({
                ...item,
                instanceId: crypto.randomUUID(),
                type: item.type || 'Misc',
                quantity: item.quantity || 1,
                equipped: false
            });
        }
    }

    /**
     * Toggles equipment status
     */
    public static toggleEquip(pc: PlayerCharacter, itemId: string): string {
        const item = pc.inventory.items.find(i => i.id === itemId || i.instanceId === itemId);
        if (!item) return 'Item not found.';

        const slots = pc.equipmentSlots as Record<string, string | undefined>;

        if (item.equipped) {
            // Unequip: clear from slots
            item.equipped = false;
            for (const [slot, val] of Object.entries(slots)) {
                if (val === item.instanceId || val === item.name) {
                    slots[slot] = undefined;
                }
            }
        } else {
            // Equip: find appropriate slot (delegate to InventoryManager pattern)
            const type = (item.type || '').toLowerCase();
            let slot: string | undefined;
            if (type.includes('weapon')) slot = 'mainHand';
            else if (type.includes('armor')) slot = 'armor';
            else if (type.includes('shield')) slot = 'offHand';

            if (slot) {
                // Clear old item in slot
                const oldId = slots[slot];
                if (oldId) {
                    const oldItem = pc.inventory.items.find(i => i.instanceId === oldId);
                    if (oldItem) oldItem.equipped = false;
                }
                slots[slot] = item.instanceId;
                item.equipped = true;
            } else {
                item.equipped = true; // Generic equip for non-slotted items
            }
        }

        EquipmentEngine.recalculateAC(pc);
        return `${item.name} is now ${item.equipped ? 'Equipped' : 'Unequipped'}.`;
    }
}
