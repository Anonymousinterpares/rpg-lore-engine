import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';

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
    public static addItem(pc: PlayerCharacter, item: { id: string, name: string, weight: number, quantity?: number }) {
        const existing = pc.inventory.items.find(i => i.id === item.id);
        if (existing) {
            existing.quantity += item.quantity || 1;
        } else {
            pc.inventory.items.push({
                ...item,
                quantity: item.quantity || 1,
                equipped: false
            });
        }
    }

    /**
     * Toggles equipment status
     */
    public static toggleEquip(pc: PlayerCharacter, itemId: string): string {
        const item = pc.inventory.items.find(i => i.id === itemId);
        if (!item) return 'Item not found.';

        item.equipped = !item.equipped;
        return `${item.name} is now ${item.equipped ? 'Equipped' : 'Unequipped'}.`;
    }
}
