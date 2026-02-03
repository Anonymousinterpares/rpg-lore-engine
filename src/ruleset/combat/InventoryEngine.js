export class InventoryEngine {
    /**
     * Calculates current inventory weight and capacity status
     */
    static getEncumbrance(pc) {
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
    static addItem(pc, item) {
        const existing = pc.inventory.items.find(i => i.id === item.id);
        if (existing && !['weapon', 'armor', 'shield'].some(t => (item.type || '').toLowerCase().includes(t))) {
            existing.quantity += item.quantity || 1;
        }
        else {
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
    static toggleEquip(pc, itemId) {
        const item = pc.inventory.items.find(i => i.id === itemId);
        if (!item)
            return 'Item not found.';
        item.equipped = !item.equipped;
        return `${item.name} is now ${item.equipped ? 'Equipped' : 'Unequipped'}.`;
    }
}
