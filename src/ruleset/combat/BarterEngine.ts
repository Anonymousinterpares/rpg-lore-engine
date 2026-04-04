import { GameState } from '../schemas/FullSaveStateSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { DataManager } from '../data/DataManager';
import { EquipmentEngine } from './EquipmentEngine';

/**
 * BarterEngine — handles item exchange between player and companions.
 *
 * Personality-driven valuation: companions evaluate trades based on
 * class usefulness, traits, and relationship standing.
 */

export interface BarterOffer {
    playerOffersInstanceId: string;
    playerRequestsInstanceId: string;
}

export interface BarterResult {
    success: boolean;
    message: string;
}

/**
 * How much a companion values an item (0-100 scale).
 * Based on class, role, and item type.
 */
function evaluateItemValue(item: any, companionClass: string, traits: string[]): number {
    let value = 50; // Base neutral value

    const type = (item.type || '').toLowerCase();
    const name = (item.name || item.id || '').toLowerCase();

    // Class-based preferences
    const classPrefs: Record<string, string[]> = {
        'Fighter':   ['weapon', 'armor', 'shield'],
        'Barbarian': ['weapon', 'armor'],
        'Rogue':     ['weapon', 'tool', 'poison'],
        'Ranger':    ['weapon', 'ammunition', 'armor'],
        'Wizard':    ['scroll', 'wand', 'staff', 'component', 'book', 'potion'],
        'Warlock':   ['wand', 'staff', 'component', 'potion'],
        'Cleric':    ['armor', 'shield', 'holy', 'potion'],
        'Druid':     ['staff', 'herb', 'potion', 'leather'],
        'Bard':      ['instrument', 'potion', 'scroll'],
        'Paladin':   ['weapon', 'armor', 'shield', 'holy'],
        'Monk':      ['potion'],
    };

    const prefs = classPrefs[companionClass] || [];
    if (prefs.some(p => type.includes(p) || name.includes(p))) {
        value += 25; // Class wants this type
    }

    // Trait-based modifiers
    if (traits.includes('Greed (Gold)')) value += 10; // Greedy companions want everything
    if (traits.includes('Humble') || traits.includes('Helpful')) value -= 10; // More generous
    if (traits.includes('Suspicious')) value -= 5; // Distrusts offerings

    // Rarity bonus
    const rarity = (item.rarity || '').toLowerCase();
    if (rarity === 'rare') value += 15;
    if (rarity === 'very rare' || rarity === 'legendary') value += 30;
    if (rarity === 'common') value -= 10;

    return Math.max(0, Math.min(100, value));
}

export class BarterEngine {
    /**
     * Attempts a barter between player and companion.
     * Player offers an item and requests one from the companion.
     */
    public static executeBarter(
        state: GameState,
        companionIndex: number,
        playerOffersInstanceId: string,
        playerRequestsInstanceId: string
    ): BarterResult {
        const companion = state.companions[companionIndex];
        if (!companion) return { success: false, message: 'Companion not found.' };

        const playerItem = state.character.inventory.items.find((i: any) => i.instanceId === playerOffersInstanceId);
        const compItem = companion.character.inventory.items.find((i: any) => i.instanceId === playerRequestsInstanceId);

        if (!playerItem) return { success: false, message: 'You don\'t have that item.' };
        if (!compItem) return { success: false, message: `${companion.character.name} doesn't have that item.` };

        // Evaluate the trade from the companion's perspective
        const offerValue = evaluateItemValue(playerItem, companion.character.class, companion.meta.originalTraits);
        const requestValue = evaluateItemValue(compItem, companion.character.class, companion.meta.originalTraits);

        // Standing modifier: higher standing = more generous
        const standingBonus = Math.floor((companion.meta.companionStanding || 25) / 10); // 0-10 bonus
        const effectiveOfferValue = offerValue + standingBonus;

        // Trade accepted if what they receive is worth at least 70% of what they give up
        const threshold = requestValue * 0.7;
        const accepted = effectiveOfferValue >= threshold;

        if (!accepted) {
            const diff = Math.round(threshold - effectiveOfferValue);
            return {
                success: false,
                message: `${companion.character.name} shakes their head — the trade isn't favorable enough. (Offer value: ${effectiveOfferValue}, they want: ${Math.round(threshold)}+)`
            };
        }

        // B2+B3: Clear equipped state on BOTH items before transfer
        // Player's offered item: clear from player's equipmentSlots
        const playerSlot = Object.entries(state.character.equipmentSlots || {}).find(([, v]) => v === playerOffersInstanceId);
        if (playerSlot) {
            (state.character.equipmentSlots as any)[playerSlot[0]] = undefined;
        }
        (playerItem as any).equipped = false;

        // Companion's offered item: clear from companion's equipmentSlots
        const compSlot = Object.entries(companion.character.equipmentSlots || {}).find(([, v]) => v === playerRequestsInstanceId);
        if (compSlot) {
            (companion.character.equipmentSlots as any)[compSlot[0]] = undefined;
        }
        (compItem as any).equipped = false;

        // Execute the swap
        state.character.inventory.items = state.character.inventory.items.filter((i: any) => i.instanceId !== playerOffersInstanceId);
        companion.character.inventory.items.push(playerItem as any);

        companion.character.inventory.items = companion.character.inventory.items.filter((i: any) => i.instanceId !== playerRequestsInstanceId);
        state.character.inventory.items.push(compItem as any);

        // Auto-equip for companion only (NOT player — player equips manually)
        this.tryAutoEquip(companion.character, playerItem as any);

        // Recalculate AC for both sides
        EquipmentEngine.recalculateAC(state.character);
        EquipmentEngine.recalculateAC(companion.character);

        return {
            success: true,
            message: `${companion.character.name} accepts the trade: ${(playerItem as any).name} for ${(compItem as any).name}.`
        };
    }

    /**
     * Simple gift: player gives an item to companion (no exchange).
     */
    public static giveItem(
        state: GameState,
        companionIndex: number,
        itemInstanceId: string
    ): BarterResult {
        const companion = state.companions[companionIndex];
        if (!companion) return { success: false, message: 'Companion not found.' };

        const item = state.character.inventory.items.find((i: any) => i.instanceId === itemInstanceId);
        if (!item) return { success: false, message: 'Item not found.' };

        // Check companion inventory capacity (STR * 15 lbs, max 20 slots)
        if (companion.character.inventory.items.length >= 20) {
            return { success: false, message: `${companion.character.name}'s inventory is full (20 slots).` };
        }
        const currentWeight = companion.character.inventory.items.reduce((sum: number, i: any) => sum + (i.weight || 0) * (i.quantity || 1), 0);
        const capacity = (companion.character.stats?.STR || 10) as number * 15;
        if (currentWeight + ((item as any).weight || 0) > capacity) {
            return { success: false, message: `${companion.character.name} can't carry any more (${currentWeight}/${capacity} lbs).` };
        }

        // Clear player's equipped state if giving an equipped item
        const giveSlot = Object.entries(state.character.equipmentSlots || {}).find(([, v]) => v === itemInstanceId);
        if (giveSlot) {
            (state.character.equipmentSlots as any)[giveSlot[0]] = undefined;
            EquipmentEngine.recalculateAC(state.character);
        }
        (item as any).equipped = false;

        // Transfer
        state.character.inventory.items = state.character.inventory.items.filter((i: any) => i.instanceId !== itemInstanceId);
        companion.character.inventory.items.push(item as any);

        // Auto-equip for companion only (NOT player)
        this.tryAutoEquip(companion.character, item as any);

        return {
            success: true,
            message: `You give ${(item as any).name} to ${companion.character.name}.`
        };
    }

    /**
     * Take an item from companion (companion must agree based on standing).
     */
    public static takeItem(
        state: GameState,
        companionIndex: number,
        itemInstanceId: string
    ): BarterResult {
        const companion = state.companions[companionIndex];
        if (!companion) return { success: false, message: 'Companion not found.' };

        const item = companion.character.inventory.items.find((i: any) => i.instanceId === itemInstanceId);
        if (!item) return { success: false, message: `${companion.character.name} doesn't have that.` };

        // Requires standing >= 20 to take items
        if ((companion.meta.companionStanding || 25) < 20) {
            return { success: false, message: `${companion.character.name} refuses to hand over their gear. (Needs standing 20+)` };
        }

        // Auto-unequip if item is equipped on companion side
        const equippedSlot = Object.entries(companion.character.equipmentSlots || {}).find(([, v]) => v === (item as any).instanceId);
        if (equippedSlot) {
            (companion.character.equipmentSlots as any)[equippedSlot[0]] = undefined;
        }
        // B1: Clear the equipped flag so player receives an unequipped item
        (item as any).equipped = false;

        // Recalculate companion AC after losing equipment
        EquipmentEngine.recalculateAC(companion.character);

        // Transfer — item arrives at player as UNEQUIPPED (player must manually equip)
        companion.character.inventory.items = companion.character.inventory.items.filter((i: any) => i.instanceId !== itemInstanceId);
        state.character.inventory.items.push(item as any);

        // D2: Re-evaluate companion equipment — promote backup items to empty slots
        this.reEvaluateEquipment(companion.character);

        return {
            success: true,
            message: `${companion.character.name} hands over ${(item as any).name}.`
        };
    }

    /**
     * Auto-equips an item for a companion if the appropriate slot is empty.
     * Respects two-handed weapon constraints.
     * Only equips to empty slots — never replaces existing equipment.
     */
    private static tryAutoEquip(char: PlayerCharacter, item: any): void {
        const type = (item.type || '').toLowerCase();
        const slots = char.equipmentSlots as Record<string, string | undefined>;
        const props = item.properties || (DataManager.getItem(item.id || item.name) as any)?.properties || [];
        const isTwoHanded = props.some((p: string) => /two.?handed/i.test(p));

        // F2: Class proficiency check — don't auto-equip martial weapons for caster classes
        const isMartialWeapon = type.includes('martial');
        const casterClasses = ['Wizard', 'Sorcerer', 'Warlock', 'Druid'];
        if (isMartialWeapon && casterClasses.includes(char.class)) return;

        // Don't auto-equip heavy armor for classes that can't wear it
        const isHeavyArmor = type.includes('heavy');
        const noHeavyArmor = ['Wizard', 'Sorcerer', 'Warlock', 'Monk', 'Rogue', 'Ranger', 'Bard'];
        if (isHeavyArmor && noHeavyArmor.includes(char.class)) return;

        let targetSlot: string | undefined;

        if (type.includes('weapon') || type.includes('weapon (')) {
            if (!slots.mainHand) {
                targetSlot = 'mainHand';
                // If two-handed, also need offHand to be free
                if (isTwoHanded && slots.offHand) targetSlot = undefined;
            }
        } else if (type.includes('armor') || type.includes('armor (')) {
            if (!slots.armor) targetSlot = 'armor';
        } else if (type.includes('shield')) {
            // Can't equip shield if mainHand is two-handed
            if (!slots.offHand) {
                const mainHandItem = slots.mainHand
                    ? char.inventory.items.find((i: any) => i.instanceId === slots.mainHand)
                    : null;
                // Prefer item's own properties
                const mainProps = (mainHandItem as any)?.properties || (DataManager.getItem((mainHandItem as any)?.id || (mainHandItem as any)?.name) as any)?.properties || [];
                const mainIsTwoHanded = mainProps.some((p: string) => /two.?handed/i.test(p));
                if (!mainIsTwoHanded) targetSlot = 'offHand';
            }
        }

        if (targetSlot) {
            // If equipping two-handed to mainHand, clear offHand
            if (targetSlot === 'mainHand' && isTwoHanded && slots.offHand) {
                const offItem = char.inventory.items.find((i: any) => i.instanceId === slots.offHand);
                if (offItem) (offItem as any).equipped = false;
                slots.offHand = undefined;
            }

            slots[targetSlot] = item.instanceId;
            item.equipped = true;
            EquipmentEngine.recalculateAC(char);
        }
    }

    /**
     * Re-evaluates companion equipment after an item is removed.
     * If a slot became empty, looks for a suitable replacement in inventory.
     */
    public static reEvaluateEquipment(char: PlayerCharacter): void {
        const slots = char.equipmentSlots as Record<string, string | undefined>;

        for (const slotName of ['mainHand', 'armor', 'offHand']) {
            if (!slots[slotName]) {
                // Find an unequipped item that could go in this slot
                const candidate = char.inventory.items.find((item: any) => {
                    if (item.equipped) return false;
                    const t = (item.type || '').toLowerCase();
                    if (slotName === 'mainHand' && (t.includes('weapon'))) return true;
                    if (slotName === 'armor' && (t.includes('armor'))) return true;
                    if (slotName === 'offHand' && (t.includes('shield'))) return true;
                    return false;
                });
                if (candidate) {
                    BarterEngine.tryAutoEquip(char, candidate);
                }
            }
        }
    }
}
