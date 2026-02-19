import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';

export class EquipmentEngine {
    /**
     * Equips an item into a specific slot.
     */
    public static equipItem(pc: PlayerCharacter, slot: string, item: Item): string {
        // 1. Validate slot compatibility
        if (!this.isSlotCompatible(slot, item.type)) {
            return `Item ${item.name} cannot be equipped in slot ${slot}.`;
        }

        // 2. Handle unequipped old item if exists
        const oldItemId = (pc.equipmentSlots as any)[slot];
        if (oldItemId) {
            this.unequipItem(pc, slot);
        }

        // 3. Mark in inventory as equipped
        const inventoryItem = pc.inventory.items.find(i => i.name === item.name); // Using name as ID for now
        if (inventoryItem) {
            inventoryItem.equipped = true;
        }

        // 4. Set in slot
        (pc.equipmentSlots as any)[slot] = item.name;

        // 5. Recalculate AC (simple version)
        this.recalculateAC(pc);

        return `${item.name} equipped to ${slot}.`;
    }

    /**
     * Unequips an item from a slot.
     */
    public static unequipItem(pc: PlayerCharacter, slot: string): string {
        const itemId = (pc.equipmentSlots as any)[slot];
        if (!itemId) return "Nothing equipped in that slot.";

        // 1. Mark in inventory as unequipped
        const inventoryItem = pc.inventory.items.find(i => i.name === itemId);
        if (inventoryItem) {
            inventoryItem.equipped = false;
        }

        // 2. Clear slot
        (pc.equipmentSlots as any)[slot] = undefined;

        // 3. Recalculate AC
        this.recalculateAC(pc);

        return `${itemId} unequipped.`;
    }

    private static isSlotCompatible(slot: string, itemType: string): boolean {
        if (slot === 'armor' && itemType === 'Armor') return true;
        if (slot === 'mainHand' && (itemType === 'Weapon' || itemType === 'Shield')) return true;
        if (slot === 'offHand' && (itemType === 'Weapon' || itemType === 'Shield')) return true;
        if (slot === 'head' || slot === 'cloak' || slot === 'feet' || slot === 'hands' || slot === 'ring1' || slot === 'ring2') {
            return itemType === 'Magic Item' || itemType === 'Adventuring Gear';
        }
        return false;
    }

    private static readonly ARMOR_TABLE: Record<string, { baseAC: number, maxDex: number }> = {
        'padded': { baseAC: 11, maxDex: Infinity },
        'leather': { baseAC: 11, maxDex: Infinity },
        'studded leather': { baseAC: 12, maxDex: Infinity },
        'hide': { baseAC: 12, maxDex: 2 },
        'chain shirt': { baseAC: 13, maxDex: 2 },
        'scale mail': { baseAC: 14, maxDex: 2 },
        'breastplate': { baseAC: 14, maxDex: 2 },
        'half plate': { baseAC: 15, maxDex: 2 },
        'ring mail': { baseAC: 14, maxDex: 0 },
        'chain mail': { baseAC: 16, maxDex: 0 },
        'splint': { baseAC: 17, maxDex: 0 },
        'plate': { baseAC: 18, maxDex: 0 }
    };

    private static recalculateAC(pc: PlayerCharacter) {
        const dexMod = Math.floor(((pc.stats['DEX'] || 10) - 10) / 2);
        let baseAC = 10 + dexMod; // Default unarmored
        let shieldBonus = 0;

        // 1. Check for Armor
        const armorItemName = (pc.equipmentSlots as any).armor;
        if (armorItemName) {
            const normalizedName = armorItemName.toLowerCase().replace(/_/g, ' ');
            const armorData = this.ARMOR_TABLE[normalizedName];

            if (armorData) {
                baseAC = armorData.baseAC + Math.min(dexMod, armorData.maxDex);
            } else {
                // Fallback for custom or unknown armor: try to parse numeric if available in item data
                // In our current system, we default to unarmored if not in table
                baseAC = 10 + dexMod;
            }
        }

        // 2. Check for Shield in either hand
        const mainHandItem = (pc.equipmentSlots as any).mainHand;
        const offHandItem = (pc.equipmentSlots as any).offHand;

        const hasShield = (name?: string) => name && name.toLowerCase().includes('shield');

        if (hasShield(mainHandItem) || hasShield(offHandItem)) {
            shieldBonus = 2;
        }

        pc.ac = baseAC + shieldBonus;
    }
}
