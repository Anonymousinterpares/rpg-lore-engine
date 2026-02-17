import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';
import { CurrencyEngine, Currency } from './CurrencyEngine';
import { Dice } from './Dice';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { MechanicsEngine } from './MechanicsEngine';
import { DataManager } from '../data/DataManager';

export class ShopEngine {
    /**
     * Attempts to negotiate a better price for a specific item.
     */
    public static negotiate(pc: PlayerCharacter, npc: WorldNPC, itemId: string, currentTurn: number): { success: boolean, message: string } {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return { success: false, message: "Shop is closed." };
        if (npc.relationship.standing <= -25) return { success: false, message: "The merchant refuses to speak with you." };

        // Check for 24h failure timeout (assuming 1 turn = 6 seconds, 1 hour = 600 turns, 24h = 14400 turns)
        const lastFail = npc.shopState.lastHaggleFailure[itemId];
        if (lastFail !== undefined && (currentTurn - lastFail < 14400)) {
            const hoursLeft = Math.ceil((14400 - (currentTurn - lastFail)) / 600);
            return { success: false, message: `The merchant remains firm on the price. Try again in about ${hoursLeft} hours.` };
        }

        const standing = npc.relationship.standing;
        const result = MechanicsEngine.resolveCheck(pc as any, 'CHA', 'Persuasion', 15);

        // Adjust DC based on standing
        let dc = 15;
        if (standing >= 25) dc = 12;
        if (standing >= 75) dc = 10;

        // Traits influence
        if (npc.traits?.includes('Stubborn')) dc += 2;
        if (npc.traits?.includes('Gullible')) dc -= 2;

        if (result.total >= dc) {
            const shift = 0.05 + (Math.random() * 0.1); // 5% to 15% extra discount
            npc.shopState.discount += shift;
            this.updateRelationship(npc, `Successful negotiation for ${itemId}`, 2);
            return {
                success: true,
                message: `Success! The merchant is impressed. You get a better deal! (${result.total} vs ${dc})`
            };
        } else {
            // Failure: add to timeout
            npc.shopState.lastHaggleFailure[itemId] = currentTurn;
            const penalty = result.roll === 1 ? -5 : -1;
            this.updateRelationship(npc, `Failed negotiation for ${itemId}`, penalty);

            return {
                success: false,
                message: result.roll === 1
                    ? `Critical Failure! You rolled ${result.total} (DC ${dc}). The merchant is offended by your low-balling.`
                    : `Negotiation failed. You rolled ${result.total}, which did not meet the Difficulty Class (DC) of ${dc}. (See Codex -> Mechanics -> Trade System)`
            };
        }
    }

    /**
     * Intimidate the merchant into lowering prices.
     */
    public static intimidate(pc: PlayerCharacter, npc: WorldNPC): { success: boolean, message: string } {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return { success: false, message: "Shop is closed." };

        let dc = 13;
        if (npc.traits?.includes('Brave') || npc.traits?.includes('Stubborn')) dc = 16;
        if (npc.traits?.includes('Nervous')) dc = 10;

        const result = MechanicsEngine.resolveCheck(pc as any, 'CHA', 'Intimidation', dc);

        if (result.success) {
            const discount = 0.10 + (Math.random() * 0.05); // 10-15%
            npc.shopState.discount += discount;
            this.updateRelationship(npc, "Intimidated into discount", -10);
            return { success: true, message: `Success! You rolled ${result.total} vs DC ${dc}. The merchant is frightened and drops their prices.` };
        } else {
            this.updateRelationship(npc, "Failed intimidation", -15);
            if (npc.relationship.standing <= -25) npc.shopState.isOpen = false;
            return { success: false, message: `Failed. You rolled ${result.total} vs DC ${dc}. The merchant is unimpressed. "Get out of my sight!"` };
        }
    }

    /**
     * Deceive the merchant to get better sell prices.
     */
    public static deceive(pc: PlayerCharacter, npc: WorldNPC): { success: boolean, message: string } {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return { success: false, message: "Shop is closed." };

        const passiveInsight = 10 + Math.floor(((npc.stats?.['WIS'] || 10) - 10) / 2);
        const dc = passiveInsight + (npc.traits?.includes('Suspicious') ? 5 : 0);

        const result = MechanicsEngine.resolveCheck(pc as any, 'CHA', 'Deception', dc);

        if (result.success) {
            npc.shopState.discount += 0.20; // Massive bonus to next interaction
            this.updateRelationship(npc, "Deceived merchant", -2); // Small hidden penalty or none if unseen
            return { success: true, message: `Success! You rolled ${result.total} vs DC ${dc}. You spin a convincing yarn about your goods.` };
        } else {
            this.updateRelationship(npc, "Caught in a lie", -20);
            npc.shopState.isOpen = false;
            npc.traits.push('Suspicious');
            return { success: false, message: `The merchant catches your lie! "Trying to swindle me? We're done here!" (${result.total} vs ${dc})` };
        }
    }

    /**
     * Calculates the adjusted price for buying an item.
     */
    public static getBuyPrice(item: Item, npc: WorldNPC, pc?: PlayerCharacter): Currency {
        const baseValue = CurrencyEngine.toCopper(item.cost);
        const standingModifier = this.getStandingModifier(npc.relationship.standing);
        const shopMarkup = npc.shopState?.markup || 1.0;
        const shopDiscount = npc.shopState?.discount || 0.0;

        // Passive Persuasion
        let persuasionDiscount = 0;
        if (pc) {
            const charismaMod = Math.floor(((pc.stats['CHA'] || 10) - 10) / 2);
            const isProficient = pc.skillProficiencies.includes('Persuasion');
            const profBonus = isProficient ? MechanicsEngine.getProficiencyBonus(pc.level) : 0;
            const passivePersuasion = 10 + charismaMod + profBonus;

            if (passivePersuasion >= 20) persuasionDiscount = 0.15;
            else if (passivePersuasion >= 18) persuasionDiscount = 0.10;
            else if (passivePersuasion >= 15) persuasionDiscount = 0.05;
        }

        const totalModifier = (shopMarkup - shopDiscount - persuasionDiscount) * standingModifier;
        const adjustedValue = Math.ceil(baseValue * Math.max(0.5, totalModifier));
        return CurrencyEngine.fromCopper(adjustedValue);
    }

    /**
     * Calculates the adjusted price for selling an item.
     */
    public static getSellPrice(item: Item, npc: WorldNPC, pc?: PlayerCharacter): Currency {
        const baseValue = CurrencyEngine.toCopper(item.cost);
        const standing = npc.relationship.standing;

        // Base sell is 50%, standing improves it
        let modifier = 0.5;
        if (standing >= 25) modifier = 0.6;
        if (standing >= 75) modifier = 0.7;

        // Passive Persuasion also helps selling
        let persuasionBonus = 0;
        if (pc) {
            const charismaMod = Math.floor(((pc.stats['CHA'] || 10) - 10) / 2);
            const isProficient = pc.skillProficiencies.includes('Persuasion');
            const profBonus = isProficient ? MechanicsEngine.getProficiencyBonus(pc.level) : 0;
            const passivePersuasion = 10 + charismaMod + profBonus;

            if (passivePersuasion >= 20) persuasionBonus = 0.10;
            else if (passivePersuasion >= 15) persuasionBonus = 0.05;
        }

        const shopDiscount = npc.shopState?.discount || 0.0;
        const adjustedValue = Math.floor(baseValue * (modifier + shopDiscount + persuasionBonus));
        return CurrencyEngine.fromCopper(adjustedValue);
    }

    /**
     * Processes a purchase.
     */
    public static buyItem(pc: PlayerCharacter, item: Item, npc: WorldNPC): string {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return "Shop is closed.";
        if (npc.relationship.standing <= -25) return "The merchant refuses to do business with you.";

        const price = this.getBuyPrice(item, npc, pc);

        if (!CurrencyEngine.canAfford(pc.inventory.gold, price)) {
            return `Insufficient funds. Needed ${CurrencyEngine.format(price)}.`;
        }

        // Weight Check
        const currentWeight = pc.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
        const capacity = (pc.stats['STR'] || 10) * 15;
        if (currentWeight + item.weight > capacity) {
            return `Too heavy! You cannot carry ${item.name} without exceeding your capacity.`;
        }

        const newGold = CurrencyEngine.subtract(pc.inventory.gold, price);
        if (newGold) {
            pc.inventory.gold = newGold;

            // Player gets item
            pc.inventory.items.push({
                id: item.name.toLowerCase().replace(/ /g, '_'),
                instanceId: crypto.randomUUID(),
                name: item.name,
                type: item.type || 'Misc',
                weight: item.weight,
                quantity: 1,
                equipped: false
            });

            // Merchant loses item ID from inventory
            const idx = npc.shopState.inventory.indexOf(item.name);
            if (idx !== -1) npc.shopState.inventory.splice(idx, 1);

            // Merchant gains gold (in GP for reserves)
            npc.shopState.gold += (CurrencyEngine.toCopper(price) / 100);

            this.updateRelationship(npc, `Purchased ${item.name}`, 1);
            return `Purchased ${item.name} for ${CurrencyEngine.format(price)}.`;
        }

        return "Transaction failed.";
    }

    /**
     * Repurchases an item previously sold to the merchant.
     */
    public static buybackItem(pc: PlayerCharacter, npc: WorldNPC, itemId: string): string {
        if (!npc.shopState) return "Shop is unavailable.";

        const soldItemIndex = npc.shopState.soldByPlayer.findIndex(s => s.itemId === itemId && s.buybackEligible);
        if (soldItemIndex === -1) return "Item is no longer eligible for buyback.";

        const priceCopper = npc.shopState.soldByPlayer[soldItemIndex].originalSellPrice;
        const price = CurrencyEngine.fromCopper(priceCopper);

        if (!CurrencyEngine.canAfford(pc.inventory.gold, price)) {
            return `Insufficient funds for buyback. Needed ${CurrencyEngine.format(price)}.`;
        }

        // Weight Check
        const itemData = DataManager.getItem(itemId);
        if (itemData) {
            const currentWeight = pc.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
            const capacity = (pc.stats['STR'] || 10) * 15;
            if (currentWeight + itemData.weight > capacity) {
                return `Too heavy! You cannot buyback ${itemId}.`;
            }
        }

        pc.inventory.gold = CurrencyEngine.subtract(pc.inventory.gold, price)!;

        // Remove from sold list
        npc.shopState.soldByPlayer.splice(soldItemIndex, 1);

        // Remove from inventory
        const invIdx = npc.shopState.inventory.indexOf(itemId);
        if (invIdx !== -1) npc.shopState.inventory.splice(invIdx, 1);

        // Add to player
        const item = DataManager.getItem(itemId);
        if (item) {
            pc.inventory.items.push({
                id: itemId.toLowerCase().replace(/ /g, '_'),
                instanceId: crypto.randomUUID(),
                name: item.name,
                type: item.type || 'Misc',
                weight: item.weight,
                quantity: 1,
                equipped: false
            });
        }

        // Merchant loses gold
        npc.shopState.gold -= (priceCopper / 100);

        return `Repurchased ${itemId} for ${CurrencyEngine.format(price)} (Buyback).`;
    }

    /**
     * Processes a sale.
     */
    public static sellItem(pc: PlayerCharacter, inventoryItemId: string, npc: WorldNPC, item: Item): string {
        if (!npc.isMerchant || !npc.shopState || !npc.shopState.isOpen) return "Shop is closed.";

        const price = this.getSellPrice(item, npc, pc);
        const priceCopper = CurrencyEngine.toCopper(price);

        // Merchant Gold Check
        if (npc.shopState.gold < (priceCopper / 100)) {
            return `The merchant doesn't have enough gold. They only have ${Math.floor(npc.shopState.gold)}gp.`;
        }

        const index = pc.inventory.items.findIndex(i => i.id === inventoryItemId);
        if (index === -1) return "Item not found in inventory.";

        // Remove from player
        pc.inventory.items.splice(index, 1);
        pc.inventory.gold = CurrencyEngine.add(pc.inventory.gold, price);

        // Add to merchant with buyback metadata
        npc.shopState.inventory.push(item.name);
        npc.shopState.soldByPlayer.push({
            itemId: item.name,
            originalSellPrice: priceCopper,
            buybackEligible: true
        });

        // Deduct merchant gold
        npc.shopState.gold -= (priceCopper / 100);

        this.updateRelationship(npc, `Sold ${item.name}`, 1);
        return `Sold ${item.name} for ${CurrencyEngine.format(price)}.`;
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
        if (standing <= -75) return 2.0; // Hostile
        if (standing <= -25) return 1.3; // Unfriendly
        return 1.0;                      // Neutral
    }
}

