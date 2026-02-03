export class EquipmentEngine {
    /**
     * Equips an item into a specific slot.
     */
    static equipItem(pc, slot, item) {
        // 1. Validate slot compatibility
        if (!this.isSlotCompatible(slot, item.type)) {
            return `Item ${item.name} cannot be equipped in slot ${slot}.`;
        }
        // 2. Handle unequipped old item if exists
        const oldItemId = pc.equipmentSlots[slot];
        if (oldItemId) {
            this.unequipItem(pc, slot);
        }
        // 3. Mark in inventory as equipped
        const inventoryItem = pc.inventory.items.find(i => i.name === item.name); // Using name as ID for now
        if (inventoryItem) {
            inventoryItem.equipped = true;
        }
        // 4. Set in slot
        pc.equipmentSlots[slot] = item.name;
        // 5. Recalculate AC (simple version)
        this.recalculateAC(pc);
        return `${item.name} equipped to ${slot}.`;
    }
    /**
     * Unequips an item from a slot.
     */
    static unequipItem(pc, slot) {
        const itemId = pc.equipmentSlots[slot];
        if (!itemId)
            return "Nothing equipped in that slot.";
        // 1. Mark in inventory as unequipped
        const inventoryItem = pc.inventory.items.find(i => i.name === itemId);
        if (inventoryItem) {
            inventoryItem.equipped = false;
        }
        // 2. Clear slot
        pc.equipmentSlots[slot] = undefined;
        // 3. Recalculate AC
        this.recalculateAC(pc);
        return `${itemId} unequipped.`;
    }
    static isSlotCompatible(slot, itemType) {
        if (slot === 'armor' && itemType === 'Armor')
            return true;
        if (slot === 'mainHand' && (itemType === 'Weapon' || itemType === 'Shield'))
            return true;
        if (slot === 'offHand' && (itemType === 'Weapon' || itemType === 'Shield'))
            return true;
        if (slot === 'head' || slot === 'cloak' || slot === 'feet' || slot === 'hands' || slot === 'ring1' || slot === 'ring2') {
            return itemType === 'Magic Item' || itemType === 'Adventuring Gear';
        }
        return false;
    }
    static recalculateAC(pc) {
        const dexMod = Math.floor(((pc.stats['DEX'] || 10) - 10) / 2);
        let finalAC = 10 + dexMod; // Default unarmored
        let shieldBonus = 0;
        let otherBonus = 0;
        // Find equipped items
        const equippedItems = pc.inventory.items.filter(i => i.equipped);
        // 1. Check for Armor
        const armorItem = pc.inventory.items.find(i => i.equipped && pc.equipmentSlots.armor === i.name);
        if (armorItem) {
            // In a real system, we'd load the full item data. 
            // For now, we'll use a heuristic or look for 'acCalculated' if we had the full Item object.
            // Since we only have the inventory item summary, we simulate the logic:
            if (armorItem.name.includes('Plate'))
                finalAC = 18;
            else if (armorItem.name.includes('Chain Shirt'))
                finalAC = 13 + Math.min(2, dexMod);
            else if (armorItem.name.includes('Leather'))
                finalAC = 11 + dexMod;
            else
                finalAC = 10 + dexMod;
        }
        // 2. Check for Shield
        const shieldItem = pc.inventory.items.find(i => i.equipped &&
            (pc.equipmentSlots.mainHand === i.name || pc.equipmentSlots.offHand === i.name) &&
            i.name.includes('Shield'));
        if (shieldItem)
            shieldBonus = 2;
        // 3. Misc Modifiers (from Magic Items etc if we had details)
        pc.ac = finalAC + shieldBonus + otherBonus;
    }
}
