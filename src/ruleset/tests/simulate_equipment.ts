import { EquipmentEngine } from '../combat/EquipmentEngine';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Item } from '../schemas/ItemSchema';

function testEquipment() {
    console.log("=== Testing EquipmentEngine ===\n");

    const pc: PlayerCharacter = {
        name: "Test Hero",
        stats: { "DEX": 16 }, // +3 mod
        inventory: {
            items: [
                { id: "1", name: "Leather", weight: 10, equipped: false },
                { id: "2", name: "Plate", weight: 65, equipped: false },
                { id: "3", name: "Shield", weight: 6, equipped: false }
            ]
        },
        equipmentSlots: {},
        ac: 13 // 10 + 3
    } as any;

    console.log("Initial AC (Unarmored, DEX 16):", pc.ac);

    // Equip Leather
    const leather: Item = { name: "Leather", type: "Armor" } as any;
    console.log(EquipmentEngine.equipItem(pc, 'armor', leather));
    console.log("AC with Leather (11 + 3):", pc.ac); // Should be 14

    // Equip Shield
    const shield: Item = { name: "Shield", type: "Shield" } as any;
    console.log(EquipmentEngine.equipItem(pc, 'offHand', shield));
    console.log("AC with Leather + Shield (14 + 2):", pc.ac); // Should be 16

    // Equip Plate (Heavy)
    const plate: Item = { name: "Plate", type: "Armor" } as any;
    console.log(EquipmentEngine.equipItem(pc, 'armor', plate));
    console.log("AC with Plate + Shield (18 + 2):", pc.ac); // Should be 20

    // Unequip Everything
    EquipmentEngine.unequipItem(pc, 'armor');
    EquipmentEngine.unequipItem(pc, 'offHand');
    console.log("AC after unequipping everything:", pc.ac); // Should be 13

    console.log("\n=== Equipment Tests Complete ===");
}

testEquipment();
