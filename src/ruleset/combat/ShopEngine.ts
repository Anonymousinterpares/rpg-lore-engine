import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';
import { CurrencyEngine, Currency } from './CurrencyEngine';
import { Dice } from './Dice';

export interface ShopState {
    inventory: Item[];
    markup: number; // multiplier for buy price (e.g. 1.0)
    discount: number; // current discount from negotiation (e.g. 0.1 for 10%)
    isOpen: boolean;
}

export class ShopEngine {
    /**
     * Attempts to negotiate a better price.
     * success: multiplier to adjust prices (e.g. 0.9 for 10% discount)
     */
    public static negotiate(pc: PlayerCharacter, charismaBonus: number, shop: ShopState): { success: boolean, message: string } {
        if (!shop.isOpen) return { success: false, message: "Shop is closed." };

        const roll = Dice.d20() + charismaBonus;
        const dc = 15; // Standard DC

        if (roll >= dc) {
            const shift = 0.1 + (Math.random() * 0.1); // 10% to 20%
            shop.discount = shift;
            return {
                success: true,
                message: `Success! The merchant is impressed. You get a ${Math.round(shift * 100)}% better deal! (${roll} vs ${dc})`
            };
        } else if (roll < 10) {
            shop.isOpen = false;
            return {
                success: false,
                message: `Failure! You offended the merchant. They closed the shop! (${roll} vs ${dc})`
            };
        } else {
            return {
                success: false,
                message: `The merchant remains firm on their prices. (${roll} vs ${dc})`
            };
        }
    }

    /**
     * Calculates the adjusted price for buying an item.
     */
    public static getBuyPrice(item: Item, shop: ShopState): Currency {
        const baseValue = CurrencyEngine.toCopper(item.cost);
        const adjustedValue = Math.ceil(baseValue * (shop.markup - shop.discount));
        return CurrencyEngine.fromCopper(adjustedValue);
    }

    /**
     * Calculates the adjusted price for selling an item.
     */
    public static getSellPrice(item: Item, shop: ShopState): Currency {
        const baseValue = CurrencyEngine.toCopper(item.cost);
        // Standard sell is 50%, negotiation increases it
        const adjustedValue = Math.floor(baseValue * (0.5 + shop.discount));
        return CurrencyEngine.fromCopper(adjustedValue);
    }

    /**
     * Processes a purchase.
     */
    public static buyItem(pc: PlayerCharacter, item: Item, shop: ShopState): string {
        if (!shop.isOpen) return "Shop is closed.";

        const price = this.getBuyPrice(item, shop);

        if (!CurrencyEngine.canAfford(pc.inventory.gold, price)) {
            return `Insufficient funds. Needed ${CurrencyEngine.format(price)}, but you have ${CurrencyEngine.format(pc.inventory.gold)}.`;
        }

        const newGold = CurrencyEngine.subtract(pc.inventory.gold, price);
        if (newGold) {
            pc.inventory.gold = newGold;
            pc.inventory.items.push({
                id: Math.random().toString(36).substr(2, 9),
                name: item.name,
                weight: item.weight,
                quantity: 1,
                equipped: false
            });
            return `Purchased ${item.name} for ${CurrencyEngine.format(price)}.`;
        }

        return "Transaction failed.";
    }

    /**
     * Processes a sale.
     */
    public static sellItem(pc: PlayerCharacter, inventoryItemId: string, shop: ShopState, fullItemData: Item): string {
        if (!shop.isOpen) return "Shop is closed.";

        const price = this.getSellPrice(fullItemData, shop);

        const index = pc.inventory.items.findIndex(i => i.id === inventoryItemId);
        if (index === -1) return "Item not found in inventory.";

        pc.inventory.items.splice(index, 1);
        pc.inventory.gold = CurrencyEngine.add(pc.inventory.gold, price);

        return `Sold ${fullItemData.name} for ${CurrencyEngine.format(price)}.`;
    }
}
