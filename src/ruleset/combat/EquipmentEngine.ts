import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';
import { MechanicsEngine } from './MechanicsEngine';
import { CombatConstants } from './CombatConstants';

export class EquipmentEngine {
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

    /**
     * Validates if an item can be equipped by the character.
     * Returns { valid: boolean, reason?: string }
     */
    public static validateEquip(pc: PlayerCharacter, item: Item): { valid: boolean, reason?: string } {
        // 1. Strength Requirements
        const effectiveStr = MechanicsEngine.getEffectiveStat(pc, 'STR');
        let requiredStr = 0;

        // A. Check for explicit STR_REQ modifier
        const strMod = (item as any).modifiers?.find((m: any) => m.type === 'StatBonus' && m.target === 'STR_REQ');
        if (strMod) {
            requiredStr = strMod.value;
        }
        // B. Fallback to default "Heavy" tag logic if no explicit modifier
        else if ((item as any).properties?.some((p: string) => p.toLowerCase() === 'heavy')) {
            requiredStr = CombatConstants.HEAVY_WEAPON_STR_REQ;
        }
        // C. Check armor-specific strengthReq field
        else if (item.type === 'Armor' && (item as any).strengthReq) {
            requiredStr = (item as any).strengthReq;
        }

        if (effectiveStr < requiredStr) {
            return { valid: false, reason: `Requires Strength ${requiredStr}` };
        }

        return { valid: true };
    }

    /**
     * Public wrapper for UI checks.
     */
    public static canEquip(pc: PlayerCharacter, item: Item): { valid: boolean, reason?: string } {
        return this.validateEquip(pc, item);
    }

    /**
     * Equips an item into a specific slot.
     */
    public static equipItem(pc: PlayerCharacter, slot: string, item: Item): string {
        // 1. Validate slot compatibility
        if (!this.isSlotCompatible(slot, item.type)) {
            return `Item ${item.name} cannot be equipped in slot ${slot}.`;
        }

        // 2. Validate requirements (Strength, etc.)
        const validation = this.validateEquip(pc, item);
        if (!validation.valid) {
            return `${item.name} cannot be equipped: ${validation.reason}`;
        }

        // 3. Handle unequipped old item if exists
        const oldItemId = (pc.equipmentSlots as any)[slot];
        if (oldItemId) {
            this.unequipItem(pc, slot);
        }

        // 4. Mark in inventory as equipped
        const inventoryItem = pc.inventory.items.find(i => i.name === item.name); // Using name as ID for now
        if (inventoryItem) {
            inventoryItem.equipped = true;
        }

        // 5. Set in slot
        (pc.equipmentSlots as any)[slot] = item.name;

        // 6. Recalculate AC
        this.recalculateAC(pc);

        return `${item.name} equipped to ${slot}.`;
    }

    /**
     * Unequips an item from a slot.
     */
    public static unequipItem(pc: PlayerCharacter, slot: string): void {
        const itemId = (pc.equipmentSlots as any)[slot];
        if (itemId) {
            const inventoryItem = pc.inventory.items.find(i => i.name === itemId);
            if (inventoryItem) inventoryItem.equipped = false;
            (pc.equipmentSlots as any)[slot] = undefined;
            this.recalculateAC(pc);
        }
    }

    /**
     * Checks if an item type is compatible with a slot.
     */
    public static isSlotCompatible(slot: string, type: string): boolean {
        const typeLower = type.toLowerCase();
        if (slot === 'armor') return typeLower.includes('armor');
        if (slot === 'mainHand') return typeLower.includes('weapon');
        if (slot === 'offHand') return typeLower.includes('shield') || typeLower.includes('weapon');
        return false;
    }

    /**
     * Recalculates Armor Class based on equipment.
     */
    public static recalculateAC(pc: PlayerCharacter): void {
        const dexMod = MechanicsEngine.getModifier(pc.stats.DEX || 10);
        let baseAC = 10 + dexMod;
        let shieldBonus = 0;

        // 1. Check Armor Slot
        const armorItemName = (pc.equipmentSlots as any).armor;
        if (armorItemName) {
            const normalizedName = armorItemName.toLowerCase().replace(/_/g, ' ');
            const armorData = this.ARMOR_TABLE[normalizedName];

            if (armorData) {
                baseAC = armorData.baseAC + Math.min(dexMod, armorData.maxDex);
            } else {
                // Fallback for custom or unknown armor: try to parse numeric if available in item data
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
