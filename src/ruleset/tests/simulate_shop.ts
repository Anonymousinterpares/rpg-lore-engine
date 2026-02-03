import { ShopEngine, ShopState } from '../combat/ShopEngine';
import { CurrencyEngine } from '../combat/CurrencyEngine';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';

function testShop() {
    console.log("=== Testing ShopEngine ===\n");

    const pc: PlayerCharacter = {
        name: "Test Hero",
        level: 1,
        race: "Human",
        class: "Fighter",
        stats: { "CHA": 14 },
        inventory: {
            gold: { cp: 0, sp: 0, ep: 0, gp: 50, pp: 0 },
            items: []
        },
        equipmentSlots: {},
        attunedItems: [],
        hp: { current: 10, max: 10, temp: 0 },
        hitDice: { current: 1, max: 1, dieType: "1d10" },
        ac: 10,
        xp: 0,
        deathSaves: { successes: 0, failures: 0 }
    } as any;

    const npc: any = {
        id: "merchant_01",
        name: "Old Barnaby",
        inventory: [],
        dialogue_triggers: [],
        relationship: { standing: 0, interactionLog: [] },
        isMerchant: true,
        shopState: {
            inventory: [],
            markup: 1.0,
            discount: 0.0,
            isOpen: true
        }
    };

    const sword: Item = {
        name: "Longsword",
        type: "Weapon",
        cost: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
        weight: 3,
        modifiers: [],
        tags: []
    } as any;

    console.log("Initial Gold:", CurrencyEngine.format(pc.inventory.gold));
    console.log("Standard Longsword Price:", CurrencyEngine.format(ShopEngine.getBuyPrice(sword, npc)));

    // Test Negotiation
    console.log("\nAttempting Negotiation (CHA +2)...");
    const negResult = ShopEngine.negotiate(pc, 2, npc);
    console.log(negResult.message);

    if (npc.shopState.isOpen && npc.shopState.discount > 0) {
        console.log("New Longsword Price:", CurrencyEngine.format(ShopEngine.getBuyPrice(sword, npc)));
    }

    // Test Buy
    console.log("\nBuying Longsword...");
    const buyMsg = ShopEngine.buyItem(pc, sword, npc);
    console.log(buyMsg);
    console.log("Remaining Gold:", CurrencyEngine.format(pc.inventory.gold));
    console.log("Inventory Items:", pc.inventory.items.length);

    // Test Sell
    if (pc.inventory.items.length > 0) {
        console.log("\nSelling Longsword back...");
        const sellMsg = ShopEngine.sellItem(pc, pc.inventory.items[0].id, npc, sword);
        console.log(sellMsg);
        console.log("Gold after sale:", CurrencyEngine.format(pc.inventory.gold));
    }

    console.log("\n=== Shop Tests Complete ===");
}

testShop();
