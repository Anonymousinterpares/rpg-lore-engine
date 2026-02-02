import { CurrencyEngine, Currency } from '../combat/CurrencyEngine';

function testCurrency() {
    console.log("=== Testing CurrencyEngine ===\n");

    const wallet: Currency = { cp: 10, sp: 5, ep: 0, gp: 2, pp: 0 };
    console.log("Initial Wallet:", CurrencyEngine.format(wallet));

    const totalCopper = CurrencyEngine.toCopper(wallet);
    console.log("Total Copper:", totalCopper); // 10 + 50 + 200 = 260

    const normalized = CurrencyEngine.normalize(wallet);
    console.log("Normalized:", CurrencyEngine.format(normalized)); // 2gp, 6sp

    // Test Addition
    const loot: Currency = { cp: 0, sp: 0, ep: 5, gp: 1, pp: 0 }; // 1gp, 5ep = 1gp + 2.5gp? No, 5ep=2.5gp. 100+250 = 350
    const combined = CurrencyEngine.add(wallet, loot);
    console.log("Combined (+1gp, 5ep):", CurrencyEngine.format(combined)); // 260 + 350 = 610 -> 6gp, 1sp

    // Test Subtraction
    const cost: Currency = { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 };
    const result = CurrencyEngine.subtract(combined, cost);
    if (result) {
        console.log("After buying 5gp item:", CurrencyEngine.format(result)); // 610 - 500 = 110 -> 1gp, 1sp
    }

    // Test Insufficient Funds
    const tooExpensive: Currency = { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 };
    const fail = CurrencyEngine.subtract(wallet, tooExpensive);
    console.log("Can afford 100gp?", CurrencyEngine.canAfford(wallet, tooExpensive));
    console.log("Subtract 100gp result:", fail ? "Success" : "NULL (Correct)");

    console.log("\n=== Currency Tests Complete ===");
}

testCurrency();
