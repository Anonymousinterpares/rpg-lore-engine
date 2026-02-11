import { GameStateManager } from '../combat/GameStateManager';
import { FullSaveState } from '../schemas/FullSaveStateSchema';
import { RelationshipState } from '../schemas/RelationshipSchema';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { ShopEngine } from '../combat/ShopEngine';
import { CurrencyEngine } from '../combat/CurrencyEngine';
import * as path from 'path';
import * as fs from 'fs';

async function verifySessionManagement() {
    console.log("--- Starting Session Management Verification ---");

    const rootDir = path.join(__dirname, '..', '..', '..');
    const gsm = new GameStateManager(rootDir);

    // 1. Create a dummy state
    const dummyState: FullSaveState = {
        saveId: "test-save-1",
        saveVersion: 1,
        createdAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        playTimeSeconds: 3600,
        saveSlotName: "The Beginning",
        character: {
            name: "Lirael",
            level: 1,
            race: "Elf",
            class: "Wizard",
            stats: { STR: 8, DEX: 15, CON: 12, INT: 17, WIS: 13, CHA: 10 },
            savingThrowProficiencies: ["INT", "WIS"],
            skillProficiencies: ["Arcana", "History"],
            hp: { current: 8, max: 8, temp: 0 },
            deathSaves: { successes: 0, failures: 0 },
            hitDice: { current: 1, max: 1, dieType: "1d6" },
            spellSlots: { "1": { current: 2, max: 2 } },
            cantripsKnown: [],
            knownSpells: [],
            preparedSpells: [],
            spellbook: [],
            ac: 12,
            inventory: {
                gold: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
                items: [
                    { id: "spellbook-1", name: "Spellbook", weight: 3, quantity: 1, equipped: false }
                ]
            },
            equipmentSlots: {},
            biography: {
                traits: ["Curious"],
                ideals: ["Knowledge"],
                bonds: ["My master"],
                flaws: ["Absent-minded"],
                chronicles: [{ turn: 1, event: "Arrived at Ironhold." }]
            },
            xp: 0,
            inspiration: false,
            attunedItems: []
        },
        companions: [],
        mode: "EXPLORATION",
        location: { hexId: "0,0", coordinates: [0, 0] },
        worldTime: { days: 1, hours: 10, minutes: 0 },
        worldMap: {
            grid_id: "main",
            hexes: {
                "0,0": {
                    coordinates: [0, 0],
                    generated: true,
                    biome: "Plains",
                    visited: true,
                    interest_points: [],
                    resourceNodes: [],
                    openedContainers: {}
                }
            }
        },
        subLocations: [],
        worldNpcs: [
            {
                id: "merchant-1",
                name: "Barnaby",
                inventory: [],
                dialogue_triggers: [],
                relationship: { standing: 0, interactionLog: [] },
                isMerchant: true,
                shopState: { inventory: ["longsword_1"], markup: 1.0, discount: 0.0, isOpen: true }
            }
        ],
        activeQuests: [],
        factions: [],
        storySummary: "A new wizard arrives.",
        conversationHistory: [],
        triggeredEvents: [],
        settings: {
            difficulty: 'normal',
            ironman: false,
            adaptiveCombat: true,
            explorationDensity: 1.0,
            loreWeight: 1.0
        }
    } as any;

    // 2. Test Saving
    // 2. Test Saving
    console.log("Testing Save...");
    await gsm.saveGame(dummyState, "Test Slot");

    // 3. Test Loading
    // 3. Test Loading
    console.log("Testing Load...");
    const loaded = await gsm.loadGame("test-save-1");
    if (loaded && loaded.character.name === "Lirael") {
        console.log("✅ Load successful.");
    } else {
        console.error("❌ Load failed or data mismatch.");
    }

    // 4. Test Relationship System
    console.log("Testing Relationship System...");
    const npc = dummyState.worldNpcs[0];
    console.log(`Initial standing with ${npc.name}: ${npc.relationship.standing}`);

    ShopEngine.updateRelationship(npc, "Kind word", 10);
    console.log(`Standing after kind word: ${npc.relationship.standing}`);

    if (npc.relationship.standing === 10) {
        console.log("✅ Relationship update successful.");
    } else {
        console.error("❌ Relationship update failed.");
    }

    const priceN = ShopEngine.getBuyPrice({ cost: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, weight: 2 } as any, npc);
    console.log(`Neutral price (standing 10): ${CurrencyEngine.format(priceN)}`);

    ShopEngine.updateRelationship(npc, "Heroic deed", 20); // total 30 (Friendly)
    const priceF = ShopEngine.getBuyPrice({ cost: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, weight: 2 } as any, npc);
    console.log(`Friendly price (standing 30, 10% discount): ${CurrencyEngine.format(priceF)}`);

    if (CurrencyEngine.toCopper(priceF) < CurrencyEngine.toCopper(priceN)) {
        console.log("✅ Price modifier working.");
    } else {
        console.error("❌ Price modifier failed: Total Copper N:", CurrencyEngine.toCopper(priceN), "F:", CurrencyEngine.toCopper(priceF));
    }

    // 5. Test Registry
    console.log("Testing Registry...");
    const registry = await gsm.getSaveRegistry();
    const saves = registry.slots;
    console.log("Available saves:", saves.map((s: any) => s.slotName));
    if (saves.some((s: any) => s.id === "test-save-1")) {
        console.log("✅ Registry correctly listed saves.");
    } else {
        console.error("❌ Registry failed to list saves.");
    }

    // 6. Cleanup (Optional)
    // gsm.deleteSave("test-save-1");

    console.log("--- Verification Complete ---");
}

verifySessionManagement().catch(console.error);
