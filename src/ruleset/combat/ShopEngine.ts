import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';
import { CurrencyEngine, Currency } from './CurrencyEngine';
import { Dice } from './Dice';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { RelationshipState } from '../schemas/RelationshipSchema';

export interface ShopState {
    inventory: Item[];
    markup: number; // multiplier for buy price (e.g. 1.0)
    discount: number; // current discount from negotiation (e.g. 0.1 for 10%)
    isOpen: boolean;
}

export class ShopEngine {
    /**
     * Attempts to negotiate a better price.
     */
    public static negotiate(pc: PlayerCharacter, charismaBonus: number, npc: WorldNPC): { success: boolean, message: string } {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return { success: false, message: "Shop is closed." };

        const standing = npc.relationship.standing;
        if (standing <= -25) return { success: false, message: "The merchant refuses to speak with you." };

        const roll = Dice.d20() + charismaBonus;
        // DC decreases as standing increases
        let dc = 15;
        if (standing >= 25) dc = 12;
        if (standing >= 75) dc = 10;

        if (roll >= dc) {
            const shift = 0.05 + (Math.random() * 0.1); // 5% to 15% extra discount
            npc.shopState.discount += shift;

            // Negotiation success slightly improves relationship
            this.updateRelationship(npc, "Successful negotiation", 2);

            return {
                success: true,
                message: `Success! The merchant is impressed. You get a ${Math.round(shift * 100)}% better deal! (${roll} vs ${dc})`
            };
        } else if (roll < 5) {
            // Natural 1 or very bad roll offends them
            this.updateRelationship(npc, "Offensive negotiation", -5);
            if (npc.relationship.standing <= -25) npc.shopState.isOpen = false;

            return {
                success: false,
                message: `Failure! You offended the merchant. They are losing patience. (${roll} vs ${dc})`
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
    public static getBuyPrice(item: Item, npc: WorldNPC): Currency {
        const baseValue = CurrencyEngine.toCopper(item.cost);
        const standingModifier = this.getStandingModifier(npc.relationship.standing);
        const shopMarkup = npc.shopState?.markup || 1.0;
        const shopDiscount = npc.shopState?.discount || 0.0;

        const adjustedValue = Math.ceil(baseValue * (shopMarkup - shopDiscount) * standingModifier);
        return CurrencyEngine.fromCopper(adjustedValue);
    }

    /**
     * Calculates the adjusted price for selling an item.
     */
    public static getSellPrice(item: Item, npc: WorldNPC): Currency {
        const baseValue = CurrencyEngine.toCopper(item.cost);
        const standing = npc.relationship.standing;

        // Base sell is 50%, standing improves it
        let modifier = 0.5;
        if (standing >= 25) modifier = 0.6;
        if (standing >= 75) modifier = 0.7;

        const shopDiscount = npc.shopState?.discount || 0.0;
        const adjustedValue = Math.floor(baseValue * (modifier + shopDiscount));
        return CurrencyEngine.fromCopper(adjustedValue);
    }

    /**
     * Processes a purchase.
     */
    public static buyItem(pc: PlayerCharacter, item: Item, npc: WorldNPC): string {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return "Shop is closed.";
        if (npc.relationship.standing <= -25) return "The merchant refuses to do business with you.";

        const price = this.getBuyPrice(item, npc);

        if (!CurrencyEngine.canAfford(pc.inventory.gold, price)) {
            return `Insufficient funds. Needed ${CurrencyEngine.format(price)}, but you have ${CurrencyEngine.format(pc.inventory.gold)}.`;
        }

        const newGold = CurrencyEngine.subtract(pc.inventory.gold, price);
        if (newGold) {
            pc.inventory.gold = newGold;
            pc.inventory.items.push({
                id: item.name.toLowerCase().replace(/ /g, '_'),
                instanceId: crypto.randomUUID(),
                name: item.name,
                type: item.type || 'Misc',
                weight: item.weight,
                quantity: 1,
                equipped: false
            });

            // Large purchases slightly improve relationship
            const copper = CurrencyEngine.toCopper(price);
            if (copper > 1000) { // > 10gp
                this.updateRelationship(npc, "Major purchase", 1);
            }

            return `Purchased ${item.name} for ${CurrencyEngine.format(price)}.`;
        }

        return "Transaction failed.";
    }

    /**
     * Processes a sale.
     */
    public static sellItem(pc: PlayerCharacter, inventoryItemId: string, npc: WorldNPC, fullItemData: Item): string {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return "Shop is closed.";
        if (npc.relationship.standing <= -25) return "The merchant refuses to do business with you.";

        const price = this.getSellPrice(fullItemData, npc);

        const index = pc.inventory.items.findIndex(i => i.id === inventoryItemId);
        if (index === -1) return "Item not found in inventory.";

        pc.inventory.items.splice(index, 1);
        pc.inventory.gold = CurrencyEngine.add(pc.inventory.gold, price);

        return `Sold ${fullItemData.name} for ${CurrencyEngine.format(price)}.`;
    }

    public static updateRelationship(npc: WorldNPC, event: string, delta: number) {
        npc.relationship.standing = Math.max(-100, Math.min(100, npc.relationship.standing + delta));
        npc.relationship.interactionLog.push({
            event,
            delta,
            timestamp: new Date().toISOString()
        });
        npc.relationship.lastInteraction = new Date().toISOString();
    }

    private static getStandingModifier(standing: number): number {
        if (standing >= 75) return 0.8;  // Exalted
        if (standing >= 25) return 0.9;  // Friendly
        if (standing <= -75) return 1.5; // Hostile (if they even trade)
        if (standing <= -25) return 1.2; // Unfriendly
        return 1.0;                      // Neutral
    }
}
